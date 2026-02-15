# Shopify App Store Tracking Tool - Implementation Plan

## Context

Shopify app developer olarak pazardaki boşlukları, fırsatları ve rakipleri takip etmek için bir araç geliştiriyoruz. Kategori, keyword ve app bazlı tracking yaparak data-driven kararlar alınmasını sağlayacak.

Proje 4 ana modülden oluşuyor: **Scraper**, **Data Enhancer** (MVP sonrası), **Dashboard**, **Admin**.

Mevcut durum: Greenfield proje. Sadece `files/SHOPIFY_DATA_STRUCTURE.md` dokümanı mevcut, kod yok.

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Runtime | Node.js + TypeScript |
| Scraping | Cheerio (HTML parsing) + Playwright (fallback) |
| API | Fastify |
| Database | PostgreSQL + Drizzle ORM |
| Job Queue | BullMQ + Redis |
| Scheduler | node-cron |
| Dashboard | Next.js (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Monorepo | Turborepo |
| Dev infra | Docker Compose (PostgreSQL + Redis) |

---

## Proje Yapısı

```
shopify-tracking/
├── package.json                    # Root workspace
├── turbo.json                      # Build orchestration
├── docker-compose.yml              # PostgreSQL + Redis
├── .env.example
│
├── packages/
│   ├── db/                         # Database schema & client
│   │   ├── src/schema/             # Drizzle table definitions
│   │   ├── src/migrations/         # SQL migrations
│   │   └── src/index.ts            # DB client export
│   │
│   └── shared/                     # Types, constants, utilities
│       ├── src/types/              # CategoryNode, AppDetails, etc.
│       ├── src/constants/          # Seed categories, URL builders
│       └── src/utils/              # Rate limiter, slug helpers
│
└── apps/
    ├── scraper/                    # Scraper service
    │   ├── src/parsers/            # HTML -> typed objects
    │   ├── src/scrapers/           # Orchestration logic
    │   ├── src/jobs/               # BullMQ job handlers
    │   ├── src/http-client.ts      # Fetch with retry & rate limit
    │   ├── src/queue.ts            # Queue definitions
    │   ├── src/worker.ts           # BullMQ workers
    │   └── src/scheduler.ts        # Cron schedules
    │
    ├── api/                        # REST API (Fastify)
    │   ├── src/routes/             # categories, apps, keywords, admin
    │   └── src/middleware/         # auth, error handling
    │
    └── dashboard/                  # Next.js frontend
        ├── src/app/                # Pages (categories, apps, keywords, admin)
        ├── src/components/         # Charts, tables, layout
        └── src/lib/                # API client
```

---

## Database Schema

Temel prensip: Her scrape çalışması bir **snapshot** oluşturur. Tarihsel karşılaştırma snapshot'lar üzerinden yapılır.

### Tablolar

**`scrape_runs`** - Her scraper çalışmasının kaydı
- `id` (uuid PK), `scraper_type` (enum: category/app_details/keyword_search/reviews), `status` (pending/running/completed/failed), `started_at`, `completed_at`, `metadata` (jsonb), `error`

**`categories`** - Master kategori kayıtları
- `id`, `slug` (unique), `title`, `url`, `parent_slug` (FK), `category_level` (0-4), `description`, `is_tracked`, timestamps

**`category_snapshots`** - Kategori başına tarihsel veri
- `id`, `category_slug` (FK), `scrape_run_id` (FK), `scraped_at`, `data_source_url`, `app_count`, `first_page_metrics` (jsonb), `first_page_apps` (jsonb), `breadcrumb`
- Index: `(category_slug, scraped_at DESC)`

**`apps`** - Master app kayıtları
- `id`, `slug` (unique), `name`, `is_tracked`, timestamps

**`app_snapshots`** - App başına tarihsel detaylar
- `id`, `app_slug` (FK), `scrape_run_id` (FK), `scraped_at`, `title`, `description`, `pricing`, `average_rating`, `rating_count`, `developer` (jsonb), `languages` (jsonb), `works_with` (jsonb), `categories` (jsonb), `pricing_tiers` (jsonb)
- Index: `(app_slug, scraped_at DESC)`

**`reviews`** - Append-only, deduplicated
- `id`, `app_slug` (FK), `review_date`, `content`, `reviewer_name`, `reviewer_country`, `duration_using_app`, `rating`, `developer_reply_date`, `developer_reply_text`, `first_seen_run_id`
- Unique: `(app_slug, reviewer_name, review_date, content hash)`

**`tracked_keywords`** - Takip edilen keywordler
- `id`, `keyword` (unique), `is_active`, timestamps

**`keyword_snapshots`** - Keyword başına arama sonuçları
- `id`, `keyword_id` (FK), `scrape_run_id` (FK), `scraped_at`, `total_results`, `results` (jsonb: position, app_slug, name, rating, etc.)
- Index: `(keyword_id, scraped_at DESC)`

**`app_category_rankings`** - App'in kategori içindeki pozisyon takibi
- `app_slug`, `category_slug`, `scrape_run_id`, `scraped_at`, `position`

**`app_keyword_rankings`** - App'in keyword'deki pozisyon takibi
- `app_slug`, `keyword_id`, `scrape_run_id`, `scraped_at`, `position`

---

## MVP Kapsam

### Dahil
- Kategori ağacı scraper (6 root, 5 seviye derinlik, snapshot'larla)
- App detay scraper (tracked app'ler için)
- Keyword arama scraper (tracked keyword'ler için)
- Review scraper (sadece son sayfa, backfill yok)
- Tüm DB tabloları + snapshot/history desteği
- API: tüm read endpoint'leri + admin CRUD
- Dashboard: kategori tablosu, app detay (chart'larla), keyword ranking'ler, admin panel
- Zamanlanmış scraping (günlük kategori, 6 saatte bir app, 12 saatte bir keyword)

### MVP Sonrası
- Data Enhancer modülü (AI analiz, trend detection)
- Feature-filtered sayfa scraping (`feature_handles[]`)
- Proxy rotation / anti-bot
- Multi-user auth (başlangıçta tek API key)
- Email/Slack alertler
- Full review backfill
- Export/download

---

## Implementation Phases

### Phase 1: Foundation
1. Monorepo init (Turborepo, workspace'ler)
2. `docker-compose.yml` (PostgreSQL + Redis)
3. `packages/shared` - tipler (`SHOPIFY_DATA_STRUCTURE.md`'den)
4. `packages/db` - Drizzle schema, migration, seed
5. `apps/scraper/src/http-client.ts` - rate limit, retry, UA rotation
6. `apps/scraper/src/parsers/category-parser.ts` - en karmaşık parser
7. `apps/scraper/src/scrapers/category-scraper.ts` - tam ağaç tarama
8. Test: scraper çalıştır, DB'de veriyi doğrula

### Phase 2: Remaining Scrapers
1. `app-parser.ts` + `app-details-scraper.ts`
2. `search-parser.ts` + `keyword-scraper.ts`
3. `review-parser.ts` + `review-scraper.ts`
4. BullMQ queue'lar ve worker'lar
5. node-cron scheduler
6. Seed data ile test

### Phase 3: API
1. Fastify app setup
2. Read endpoint'leri (categories, apps, keywords, reviews, rankings, history)
3. Admin endpoint'leri (CRUD tracked items, scraper trigger)
4. API key auth middleware
5. Zod validation

### Phase 4: Dashboard
1. Next.js + shadcn/ui + Tailwind setup
2. Layout (sidebar, header)
3. Kategori browser sayfası (sortable table)
4. App list + detail sayfaları (Recharts ile history chart'lar)
5. Keyword tracking sayfası
6. Admin panel (tracked items CRUD, scraper status)

### Phase 5: Polish
1. Structured logging, hata yönetimi
2. Parser resilience (fallback selector'lar, warning log'ları)
3. Data freshness göstergeleri
4. DB index optimizasyonu
5. README ve setup guide

---

## Scraper Detayları

### Rate Limiting
- Request arası minimum 2 saniye bekleme
- Maksimum 2 eşzamanlı request
- Gerçekçi User-Agent string'leri
- `robots.txt` saygısı

### Parser Stratejisi
- Her parser Cheerio ile HTML parse eder
- Birden fazla CSS selector stratejisi (fallback)
- Element bulunamazsa hata yerine warning log
- Debug için raw HTML hash'i saklama

### Snapshot vs Append
- Kategoriler ve app detayları: **Snapshot** (her çalışmada yeni satır)
- Review'lar: **Append-only** (deduplicate ile tek seferlik ekleme)
- Ranking'ler: Snapshot'lardan türetilmiş derived data

---

## API Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/categories` | Tüm kategoriler (tree veya flat) |
| GET | `/api/categories/:slug` | Kategori + son snapshot |
| GET | `/api/categories/:slug/history` | Tarihsel snapshot'lar |
| GET | `/api/apps` | Tracked app'ler listesi |
| GET | `/api/apps/:slug` | App detay + son snapshot |
| GET | `/api/apps/:slug/history` | App tarihsel verileri |
| GET | `/api/apps/:slug/reviews` | App review'ları |
| GET | `/api/apps/:slug/rankings` | Kategori + keyword ranking history |
| GET | `/api/keywords` | Tracked keyword'ler |
| GET | `/api/keywords/:id/rankings` | Keyword ranking history |
| POST | `/api/admin/tracked-apps` | App tracking'e ekle |
| DELETE | `/api/admin/tracked-apps/:slug` | App tracking'den çıkar |
| POST | `/api/admin/tracked-keywords` | Keyword ekle |
| DELETE | `/api/admin/tracked-keywords/:id` | Keyword çıkar |
| POST | `/api/admin/scraper/trigger` | Manuel scraper tetikle |
| GET | `/api/admin/scraper/runs` | Son çalışma kayıtları |

---

## Dashboard Sayfaları

1. **Overview** (`/`) - Özet: tracked item sayıları, son scrape zamanları, alertler
2. **Categories** (`/categories`) - Ağaç görünümü, sortable tablo (app_count, metrics)
3. **Category Detail** (`/categories/[slug]`) - Tarihsel chart'lar, first-page app'ler
4. **Apps** (`/apps`) - Tracked app tablosu, sparkline'lar
5. **App Detail** (`/apps/[slug]`) - Detaylar, rating/review/ranking chart'ları
6. **Keywords** (`/keywords`) - Keyword tablosu, top app'ler
7. **Keyword Detail** (`/keywords/[id]`) - Ranking chart (tracked app'lerin pozisyonları)
8. **Admin** (`/admin`) - Tracked items CRUD, scraper kontrol paneli

---

## Kritik Dosyalar (Referans)

- `files/SHOPIFY_DATA_STRUCTURE.md` - Tüm data yapılarının kaynağı. Parser, schema, type tanımları bu dosyayla uyumlu olmalı.
- `packages/db/src/schema/` - DB schema dosyaları, mimari omurga
- `apps/scraper/src/parsers/category-parser.ts` - En karmaşık parser, iki sayfa tipi (ana sayfa vs `/all`), metrik hesaplama, recursive subcategory keşfi
- `apps/scraper/src/http-client.ts` - Rate limiting ve retry ayarları kritik, yanlış ayar IP block riski

---

## Verification

1. **Scraper testi**: Her scraper'ı tek seferlik çalıştır, DB'deki veriyi PostgreSQL'de sorgula
2. **API testi**: Her endpoint'i curl/Postman ile test et, response'ların schema'ya uyumunu doğrula
3. **Dashboard testi**: Tüm sayfaları tarayıcıda aç, veri gösterimini doğrula, chart'ların tarihsel veriyi doğru gösterdiğini kontrol et
4. **Scheduler testi**: Cron job'ların doğru zamanda tetiklendiğini log'lardan doğrula
5. **E2E flow**: Admin'den app ekle → scraper tetikle → API'den veriyi çek → dashboard'da gör
