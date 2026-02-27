import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { createClient } from '../../../db/client';
import { pinnedTrackings } from '../../../db/schema';

const MAX_PINS_PER_ROLE = 5;
const VALID_ROLES = ['warehouser', 'service_desk'];

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getDB(locals: App.Locals) {
  const runtime = locals.runtime as any;
  if (!runtime?.env?.DB) return null;
  return createClient(runtime.env.DB);
}

// GET /api/pins?role=warehouser
export const GET: APIRoute = async ({ request, locals }) => {
  const role = new URL(request.url).searchParams.get('role');
  if (!role || !VALID_ROLES.includes(role)) return json({ error: 'Missing role' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Database connection failed' }, 500);

  const pins = await db.query.pinnedTrackings.findMany({
    where: eq(pinnedTrackings.role, role),
  });

  return json({ success: true, pins });
};

// POST /api/pins — { role, trackingNumber, carrier }
export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  if (!db) return json({ error: 'Database connection failed' }, 500);

  let body: { role?: string; trackingNumber?: string; carrier?: string };
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid request format' }, 400);
  }

  const { role, trackingNumber, carrier } = body;
  if (!role || !VALID_ROLES.includes(role)) return json({ error: 'Missing role' }, 400);
  if (!trackingNumber || !carrier) return json({ error: 'Missing fields' }, 400);

  const existing = await db.query.pinnedTrackings.findFirst({
    where: and(eq(pinnedTrackings.role, role), eq(pinnedTrackings.trackingNumber, trackingNumber)),
  });
  if (existing) return json({ error: 'Already pinned' }, 409);

  const count = (await db.query.pinnedTrackings.findMany({ where: eq(pinnedTrackings.role, role) })).length;
  if (count >= MAX_PINS_PER_ROLE) return json({ error: `Max ${MAX_PINS_PER_ROLE} pins per role` }, 409);

  const now = new Date();
  await db.insert(pinnedTrackings).values({ role, trackingNumber, carrier, pinnedAt: now, lastRefreshedAt: now });

  return json({ success: true });
};

// DELETE /api/pins — { role, trackingNumber }
export const DELETE: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  if (!db) return json({ error: 'Database connection failed' }, 500);

  let body: { role?: string; trackingNumber?: string };
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid request format' }, 400);
  }

  const { role, trackingNumber } = body;
  if (!role || !VALID_ROLES.includes(role)) return json({ error: 'Missing role' }, 400);
  if (!trackingNumber) return json({ error: 'Missing trackingNumber' }, 400);

  await db.delete(pinnedTrackings).where(
    and(eq(pinnedTrackings.role, role), eq(pinnedTrackings.trackingNumber, trackingNumber)),
  );

  return json({ success: true });
};
