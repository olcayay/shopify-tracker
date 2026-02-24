# Deployment Guide - AppRanks (Shopify Tracking)

## Infrastructure Overview

| Service | Technology | Domain / Port | Notes |
|---------|-----------|---------------|-------|
| **Dashboard** | Next.js 16 (standalone) | `https://appranks.io` / 3000 | SSR web UI |
| **API** | Fastify 5 (Node.js 20) | `https://api.appranks.io` / 3001 | REST API, JWT auth |
| **Worker** | BullMQ consumer + node-cron | No domain / No port | Scraping jobs, 7/24 |
| **PostgreSQL** | v16-alpine | Internal only / 5432 | Main database |
| **Redis** | v7-alpine | Internal only / 6379 | BullMQ job queue |

**Hosting:** Hetzner VPS (CPX21) + Coolify self-hosted PaaS
**Domain:** appranks.io (Namecheap)
**SSL:** Let's Encrypt (auto via Coolify/Traefik)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hetzner VPS (CPX21) — 5.78.101.102                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Coolify (PaaS) — :8000                                     │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Traefik (Reverse Proxy) — :80 / :443                 │  │   │
│  │  │                                                        │  │   │
│  │  │  appranks.io ──────► Dashboard (:3000)                 │  │   │
│  │  │  api.appranks.io ──► API (:3001)                       │  │   │
│  │  │                      Let's Encrypt SSL (auto)          │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  Dashboard   │  │  API         │  │  Worker          │   │   │
│  │  │  Next.js 16  │  │  Fastify 5   │  │  BullMQ + Cron   │   │   │
│  │  │  SSR + SPA   │  │  REST + JWT  │  │  Scraper + Sched │   │   │
│  │  │  :3000       │  │  :3001       │  │  (no port)       │   │   │
│  │  └──────┬───────┘  └───┬──────┬───┘  └───┬──────┬───────┘   │   │
│  │         │              │      │           │      │           │   │
│  │         │  HTTP/JSON   │      │           │      │           │   │
│  │         └──────────────┘      │           │      │           │   │
│  │                               │           │      │           │   │
│  │              ┌────────────────┴───────────┘      │           │   │
│  │              │                                   │           │   │
│  │         ┌────▼─────────┐              ┌──────────▼────────┐  │   │
│  │         │  PostgreSQL  │              │  Redis            │  │   │
│  │         │  v16-alpine  │              │  v7-alpine        │  │   │
│  │         │  :5432       │              │  :6379            │  │   │
│  │         │  (internal)  │              │  (internal)       │  │   │
│  │         └──────────────┘              └───────────────────┘  │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Service Communication

```
┌───────────┐         ┌───────────┐         ┌───────────┐
│  Browser  │ HTTPS   │ Dashboard │  HTTP   │    API    │
│  (User)   ├────────►│ Next.js   ├────────►│  Fastify  │
│           │◄────────┤ SSR + SPA │◄────────┤  REST     │
└───────────┘         └───────────┘         └─────┬─────┘
                                                  │
                                          SQL     │
                                   ┌──────────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │ PostgreSQL  │
                            │  (Tables,   │
                            │  Migrations)│
                            └──────▲──────┘
                                   │
                                   │ SQL
                                   │
┌────────────────────────────────┐  │
│  Worker                        │  │
│  ┌──────────┐  ┌────────────┐  │  │
│  │Scheduler │  │ BullMQ     │──┼──┘
│  │(node-cron│  │ Consumer   │  │
│  │ enqueue) │  │ (scrape &  │  │
│  └────┬─────┘  │  persist)  │  │
│       │        └──────▲─────┘  │
│       │ enqueue       │ dequeue│
│       │        ┌──────┴─────┐  │
│       └───────►│   Redis    │  │
│                │  (BullMQ   │  │
│                │   Queue)   │  │
│                └────────────┘  │
└────────────────────────────────┘
```

### Data Flow

