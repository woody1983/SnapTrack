import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'st_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    },
  });
};
