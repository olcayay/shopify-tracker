# Shopify App Store Tracker

Shopify App Store'daki uygulamaları, kategorileri ve keyword'leri takip eden bir araç. Kategori, keyword ve app bazlı tracking yaparak data-driven kararlar almayı sağlar. Multi-user desteği ile her hesap kendi app/keyword/competitor'larını bağımsız olarak takip eder.

## Architecture

Turborepo monorepo with 3 apps and 2 shared packages:

```
packages/
  shared/       Types, URL builders, constants, logger
  db/           Drizzle ORM schema, migrations, DB client

apps/
  scraper/      Cheerio-based scrapers + CLI + BullMQ worker + cron scheduler
  api/          Fastify REST API (JWT auth, role-based access)
  dashboard/    Next.js 16 frontend (shadcn/ui, Recharts)
```

### Key Design Decision

Scrape edilen data (snapshots, rankings, reviews, categories) **global** kalır. Sadece "neyi takip et" kararı hesap bazlıdır. Bu sayede scraper mimarisi değişmeden multi-user desteği sağlanır.

## Prerequisites

- Node.js >= 20
- Docker (for PostgreSQL & Redis)

## Setup

```bash
# 1. Clone and install
npm install

# 2. Start services
docker compose up -d

# 3. Copy env file
cp .env.example .env

# 4. Build packages
npm run build

# 5. Run database migrations
npx drizzle-kit migrate --config=packages/db/drizzle.config.ts
```

## Running

### Scraper CLI

```bash
# Crawl full category tree
npm run scrape:categories -w apps/scraper

# Scrape a single app
npm run scrape:app -w apps/scraper -- formful

# Scrape all tracked apps
cd apps/scraper && npx tsx src/cli.ts app-tracked

# Scrape keyword search results
npm run scrape:keyword -w apps/scraper -- "form builder"

# Scrape all tracked keywords
cd apps/scraper && npx tsx src/cli.ts keyword-tracked

# Scrape reviews for an app
npm run scrape:reviews -w apps/scraper -- formful

# Scrape reviews for all tracked apps
cd apps/scraper && npx tsx src/cli.ts reviews-tracked

# Track an app or keyword
cd apps/scraper && npx tsx src/cli.ts track-app formful
cd apps/scraper && npx tsx src/cli.ts track-keyword "form builder"
```

### API Server

```bash
npm run dev -w apps/api
# Runs on http://localhost:3001
```

### Worker (BullMQ Job Processor)

```bash
npm run worker -w apps/scraper
# Processes scraper jobs from the Redis queue
# Only 1 job at a time to respect rate limits
```

### Scheduler (Cron Jobs)

```bash
npm run scheduler -w apps/scraper
# Enqueues scraper jobs on a schedule:
#   Categories:   daily at 03:00
#   App Details:  every 6 hours
#   Keywords:     every 12 hours (00:00, 12:00)
#   Reviews:      every 12 hours (06:00, 18:00)
```

### Dashboard

```bash
npm run dev -w apps/dashboard
# Runs on http://localhost:3000
```

### Production (All Services)

```bash
# Start all services:
docker compose up -d           # PostgreSQL + Redis
npm run dev -w apps/api        # API server
npm run worker -w apps/scraper # Job processor
npm run scheduler -w apps/scraper  # Cron scheduler
npm run dev -w apps/dashboard  # Dashboard
```

## Authentication & Authorization

### JWT-Based Auth

Tüm API endpoint'leri (public path'ler hariç) JWT authentication gerektirir.

