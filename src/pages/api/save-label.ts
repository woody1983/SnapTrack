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
 */
function sanitizeTrackingNumber(value: string): string {
  return value.replace(/[\s\-]/g, '').toUpperCase().trim();
}

/**
 * Validate tracking number format
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

    const { 
      trackingNumber: rawTrackingNumber,
      shipperFirstName,
      shipperLastName,
    } = body;

    // Validate input
    if (!rawTrackingNumber || typeof rawTrackingNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Please provide a tracking number' }),
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
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid tracking number format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check database binding
    const runtime = locals.runtime;
    
    if (!runtime?.env?.DB) {
      console.error('DB binding not found');
      return new Response(
        JSON.stringify({ error: 'Database connection failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
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
          carrier: existing.carrier,
          exists: true,
          createdAt: existing.createdAt?.toISOString(),
          responseTimeMs: responseTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert new record
    const now = new Date();
    await db.insert(labels).values({
      trackingNumber,
      carrier: validation.carrier!,
      shipperFirstName: shipperFirstName || null,
      shipperLastName: shipperLastName || null,
      createdAt: now,
    });

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        trackingNumber,
        carrier: validation.carrier,
        exists: false,
        createdAt: now.toISOString(),
        responseTimeMs: responseTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Save label API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Save failed. Please try again later.',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