```
                    Shopify App Store
                         │
                    HTTP/Cheerio
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Worker                                                 │
│                                                         │
│  Scheduler (cron)                                       │
│    │                                                    │
│    ├── 03:00 UTC ──► category scrape jobs               │
│    ├── every 6h ───► app_details scrape jobs            │
│    ├── 00:00/12:00 ► keyword_search scrape jobs         │
│    ├── 06:00/18:00 ► reviews scrape jobs                │
│    ├── 04:00 UTC ──► featured_apps scrape jobs          │
│    └── 05:00 UTC ──► daily_digest email jobs            │
│              │                                          │
│              ▼                                          │
│         ┌─────────┐    ┌──────────────────┐             │
│         │  Redis  │───►│ BullMQ Consumer  │             │
│         │ (Queue) │    │                  │             │
│         └─────────┘    │ • Scrape HTML    │             │
│                        │ • Parse data     │             │
│                        │ • Detect changes │             │
│                        │ • Save snapshots │             │
│                        └────────┬─────────┘             │
│                                 │                       │
└─────────────────────────────────┼───────────────────────┘
                                  │ SQL
                                  ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL                                              │
│                                                          │
│  Global Data (shared)          Account-Scoped Data       │
│  ┌──────────────────┐          ┌──────────────────────┐  │
│  │ apps             │          │ account_tracked_apps │  │
│  │ app_snapshots    │          │ account_tracked_kw   │  │
│  │ tracked_keywords │          │ account_competitor   │  │
│  │ keyword_snapshots│          │ account_starred_cat  │  │
│  │ categories       │          │ account_tracked_feat │  │
│  │ category_snapshot│          │ keyword_tags         │  │
│  │ app_keyword_rank │          │ keyword_tag_assign   │  │
│  │ reviews          │          │ users                │  │
│  │ featured_app_... │          │ accounts             │  │
│  │ keyword_ad_...   │          │ invitations          │  │
│  │ similar_app_...  │          │ refresh_tokens       │  │
│  └──────────────────┘          └──────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
                                  ▲
                                  │ SQL (read/write)
                                  │
┌──────────────────────────────────────────────────────────┐
│  API (Fastify)                                           │
│                                                          │
│  /api/auth/*     ── JWT login, register, refresh         │
│  /api/account/*  ── tracked apps, keywords, competitors  │
│  /api/apps/*     ── app details, snapshots, rankings     │
│  /api/keywords/* ── keyword details, rankings            │
│  /api/categories/* ── category listings, snapshots       │
│  /api/admin/*    ── system admin operations              │
│                                                          │
└──────────────────────────────────────────────────────────┘
                                  ▲
                                  │ HTTPS (api.appranks.io)
                                  │
┌──────────────────────────────────────────────────────────┐
│  Dashboard (Next.js)                                     │
│                                                          │
│  Server-side: fetchApi() ── Bearer token from cookies    │
│  Client-side: fetchWithAuth() ── Bearer token from state │
│                                                          │
│  Pages: /apps, /keywords, /competitors, /categories,     │
│         /features, /settings, /system-admin/*            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Coolify Setup

**Coolify URL:** `http://5.78.101.102:8000`
**Server IP:** `5.78.101.102`
**SSH:** `ssh root@5.78.101.102`

### Coolify Services

| Service | Dockerfile | Domain | Port |
|---------|-----------|--------|------|
| Dashboard | `Dockerfile.dashboard` | `https://appranks.io` | 3000 |
| API | `Dockerfile.api` | `https://api.appranks.io` | 3001 |
| Worker | `Dockerfile.worker` | (none) | (none) |
| PostgreSQL | Coolify one-click | Internal | 5432 |
| Redis | Coolify one-click | Internal | 6379 |

### Docker Container Names (on server)

```bash
# List all containers
docker ps --format '{{.Names}} {{.Image}}'

# Key containers:
# uwgokc8cs4g4ws0sk8w8o000  → PostgreSQL
# wogc40wg0kc4gk084kg8cg00  → Redis
# coolify-proxy              → Traefik (reverse proxy)
```

---

## Dockerfiles

### Dockerfile.api
- **Base:** node:20-alpine
- **Build:** `tsc` for shared → db (tsconfig.build.json) → api
- **Production:** `npm ci --omit=dev`, copies dist + migrations + drizzle.config.ts
- **CMD:** `node apps/api/dist/index.js`
- **Startup:** Auto-migration → Auto-seed admin → Fastify server

### Dockerfile.dashboard
- **Base:** node:20-alpine
- **Build arg:** `NEXT_PUBLIC_API_URL` (baked into client-side code at build time)
- **Build:** `tsc` for shared → db → `npm run build` in dashboard
- **Production:** Standalone output, runs as `nextjs` user (non-root)
- **CMD:** `node apps/dashboard/server.js`

### Dockerfile.worker
- **Base:** node:20-alpine
- **Build:** `tsc` for shared → db → scraper
- **Production:** `npm ci --omit=dev`, copies dist only
- **CMD:** `sh -c "node apps/scraper/dist/worker.js & node apps/scraper/dist/scheduler.js & wait"`
- **Dual process:** Worker (job consumer) + Scheduler (cron job enqueuer)

