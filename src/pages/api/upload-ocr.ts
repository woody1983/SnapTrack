import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// UPS 正则: 1Z + 16位字母数字
const UPS_REGEX = /1Z[0-9A-Z]{16}/i;
// FedEx 正则: 12、15 或 22 位纯数字
const FEDEX_REGEX = /\b(\d{12}|\d{15}|\d{22})\b/g;

/**
 * 从 OCR 文本中提取快递单号
 */
function extractTrackingNumber(text: string): { 
  trackingNumber: string | null; 
  carrier: 'UPS' | 'FedEx' | null;
  confidence: number;
} {
  // 清理文本
  const cleanText = text.toUpperCase();
  
  // 先尝试匹配 UPS
  const upsMatch = cleanText.match(UPS_REGEX);
  if (upsMatch) {
    return {
      trackingNumber: upsMatch[0],
      carrier: 'UPS',
      confidence: 0.95,
    };
  }
  
  // 再尝试匹配 FedEx
  const fedexMatches = cleanText.match(FEDEX_REGEX);
  if (fedexMatches) {
    // 选择最长的匹配（通常是 15 或 22 位）
    const bestMatch = fedexMatches.reduce((a, b) => a.length >= b.length ? a : b);
    return {
      trackingNumber: bestMatch,
      carrier: 'FedEx',
      confidence: 0.9,
    };
  }
  
  return {
    trackingNumber: null,
    carrier: null,
    confidence: 0,
  };
}

/**
 * 调用 Workers AI 进行 OCR 识别
 */
async function performOCR(base64Image: string, env: Env): Promise<string> {
  // 构建 data URL
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  // 调用 Workers AI llama-3.2-11b-vision-instruct
  const response = await env.AI.run(
    '@cf/meta/llama-3.2-11b-vision-instruct',
    {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the tracking number from this shipping label. Look for UPS (starts with 1Z) or FedEx (12-22 digits) tracking numbers. Return ONLY the tracking number, nothing else.',
            },
            {
              type: 'image',
              image: imageDataUrl,
            },
          ],
        },
      ],
    }
  );
  
  // 解析响应
  if (response && typeof response === 'object' && 'response' in response) {
    return String(response.response);
  }
  
  throw new Error('OCR failed: Invalid response format');
}

/**
 * 备选 OCR: OCR.space API
 */
async function performOCRWithOCRSpace(base64Image: string): Promise<string> {
  const apiKey = import.meta.env.OCR_SPACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('OCR.space API key not configured');
  }
  
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
  formData.append('apikey', apiKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  
  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage || 'OCR failed');
  }
  
  return data.ParsedResults?.[0]?.ParsedText || '';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const image = formData.get('image');

    // 验证图片
    if (!image || !(image instanceof File)) {
      return new Response(
        JSON.stringify({ error: '请上传图片' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['image/jpeg', 'image/png'].includes(image.type)) {
      return new Response(
        JSON.stringify({ error: '仅支持 JPG/PNG 格式' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (image.size > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: '图片大小不能超过 5MB' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 读取图片
    const arrayBuffer = await image.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 获取环境
    const runtime = locals.runtime;
    if (!runtime?.env?.DB) {
      return new Response(
        JSON.stringify({ error: '数据库连接失败' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 执行 OCR
    let ocrText: string;
    let ocrSource: string;
    
    try {
      // 优先尝试 Workers AI
      if (runtime.env.AI) {
        ocrText = await performOCR(base64, runtime.env);
        ocrSource = 'workers-ai';
      } else {
        throw new Error('Workers AI not available');
      }
    } catch (aiError) {
      console.log('Workers AI failed, falling back:', aiError);
      
      // 备选方案
      try {
        ocrText = await performOCRWithOCRSpace(base64);
        ocrSource = 'ocr-space';
      } catch (fallbackError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: '识别失败，请手动输入',
            fallback: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 提取单号
    const extraction = extractTrackingNumber(ocrText);

    if (!extraction.trackingNumber || extraction.confidence < 0.5) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: '未能识别到有效的 FedEx/UPS 单号',
          ocrPreview: ocrText.substring(0, 100),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { trackingNumber, carrier } = extraction;

    // 数据库操作
    const db = createClient(runtime.env.DB);

    // 先查询是否已存在
    const existing = await db.query.labels.findFirst({
      where: eq(labels.trackingNumber, trackingNumber),
    });

    if (existing) {
      const responseTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          trackingNumber,
          carrier,
          exists: true,
          createdAt: existing.createdAt?.toLocaleString('zh-CN'),
          ocrSource,
          responseTimeMs: responseTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 插入新记录
    const now = new Date();
    await db.insert(labels).values({
      trackingNumber,
      carrier: carrier!,
      shipFromAddress: null,
      shipToAddress: null,
      createdAt: now,
    });

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        trackingNumber,
        carrier,
        exists: false,
        createdAt: now.toLocaleString('zh-CN'),
        ocrSource,
        responseTimeMs: responseTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OCR API error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: '处理失败，请重试或手动输入',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
