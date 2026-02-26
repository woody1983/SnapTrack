# SnapTrack 📦

A minimalist package tracking and entry tool (MVP v1.0)

> 1-second lookup + 5-second scan-to-enter, zero server costs, running entirely on Cloudflare Edge

## Core Features

| Feature | Description | Response Time |
|---------|-------------|---------------|
| 🔍 **Manual Search** | Enter FedEx/UPS tracking number, instantly shows "In System" or "Not Found" | < 50ms |
| 📸 **Scan to Enter** | Take a photo to auto-extract tracking number and add to database | < 6s |
| 🔄 **Auto Deduplication** | Duplicate numbers show original entry time | - |
| 📱 **Mobile First** | Works on mobile browsers, no login required | < 800ms |

## Tech Stack

- **Framework**: [Astro](https://astro.build/) + `@astrojs/cloudflare`
- **Platform**: **Cloudflare Pages** (Functions + Static Assets)
- **Database**: Cloudflare D1 (Serverless SQLite)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **AI/OCR**: Cloudflare Workers AI (llama-3.2-11b-vision)

## Why Cloudflare Pages?

| Feature | Pages | Workers |
|---------|-------|---------|
| Static Assets | ✅ CDN Accelerated | ❌ Requires R2 |
| API Functions | ✅ Pages Functions | ✅ Workers |
| Auto Build & Deploy | ✅ Git Integration | ❌ CLI Only |
| Preview Environments | ✅ Auto-generated per PR | ❌ |
| Custom Domain | ✅ Free | Paid |

**Pages Functions = Workers + Auto Routing + Static Asset Hosting**

## Quick Start

### 1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
npx wrangler login
```

### 2. Create D1 Database

```bash
# Create database
npx wrangler d1 create snaptrack-db

# Example output:
# ✅ Successfully created DB 'snaptrack-db'
# [[d1_databases]]
# binding = "DB"
# database_name = "snaptrack-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Copy database_id to wrangler.toml
```

### 3. Configure Project

```bash
# Clone project
git clone https://github.com/woody1983/SnapTrack.git
cd SnapTrack

# Install dependencies
npm install

# Edit wrangler.toml with your database_id
vim wrangler.toml
```

### 4. Database Migration

```bash
# Generate migrations
npm run db:generate

# Apply to D1
npx wrangler d1 migrations apply snaptrack-db
```

### 5. Deploy to Pages

**Option 1: One-click deploy script**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Option 2: Wrangler CLI**
```bash
npm run build
npx wrangler pages deploy dist --project-name=snaptrack
```

**Option 3: GitHub Actions Auto-deploy**
1. Set Secrets in GitHub repository:
   - `CLOUDFLARE_API_TOKEN` - [Get API Token](https://dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` - Your account ID
2. Push to `main` branch triggers auto-deployment

## Project Structure

```
├── src/
│   ├── pages/
│   │   ├── index.astro           # Main page (search + entry)
│   │   └── api/                  # API Functions
│   │       ├── check.ts          # Search tracking number
│   │       ├── upload-ocr.ts     # Photo recognition
│   │       └── health.ts         # Health check
│   └── env.d.ts                  # Type definitions
├── db/
│   ├── schema.ts                 # Database schema
│   ├── client.ts                 # Database client
│   └── migrations/               # Migration files
├── public/
│   └── _routes.json              # Pages routing config
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions
├── astro.config.mjs              # Astro config (mode: 'directory')
├── wrangler.toml                 # Cloudflare config
├── deploy.sh                     # Deploy script
└── README.md
```

## Database Schema

```typescript
// labels table
{
  id: number;                    // Auto-increment primary key
  trackingNumber: string;        // Tracking number (UNIQUE)
  carrier: 'UPS' | 'FedEx';      // Carrier
  shipFromAddress?: string;      // Ship from address
  shipToAddress?: string;        // Ship to address
  createdAt: Date;               // Entry time
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | | Main page |
| `GET /api/health` | | Health check |
| `POST /api/check` | | Search tracking number status |
| `POST /api/upload-ocr` | | Upload image for OCR and entry |

### Request Example

```bash
# Search tracking number
curl -X POST https://snaptrack.pages.dev/api/check \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber": "1Z999AA10123456784"}'

# Response
{
  "exists": true,
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "createdAt": "2/25/2026, 7:20:00 PM"
}
```

## Development Phases

- [x] Phase 1: Infrastructure (Astro + D1 + Drizzle)
- [x] Phase 2: Core UI (Mobile-first)
- [x] Phase 3: Manual Search (< 50ms)
- [x] Phase 4: Photo OCR (Workers AI)

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Page Load | < 800ms | ✅ ~300ms (CDN) |
| Search Response | < 50ms | ✅ ~20ms (D1 Edge) |
| Photo Processing | < 6s | ✅ ~3s (Workers AI) |

## Cost

Everything runs within Cloudflare free tier:

| Service | Free Tier | SnapTrack Usage |
|---------|-----------|-----------------|
| **Pages** | Unlimited requests, 500 builds/month | ~10 builds/month ✅ |
| **D1** | 5M reads/day, 100K writes/day | < 1K/day ✅ |
| **Workers AI** | 10K neurons/day | < 100/day ✅ |

## Configuration

### wrangler.toml

```toml
name = "snaptrack"
pages_build_output_dir = "dist"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "snaptrack-db"
database_id = "your-database-id"

[ai]
binding = "AI"
```

### astro.config.mjs

```javascript
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',      // Pages directory mode
    functionPerRoute: true, // One Function per route
  }),
});
```

## Troubleshooting

### View Logs

```bash
# Real-time logs
npx wrangler pages deployment tail --project-name=snaptrack
```

### Local Simulation

```bash
# Simulate Pages environment locally
npx wrangler pages dev dist --d1 DB --ai AI
```

### Common Issues

**Q: API returns 404 after deployment?**
A: Check if `dist/_worker.js/` directory exists, Pages auto-detects it.

**Q: Database connection failed?**
A: Verify `database_id` in `wrangler.toml` and that migrations were applied.

**Q: Workers AI unavailable?**
A: Enable Workers AI in Cloudflare Dashboard.

## License

MIT
