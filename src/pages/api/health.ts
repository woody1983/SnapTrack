import type { APIRoute } from 'astro';
import { createClient } from '../../../db/client';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const runtime = locals.runtime;
    const db = createClient(runtime.env.DB);
    
    // 测试数据库连接
    const result = await db.query.labels.findFirst();
    
    return new Response(
      JSON.stringify({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
