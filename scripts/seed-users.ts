/**
 * Seed initial users into the database.
 *
 * Usage (run once after migration):
 *   npx tsx scripts/seed-users.ts
 *
 * Set env vars before running:
 *   WAREHOUSER_PASSWORD=xxx SERVICE_DESK_PASSWORD=yyy
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_DATABASE_ID=... CLOUDFLARE_D1_TOKEN=...
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32;

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

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes.buffer);
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    PBKDF2_KEY_BYTES * 8,
  );
  return bufToHex(bits);
}

async function main() {
  const warehousePass = process.env.WAREHOUSER_PASSWORD;
  const serviceDeskPass = process.env.SERVICE_DESK_PASSWORD;

  if (!warehousePass || !serviceDeskPass) {
    console.error('Set WAREHOUSER_PASSWORD and SERVICE_DESK_PASSWORD env vars.');
    process.exit(1);
  }

  const roles = [
    { role: 'warehouser', password: warehousePass },
    { role: 'service_desk', password: serviceDeskPass },
  ];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID!;
  const token = process.env.CLOUDFLARE_D1_TOKEN!;
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  for (const { role, password } of roles) {
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);

    const sql = `
      INSERT INTO users (role, password_hash, salt, failed_attempts)
      VALUES ('${role}', '${hash}', '${salt}', 0)
      ON CONFLICT(role) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, failed_attempts = 0, locked_until = NULL;
    `;

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    const result = await res.json() as any;
    if (result.success) {
      console.log(`✓ Seeded ${role}`);
    } else {
      console.error(`✗ Failed to seed ${role}:`, result.errors);
    }
  }
}

main();