- **Access token**: 15 dakika ömürlü, `Authorization: Bearer <token>` header'ı ile gönderilir
- **Refresh token**: 7 gün ömürlü, DB'de SHA256 hash olarak saklanır, token rotation uygulanır
- **Public paths**: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/invitations/*`

### Roller

| Rol | Yetkiler |
|-----|----------|
| **owner** | Tam yetki: üye davet/çıkar, rol değiştir, hesap ayarları, tracking CRUD |
| **editor** | Tracking CRUD (app/keyword/competitor ekle-çıkar) |
| **viewer** | Sadece okuma yetkisi |
| **system admin** | `isSystemAdmin` flag'i ile tüm hesapları yönetme, scraper kontrol |

### Auth Flow

1. `POST /api/auth/register` → Yeni hesap + owner user oluşturur → JWT döner
2. `POST /api/auth/login` → Email + password → access + refresh token
3. `POST /api/auth/refresh` → Refresh token → yeni access token (rotation)
4. `GET /api/auth/me` → Mevcut user + hesap bilgisi + limit/usage
5. `POST /api/auth/logout` → Refresh token iptal

### Invitation Flow

1. Owner `POST /api/account/members/invite` ile email + rol belirterek davet oluşturur (7 gün geçerli)
2. Davetli `GET /api/invitations/:token` ile davet bilgilerini görür
3. Davetli `POST /api/invitations/accept/:token` ile name + password göndererek hesaba katılır

## API Endpoints

Tüm endpoint'ler (auth hariç) `Authorization: Bearer <token>` header'ı gerektirir.

### Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Yeni hesap + owner user oluştur |
| POST | `/api/auth/login` | Email + password ile giriş |
| POST | `/api/auth/refresh` | Refresh token ile yeni access token al |
| POST | `/api/auth/logout` | Refresh token iptal et |
| GET | `/api/auth/me` | Mevcut user + hesap + limit/usage bilgisi |

### Account Management (`/api/account`)

| Method | Path | Rol | Description |
|--------|------|-----|-------------|
| GET | `/api/account` | any | Hesap detayları + limitler + kullanım |
| PUT | `/api/account` | owner | Hesap adı güncelle |
| GET | `/api/account/members` | any | Hesaptaki kullanıcılar |
| POST | `/api/account/members/invite` | owner | Üye davet et (email + rol) |
| DELETE | `/api/account/members/:userId` | owner | Üye çıkar |
| PATCH | `/api/account/members/:userId/role` | owner | Üye rolü değiştir |
| GET | `/api/account/tracked-apps` | any | Hesabın tracked app'leri |
| POST | `/api/account/tracked-apps` | owner, editor | App tracking'e ekle (limit kontrolü) |
| DELETE | `/api/account/tracked-apps/:slug` | owner, editor | App tracking'den çıkar |
| GET | `/api/account/tracked-keywords` | any | Hesabın keyword'leri |
| POST | `/api/account/tracked-keywords` | owner, editor | Keyword ekle (limit kontrolü) |
| DELETE | `/api/account/tracked-keywords/:id` | owner, editor | Keyword çıkar |
| GET | `/api/account/competitors` | any | Hesabın rakip app'leri |
| POST | `/api/account/competitors` | owner, editor | Rakip app ekle (limit kontrolü) |
| DELETE | `/api/account/competitors/:slug` | owner, editor | Rakip app çıkar |

### Data Endpoints (Account-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apps` | Hesabın tracked app'leri (account scope) |
| GET | `/api/apps/search?q=` | App adına göre arama (tüm app'ler) |
| GET | `/api/apps/:slug` | App detay + latest snapshot + `isTrackedByAccount` |
| GET | `/api/apps/:slug/history` | App historical data |
| GET | `/api/apps/:slug/reviews` | App reviews (sorted, paginated) |
| GET | `/api/apps/:slug/rankings` | Category + keyword ranking history (breadcrumb dahil) |
| GET | `/api/keywords` | Hesabın tracked keyword'leri (account scope) |
| GET | `/api/keywords/search?q=` | Keyword arama (tüm keyword'ler) |
| GET | `/api/keywords/:slug` | Keyword detay + latest snapshot |
| GET | `/api/keywords/:slug/rankings` | Keyword ranking history |
| GET | `/api/categories` | Tüm kategoriler (tree veya flat) — global |
| GET | `/api/categories/:slug` | Kategori + latest snapshot |
| GET | `/api/categories/:slug/history` | Historical snapshots |

### Invitations (`/api/invitations`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invitations/:token` | Davet bilgilerini göster |
| POST | `/api/invitations/accept/:token` | Daveti kabul et (name + password) |

### System Admin (`/api/system-admin`)

`isSystemAdmin` flag'i gerektirir.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/system-admin/accounts` | Tüm hesaplar + usage stats |
| GET | `/api/system-admin/accounts/:id` | Hesap detay + members + tracked items |
| PATCH | `/api/system-admin/accounts/:id` | Hesap güncelle (limitler, suspend) |
| DELETE | `/api/system-admin/accounts/:id` | Hesap sil |
| GET | `/api/system-admin/accounts/:id/members` | Hesaptaki kullanıcılar |
| GET | `/api/system-admin/users` | Tüm kullanıcılar |
| GET | `/api/system-admin/scraper/runs` | Scraper çalışma kayıtları |
| POST | `/api/system-admin/scraper/trigger` | Scraper tetikle |
| GET | `/api/system-admin/stats` | Global sistem istatistikleri |

## Database

PostgreSQL 16 with Drizzle ORM. 17 tables using a snapshot pattern for historical tracking:

### Scraping & Data Tables (Global)

- **scrape_runs** - Her scraper çalışma kaydı
- **categories** / **category_snapshots** - Kategori ağacı + snapshot geçmişi
- **apps** / **app_snapshots** - App kayıtları + snapshot geçmişi
- **reviews** - Append-only review verisi (deduplication)
- **tracked_keywords** / **keyword_snapshots** - Keyword tracking + arama sonuç snapshot'ları
- **app_category_rankings** / **app_keyword_rankings** - Pozisyon takibi

### Auth & Multi-User Tables

- **accounts** - Hesaplar (name, limitler: maxTrackedApps/maxTrackedKeywords/maxCompetitorApps, isSuspended)
- **users** - Kullanıcılar (email, passwordHash, accountId FK, role: owner/editor/viewer, isSystemAdmin)
- **invitations** - Davetler (accountId, email, role, token, expiresAt, acceptedAt)
- **refresh_tokens** - JWT refresh token hash'leri (userId FK cascade delete, expiresAt)

### Account-Scoped Junction Tables

- **account_tracked_apps** - Hesap ↔ App ilişkisi (accountId + appSlug unique)
- **account_tracked_keywords** - Hesap ↔ Keyword ilişkisi (accountId + keywordId unique)
- **account_competitor_apps** - Hesap ↔ Rakip App ilişkisi (accountId + appSlug unique)

### Data Sync

Account tracking tabloları değiştiğinde, global flag'ler senkronize edilir:
- Herhangi bir hesap tarafından track edilen app → `apps.isTracked = true`
- Herhangi bir hesap tarafından track edilen keyword → `trackedKeywords.isActive = true`
- Hiçbir hesap track etmiyorsa → flag `false` olur

Bu sayede scraper kodu değişmeden çalışır (sadece `isTracked`/`isActive` flag'lerine bakar).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Scraping | Cheerio |
| API | Fastify 5 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Dashboard | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts |
| Job Queue | BullMQ + Redis |
| Scheduler | node-cron |
| Monorepo | Turborepo |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Infra | Docker Compose |

## Environment Variables

See [.env.example](.env.example) for all variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/shopify_tracking` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection (job queue) |
| `API_PORT` | `3001` | API server port |
| `API_KEY` | — | Legacy API key (scraper CLI için) |
| `JWT_SECRET` | — | JWT token imzalama secret'ı |
| `ADMIN_EMAIL` | `admin@example.com` | Seed script: system admin email |
| `ADMIN_PASSWORD` | — | Seed script: system admin password |
| `SCRAPER_DELAY_MS` | `2000` | Delay between HTTP requests (ms) |
| `SCRAPER_MAX_CONCURRENCY` | `2` | Max concurrent HTTP requests |

## Dashboard Pages

| Path | Description |
|------|-------------|
| `/login` | Email + password giriş formu |
| `/register` | Kayıt formu (name, email, password, account name) |
| `/invite/accept/[token]` | Davet kabul sayfası |
| `/` | Overview — hesap usage summary |
| `/apps` | Tracked app'ler listesi + app arama/track |
| `/apps/[slug]` | App detay (snapshot, rankings, reviews) + track/untrack |
| `/keywords` | Tracked keyword'ler + keyword arama/track |
| `/keywords/[slug]` | Keyword detay (snapshot, rankings) + track/untrack |
| `/categories` | Kategori ağacı (global) |
| `/categories/[slug]` | Kategori detay (first page apps, history) |
| `/settings` | Hesap ayarları + üye yönetimi (owner) + limit/usage |
| `/system-admin` | Hesap listesi, kullanıcılar, scraper kontrol (sadece system admin) |
| `/system-admin/accounts/[id]` | Hesap detay (members, tracked items, limit düzenleme) |
