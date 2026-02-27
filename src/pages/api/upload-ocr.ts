import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// UPS Regex: 1Z + 16 alphanumeric characters
const UPS_REGEX = /1Z[0-9A-Z]{16}/i;
// FedEx Regex: 12, 15, or 22 digits
const FEDEX_REGEX = /\b(\d{12}|\d{15}|\d{22})\b/g;

/**
 * Extract tracking number from OCR text
 */
function extractTrackingNumber(text: string): { 
  trackingNumber: string | null; 
  carrier: 'UPS' | 'FedEx' | null;
  confidence: number;
} {
  // Clean text
  const cleanText = text.toUpperCase();
  
  // Try matching UPS first
  const upsMatch = cleanText.match(UPS_REGEX);
  if (upsMatch) {
    return {
      trackingNumber: upsMatch[0],
      carrier: 'UPS',
      confidence: 0.95,
    };
  }
  
  // Then try matching FedEx
  const fedexMatches = cleanText.match(FEDEX_REGEX);
  if (fedexMatches) {
    // Select the longest match (usually 15 or 22 digits)
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
 * Extract shipper name from OCR text
 * Look for "From:" or "Shipper:" fields
 */
function extractShipperName(text: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Look for patterns like "From:", "Shipper:", "Sender:"
  const shipperKeywords = ['FROM:', 'SHIPPER:', 'SENDER:', 'FROM', 'SHIPPER'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    
    // Check if line contains shipper keyword
    for (const keyword of shipperKeywords) {
      if (line.includes(keyword)) {
        // Try next line(s) for name
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nameLine = lines[j].trim();
          // Skip empty, address-like lines, or lines with numbers
          if (!nameLine || /^[0-9]/.test(nameLine) || /(ST|AVE|ROAD|RD|BLVD|CITY|STATE|ZIP)/i.test(nameLine)) {
            continue;
          }
          // Look for "First Last" pattern
          const nameMatch = nameLine.match(/^([A-Za-z]+)\s+([A-Za-z\-]+)$/);
          if (nameMatch) {
            return {
              firstName: nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase(),
              lastName: nameMatch[2].charAt(0).toUpperCase() + nameMatch[2].slice(1).toLowerCase(),
            };
          }
        }
      }
    }
  }
  
  // Fallback: look for common name patterns in the first few lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    // Match "John Smith" or "John D. Smith" patterns
    const nameMatch = line.match(/^([A-Za-z]{2,20})\s+([A-Z]\.?\s+)?([A-Za-z\-]{2,20})$/);
    if (nameMatch && !/(TRACKING|LABEL|SHIP|ORDER)/i.test(line)) {
      const firstName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      const lastName = nameMatch[3].charAt(0).toUpperCase() + nameMatch[3].slice(1).toLowerCase();
      return { firstName, lastName };
    }
  }
  
  return { firstName: null, lastName: null };
}

/**
 * Call Workers AI for OCR recognition
 */
async function performOCR(base64Image: string, env: any): Promise<string> {
  // Build data URL
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  // Call Workers AI llama-3.2-11b-vision-instruct
  const response = await env.AI.run(
    '@cf/meta/llama-3.2-11b-vision-instruct',
    {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract information from this shipping label. 1) Find the tracking number (UPS starts with 1Z, FedEx is 12-22 digits). 2) Find the shipper/sender name (usually under "From:"). Return in this format:\nTracking: [number]\nShipper First: [first name]\nShipper Last: [last name]',
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
  
  // Parse response
  if (response && typeof response === 'object' && 'response' in response) {
    return String(response.response);
  }
  
  throw new Error('OCR failed: Invalid response format');
}

/**
 * Fallback OCR: OCR.space API
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

    // Validate image
    if (!image || !(image instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Please upload an image' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['image/jpeg', 'image/png'].includes(image.type)) {
      return new Response(
        JSON.stringify({ error: 'Only JPG/PNG formats supported' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cloudflare Pages has 5MB request body limit
    // Frontend should compress to < 4.5MB
    if (image.size > 4.8 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Please use a smaller image or retake photo from closer distance.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Read image
    const arrayBuffer = await image.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Get environment
    const runtime = locals.runtime;
    if (!runtime?.env?.DB) {
      return new Response(
        JSON.stringify({ error: 'Database connection failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Perform OCR
    let ocrText: string;
    let ocrSource: string;
    
    try {
      // Try Workers AI first
      if (runtime.env.AI) {
        ocrText = await performOCR(base64, runtime.env);
        ocrSource = 'workers-ai';
      } else {
        throw new Error('Workers AI not available');
      }
    } catch (aiError) {
      console.log('Workers AI failed, falling back:', aiError);
      
      // Fallback option
      try {
        ocrText = await performOCRWithOCRSpace(base64);
        ocrSource = 'ocr-space';
      } catch (fallbackError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Recognition failed. Please enter manually.',
            fallback: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract tracking number
    const extraction = extractTrackingNumber(ocrText);

    if (!extraction.trackingNumber || extraction.confidence < 0.5) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No valid FedEx/UPS tracking number found',
          ocrPreview: ocrText.substring(0, 100),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { trackingNumber, carrier } = extraction;
    
    // Extract shipper name
    const shipperName = extractShipperName(ocrText);

    // Database operations
    const db = createClient(runtime.env.DB);

    // Check if exists
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
          createdAt: existing.createdAt?.toLocaleString('en-US'),
          ocrSource,
          responseTimeMs: responseTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert new record
    const now = new Date();
    await db.insert(labels).values({
      trackingNumber,
      carrier: carrier!,
      shipFromAddress: null,
      shipToAddress: null,
      shipperFirstName: shipperName.firstName,
      shipperLastName: shipperName.lastName,
      createdAt: now,
    });

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        trackingNumber,
        carrier,
        exists: false,
        shipperFirstName: shipperName.firstName,
        shipperLastName: shipperName.lastName,
        createdAt: now.toLocaleString('en-US'),
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
        error: 'Processing failed. Please try again or enter manually.',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
