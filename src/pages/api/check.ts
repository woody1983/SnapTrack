import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// UPS 格式: 1Z + 16位字母数字
const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
// FedEx 格式: 12、15 或 22 位纯数字
const FEDEX_REGEX = /^\d{12}|\d{15}|\d{22}$/;

/**
 * 清理快递单号
 * 去除空格、连字符、换行符，转为大写
 */
function sanitizeTrackingNumber(value: string): string {
  return value.replace(/[\s\-]/g, '').toUpperCase().trim();
}

/**
 * 验证单号格式（UPS 或 FedEx）
 */
function validateTrackingNumber(number: string): { valid: boolean; carrier?: 'UPS' | 'FedEx' } {
  if (UPS_REGEX.test(number)) {
    return { valid: true, carrier: 'UPS' };
  }
  if (FEDEX_REGEX.test(number)) {
    return { valid: true, carrier: 'FedEx' };
  }
  return { valid: false };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();
  
  try {
    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: '无效的请求格式' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { trackingNumber: rawTrackingNumber } = body;

    // 验证输入
    if (!rawTrackingNumber || typeof rawTrackingNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: '请提供有效的快递单号' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 清理单号
    const trackingNumber = sanitizeTrackingNumber(rawTrackingNumber);

    // 验证长度
    if (trackingNumber.length < 5) {
      return new Response(
        JSON.stringify({ error: '单号长度太短' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证格式
    const validation = validateTrackingNumber(trackingNumber);
    
    // 查询数据库
    const runtime = locals.runtime;
    
    if (!runtime?.env?.DB) {
      console.error('DB binding not found');
      return new Response(
        JSON.stringify({ error: '数据库连接失败' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = createClient(runtime.env.DB);

    const result = await db.query.labels.findFirst({
      where: eq(labels.trackingNumber, trackingNumber),
    });

    const responseTime = Date.now() - startTime;

    if (result) {
      return new Response(
        JSON.stringify({
          exists: true,
          trackingNumber: result.trackingNumber,
          carrier: result.carrier,
          shipFromAddress: result.shipFromAddress,
          shipToAddress: result.shipToAddress,
          createdAt: result.createdAt?.toLocaleString('zh-CN'),
          responseTimeMs: responseTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          exists: false,
          trackingNumber: trackingNumber,
          suggestedCarrier: validation.carrier || null,
          responseTimeMs: responseTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Check API error:', error);
    return new Response(
      JSON.stringify({ 
        error: '查询失败，请稍后重试',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
