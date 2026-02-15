# Shopify App Store Tracker

Shopify App Store'daki uygulamaları, kategorileri ve keyword'leri takip eden bir araç. Kategori, keyword ve app bazlı tracking yaparak data-driven kararlar almayı sağlar.

## Architecture

Turborepo monorepo with 3 apps and 2 shared packages:

```
packages/
  shared/       Types, URL builders, constants, logger
  db/           Drizzle ORM schema, migrations, DB client

apps/
  scraper/      Cheerio-based scrapers + CLI + BullMQ worker + cron scheduler
  api/          Fastify REST API
  dashboard/    Next.js 16 frontend (shadcn/ui, Recharts)
```

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | All categories (tree or flat) |
| GET | `/api/categories/:slug` | Category + latest snapshot |
| GET | `/api/categories/:slug/history` | Historical snapshots |
| GET | `/api/apps` | Tracked apps list |
| GET | `/api/apps/:slug` | App detail + latest snapshot |
| GET | `/api/apps/:slug/history` | App historical data |
| GET | `/api/apps/:slug/reviews` | App reviews (sorted, paginated) |
| GET | `/api/apps/:slug/rankings` | Category + keyword ranking history |
| GET | `/api/keywords` | Tracked keywords |
| GET | `/api/keywords/:id` | Keyword detail + latest snapshot |
| GET | `/api/keywords/:id/rankings` | Keyword ranking history |
| POST | `/api/admin/tracked-apps` | Add app to tracking |
| DELETE | `/api/admin/tracked-apps/:slug` | Remove app from tracking |
| POST | `/api/admin/tracked-keywords` | Add keyword |
| DELETE | `/api/admin/tracked-keywords/:id` | Remove keyword |
| POST | `/api/admin/scraper/trigger` | Trigger scraper manually |
| GET | `/api/admin/scraper/runs` | Recent scraper runs |
| GET | `/api/admin/stats` | Overview stats + freshness |

Admin endpoints require `x-api-key` header matching the `API_KEY` env var.

## Database

PostgreSQL 16 with Drizzle ORM. 10 tables using a snapshot pattern for historical tracking:

- **scrape_runs** - Each scraper execution record
- **categories** / **category_snapshots** - Category tree + per-scrape snapshots
- **apps** / **app_snapshots** - App master records + per-scrape detail snapshots
- **reviews** - Append-only with deduplication
- **tracked_keywords** / **keyword_snapshots** - Keyword tracking + search result snapshots
- **app_category_rankings** / **app_keyword_rankings** - Position tracking

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
| Infra | Docker Compose |

## Environment Variables

See [.env.example](.env.example) for all variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/shopify_tracking` | PostgreSQL connection |
| `API_KEY` | — | API key for admin endpoints |
| `API_PORT` | `3001` | API server port |
| `SCRAPER_DELAY_MS` | `2000` | Delay between HTTP requests (ms) |
| `SCRAPER_MAX_CONCURRENCY` | `2` | Max concurrent HTTP requests |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