### Common Build Pattern
All Dockerfiles use `npm ci --include=dev` in the build stage (overrides Coolify's NODE_ENV=production) and `npm ci --omit=dev` in the production stage. The db package uses `tsconfig.build.json` which excludes `src/scripts/` from compilation.

---

## Environment Variables

### API (Coolify env)
```
DATABASE_URL=postgresql://postgres:PASSWORD@POSTGRES_INTERNAL_HOST:5432/postgres
REDIS_URL=redis://REDIS_INTERNAL_HOST:6379
JWT_SECRET=<random-64-char-string>
ADMIN_EMAIL=admin@appranks.io
ADMIN_PASSWORD=<strong-password>
PORT=3001
NODE_ENV=production
```

### Dashboard (Coolify env + build arg)
```
NEXT_PUBLIC_API_URL=https://api.appranks.io   # Also set as Build Arg!
NODE_ENV=production
```

### Worker (Coolify env)
```
DATABASE_URL=postgresql://postgres:PASSWORD@POSTGRES_INTERNAL_HOST:5432/postgres
REDIS_URL=redis://REDIS_INTERNAL_HOST:6379
SCRAPER_DELAY_MS=2000
SCRAPER_MAX_CONCURRENCY=2
NODE_ENV=production
```

> **Important:** `NEXT_PUBLIC_API_URL` must be set as both an environment variable AND a build argument in Coolify for the Dashboard, because Next.js bakes public env vars at build time.

---

## Database

### Auto-Migration
API runs pending drizzle-orm migrations on every startup:
```typescript
await migrate(db, { migrationsFolder: "packages/db/src/migrations" });
```
Already-applied migrations are skipped automatically.

### Auto-Seed
On first startup (when no accounts exist), API creates:
- **Default Account** (100 apps, 100 keywords, 50 competitors limits)
- **Admin user** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (system admin, owner role)

### Manual DB Access
```bash
# Connect to PostgreSQL
ssh root@5.78.101.102
docker exec -it uwgokc8cs4g4ws0sk8w8o000 psql -U postgres

# Reset database (DESTRUCTIVE!)
docker exec -it uwgokc8cs4g4ws0sk8w8o000 psql -U postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;"
```

### Data Transfer (Local → Production)
```bash
# 1. Dump local DB
pg_dump -U postgres -d shopify_tracking --clean --if-exists > /tmp/shopify_dump.sql

# 2. Reset production DB
ssh root@5.78.101.102 "docker exec -i uwgokc8cs4g4ws0sk8w8o000 psql -U postgres -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;'"

# 3. Restore to production
cat /tmp/shopify_dump.sql | ssh root@5.78.101.102 "docker exec -i uwgokc8cs4g4ws0sk8w8o000 psql -U postgres"
```

---

## Scheduler (Cron Jobs)

| Job | Schedule (UTC) | Description |
|-----|---------------|-------------|
| category | `0 3 * * *` | Daily at 03:00 |
| app_details | `0 */6 * * *` | Every 6 hours |
| keyword_search | `0 0,12 * * *` | Every 12 hours |
| reviews | `0 6,18 * * *` | Every 12 hours |
| featured_apps | `0 4 * * *` | Daily at 04:00 |
| daily_digest | `0 5 * * *` | Daily at 05:00 (08:00 Istanbul) |

---

## DNS (Namecheap)

| Type | Host | Value |
|------|------|-------|
| A | @ | 5.78.101.102 |
| A | api | 5.78.101.102 |

---

## Hetzner Firewall

Open ports: **22** (SSH), **80** (HTTP), **443** (HTTPS), **8000** (Coolify UI) — all TCP

---

## Common Operations

### Deploy (auto or manual)
- **Auto:** Push to `main` branch → Coolify webhook triggers build + deploy
- **Manual:** Coolify UI → Service → Deploy button

### View Logs
```bash
# API logs
ssh root@5.78.101.102 "docker logs <api_container_name> --tail 50"

# Or from Coolify UI → Service → Logs tab
```

### Restart a Service
Coolify UI → Service → Restart button

### Check Container Status
```bash
ssh root@5.78.101.102 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ERR_MODULE_NOT_FOUND` | Missing `.js` extension in ESM imports | Add `.js` to relative imports in schema files |
| `npm ci` skips devDependencies | Coolify sets NODE_ENV=production at build time | Use `npm ci --include=dev` in Dockerfile build stage |
| `tsc: not found` or wrong `tsc` package | `npx tsc` installs wrong package | Use `./node_modules/.bin/tsc -p <path>` |
| Migration varchar→timestamp fails | PostgreSQL can't auto-cast | Add `USING column::timestamp` clause |
| "no available server" in browser | Traefik can't route to container | Check container is running, domain matches Coolify config |
| "Not Secure" warning | Domain set as `http://` in Coolify | Change to `https://` in Coolify domain settings |
| DB "relation does not exist" | Tables not created | API auto-migrates on startup, just redeploy |

---

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile.api` | API Docker build |
| `Dockerfile.dashboard` | Dashboard Docker build |
| `Dockerfile.worker` | Worker + Scheduler Docker build |
| `docker-compose.prod.yml` | Local production testing |
| `.env.prod.example` | Environment variable reference |
| `.dockerignore` | Docker build exclusions |
| `packages/db/tsconfig.build.json` | DB build config (excludes scripts/) |
| `apps/dashboard/next.config.ts` | Next.js standalone output |
| `apps/api/src/index.ts` | API entry (migration + seed + server) |
| `apps/scraper/src/scheduler.ts` | Cron job definitions |
| `apps/scraper/src/worker.ts` | BullMQ job consumer |
