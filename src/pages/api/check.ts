import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// UPS format: 1Z + 16 alphanumeric characters
const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
// FedEx format: 12, 15, or 22 digits
const FEDEX_REGEX = /^\d{12}|\d{15}|\d{22}$/;

/**
 * Sanitize tracking number input
 * Remove spaces, hyphens, newlines, and convert to uppercase
 */
function sanitizeTrackingNumber(value: string): string {
  return value.replace(/[\s\-]/g, '').toUpperCase().trim();
}

/**
 * Validate tracking number format (UPS or FedEx)
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
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { trackingNumber: rawTrackingNumber } = body;

    // Validate input
    if (!rawTrackingNumber || typeof rawTrackingNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid tracking number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize tracking number
    const trackingNumber = sanitizeTrackingNumber(rawTrackingNumber);

    // Validate length
    if (trackingNumber.length < 5) {
      return new Response(
        JSON.stringify({ error: 'Tracking number too short' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate format
    const validation = validateTrackingNumber(trackingNumber);
    
    // Query database
    const runtime = locals.runtime;
    
    if (!runtime?.env?.DB) {
      console.error('DB binding not found');
      return new Response(
        JSON.stringify({ error: 'Database connection failed' }),
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
          createdAt: result.createdAt?.toISOString(),
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
        error: 'Search failed. Please try again later.',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
