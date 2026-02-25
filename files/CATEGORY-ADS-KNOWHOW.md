# Category Ad Sightings — Know-How

## Overview
Shopify app store category pages can display sponsored (paid) apps alongside organic listings. We track which apps advertise in which categories with daily history.

## How Shopify Displays Category Ads

### Ad Detection Methods
1. **URL parameter** (`surface_type=category_ad`): Shopify adds this to the `data-app-card-app-link-value` attribute on sponsored app cards. This is the primary detection signal.
2. **Disclaimer text**: Sponsored cards contain text like "app developer paid to promote" or "This ad is based on". Used as a fallback detection method.

### Data Center IP Limitation (Critical)
- **Category pages**: Shopify **completely hides** ads from data center IPs. No URL parameter, no disclaimer text — the HTML contains zero ad markers. Sponsored apps simply don't appear in the response.
- **Search/keyword pages**: Shopify **does show** ads to data center IPs. `surface_type=search_ad` is present in the HTML.

This means:
- **Keyword ad sightings** work from any server
- **Category ad sightings** only work from residential/consumer IPs (e.g., local machine, residential proxy)

### Verified on 2026-02-24
- Server (Hetzner data center IP): `hasAdUrl: false, hasAdText: false` — zero ad markers in HTML
- Local machine (residential IP): 4-5 sponsored apps detected with `surface_type=category_ad`

## Architecture

### Database
- Table: `category_ad_sightings`
- Schema: `packages/db/src/schema/category-ad-sightings.ts`
- Migration: `packages/db/src/migrations/0032_category_ad_sightings.sql`
- Columns: `id`, `app_slug`, `category_slug`, `seen_date`, `first_seen_run_id`, `last_seen_run_id`, `times_seen_in_day`
- Unique index on `(app_slug, category_slug, seen_date)` — upsert increments `times_seen_in_day`
- Secondary indexes: `(category_slug, seen_date)` and `(app_slug, seen_date)`

### Scraper
- File: `apps/scraper/src/scrapers/category-scraper.ts`
- Method: `recordCategoryAdSightings()` — filters `is_sponsored` apps, upserts into DB
- Called for first page and each additional page during category scrape
- Detection in parser: `apps/scraper/src/parsers/category-parser.ts` — checks `surface_type=category_ad`, `surface_type=search_ad`, and `isAdText()` fallback

### API Endpoints
- `GET /api/categories/:slug/ads?days=30` — ad sightings for a category (returns app slugs, names, icons, dates)
- `GET /api/apps/:slug/category-ad-sightings?days=30` — which categories an app advertises in

### Dashboard
- Category page (`/categories/[slug]`): "Sponsored Apps" section with `AdHeatmap` component
- App Ads page (`/apps/[slug]/ads`): "Category Ad History" card alongside "Keyword Ad History"
- Both have empty state messages when no data

## Solutions for Data Center IP Issue

### Option 1: Local Scraping (Free, Manual)
Run category scraper from local machine pointing to production DB:
```bash
DATABASE_URL=postgresql://user:pass@server:5432/shopify_tracking npx tsx src/cli.ts categories store-management-support-chat
```
Pros: Free, works immediately
Cons: Manual, requires local machine to be on

### Option 2: Residential Proxy ($15-50/month)
Services: Bright Data, Oxylabs, Smartproxy
Add proxy support to `HttpClient` for category scrapes.
Pros: Automated, reliable
Cons: Monthly cost

### Option 3: Accept Limitation
Keyword ad tracking already works from the server. Category ad tracking infrastructure is ready — will work automatically once a residential IP or proxy is available.

## Debugging Checklist
1. Check if `category_ad_sightings` table exists: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_ad_sightings');`
2. Check row count: `SELECT COUNT(*) FROM category_ad_sightings;`
3. Check scrape run metadata for `category_ad_sightings` count
4. Worker logs: look for `"recording category ad sightings"` with `sponsoredCount`
5. Worker logs: look for `"ad markers in HTML"` with `hasAdUrl` and `hasAdText`
6. If `sponsoredCount: 0` → Shopify is hiding ads from the server IP
7. Test API: `GET /api/categories/{slug}/ads` — should return `{ adSightings: [...] }`

## Migration Notes
- The `_journal.json` must include ALL migration SQL files that exist on disk. Missing entries cause drizzle-orm's `migrate()` to fail silently (error is caught in API startup).
- Migrations 0023-0031 were previously applied manually on the server but were missing from the journal. This caused migration 0032 (category_ad_sightings) to not be applied on deploy. Fixed by adding all missing journal entries.
- API startup migration errors changed from `console.warn` to `console.error` for visibility.
