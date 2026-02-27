import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createClient } from '../../../../db/client';
import { users } from '../../../../db/schema';
import { hashPassword, generateToken } from '../../../lib/auth';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const VALID_ROLES = ['warehouser', 'service_desk'];

function json(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let body: { role?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request format' }, 400);
    }

    const { role, password } = body;

    if (!role || !password || !VALID_ROLES.includes(role)) {
      return json({ error: 'Invalid request' }, 400);
    }

    const runtime = locals.runtime;
    if (!runtime?.env?.DB) {
      return json({ error: 'Database connection failed' }, 500);
    }

    const db = createClient(runtime.env.DB);
    const user = await db.query.users.findFirst({ where: eq(users.role, role) });

    if (!user) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    // Check lockout
    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingSecs = Math.ceil((user.lockedUntil - now) / 1000);
      return json({ error: 'Account locked', remaining: remainingSecs, locked: true }, 429);
    }

    // Verify password
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      const newAttempts = user.failedAttempts + 1;
      const update =
        newAttempts >= LOCKOUT_THRESHOLD
          ? { failedAttempts: newAttempts, lockedUntil: now + LOCKOUT_MS }
          : { failedAttempts: newAttempts };
      await db.update(users).set(update).where(eq(users.role, role));

      const attemptsLeft = Math.max(0, LOCKOUT_THRESHOLD - newAttempts);
      return json({ error: 'Invalid credentials', attemptsLeft }, 401);
    }

    // Success — reset counters
    await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.role, role));

    const secret = (runtime.env as Record<string, string>).HMAC_SECRET ?? 'dev-secret-change-in-prod';
    const token = await generateToken(role, secret);

    return new Response(JSON.stringify({ success: true, role }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `st_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
      },
    });
  } catch (err) {
    console.error('Auth verify error:', err);
    return json({ error: 'Server error' }, 500);
  }
};
