import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { desc } from 'drizzle-orm';

/**
 * Get recent labels list
 * Query params:
 *   - limit: number (default 20, max 50)
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();
  
  try {
    // Parse query params
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '20', 10), 50);

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

    // Query recent labels, ordered by createdAt desc
    const results = await db.query.labels.findMany({
      orderBy: [desc(labels.createdAt)],
      limit: limit,
    });

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        labels: results.map(label => ({
          id: label.id,
          trackingNumber: label.trackingNumber,
          carrier: label.carrier,
          shipFromAddress: label.shipFromAddress,
          shipToAddress: label.shipToAddress,
          shipperFirstName: label.shipperFirstName,
          shipperLastName: label.shipperLastName,
          createdAt: label.createdAt?.toLocaleString('en-US'),
        })),
        responseTimeMs: responseTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Labels API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch labels',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
