// Auth utilities — PBKDF2 password hashing + HMAC token
// All crypto ops use Web Crypto API (supported in Cloudflare Workers)

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32; // 256-bit

// ── Helpers ────────────────────────────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

// ── Password ───────────────────────────────────────────────────────────────

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes.buffer);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    PBKDF2_KEY_BYTES * 8,
  );
  return bufToHex(bits);
}

// ── HMAC Token ─────────────────────────────────────────────────────────────
// Format: `${role}|${expiresAtMs}|${hmacHex}`

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export async function generateToken(role: string, secret: string): Promise<string> {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${role}|${expiresAt}`;
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}|${bufToHex(sig)}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ role: string } | null> {
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  const [role, expiresAtStr, sigHex] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
  const payload = `${role}|${expiresAtStr}`;
  const key = await hmacKey(secret, 'verify');
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBuf(sigHex),
    new TextEncoder().encode(payload),
  );
  return valid ? { role } : null;
}

// ── Request auth helper ─────────────────────────────────────────────────────

export async function authenticate(
  request: Request,
  secret: string,
): Promise<{ role: string } | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)st_token=([^;]+)/);
  if (!match) return null;
  return verifyToken(decodeURIComponent(match[1]), secret);
}
