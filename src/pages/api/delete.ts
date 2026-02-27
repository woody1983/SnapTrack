import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';
import { labels } from '../../../db/schema';
import { eq } from 'drizzle-orm';

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

    const { id } = body;

    // Validate input
    if (!id || typeof id !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid label ID' }),
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

    // Check if label exists
    const existing = await db.query.labels.findFirst({
      where: eq(labels.id, id),
    });

    if (!existing) {
      return new Response(
        JSON.stringify({ error: 'Label not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete the label
    await db.delete(labels).where(eq(labels.id, id));

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Label deleted successfully',
        deleted: {
          id: existing.id,
          trackingNumber: existing.trackingNumber,
        },
        responseTimeMs: responseTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Delete failed. Please try again later.',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
