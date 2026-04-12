# Scraping Depth & Pagination Reference

This document describes how deep each cron job scrapes, how many pages it visits, when it stops, and whether it triggers (cascades into) other scraper jobs.

---

## 1. Cron Job Schedule

| Job | Schedule | Frequency | Source |
|-----|----------|-----------|--------|
| **Categories + Featured** | `0 3 * * *` | Daily at 03:00 UTC | `scheduler.ts` |
| **App Details** | `0 1,13 * * *` | Every 12 hours (01:00, 13:00) | `scheduler.ts` |
| **Keyword Search** | `0 0,12 * * *` | Every 12 hours (00:00, 12:00) | `scheduler.ts` |
| **Reviews** | `0 6 * * *` | Daily at 06:00 UTC | `scheduler.ts` |
| **Daily Digest** | `0 5 * * *` | Daily at 05:00 UTC (08:00 Istanbul) | `scheduler.ts` |

All schedules are defined in `apps/scraper/src/scheduler.ts`.

---

## 2. Category Scraper

**Source:** `apps/scraper/src/scrapers/category-scraper.ts`

### Page Depth

| Mode | Pages Per Category | Hard Limit |
|------|--------------------|------------|
| **Cron (default)** | **10** | — |
| `pages: "all"` | Up to **50** | 50 |
| `pages: N` | Up to **N** | N |

### Category Tree Depth

- **6 root categories** (seed): `finding-products`, `selling-products`, `orders-and-shipping`, `store-design`, `marketing-and-conversion`, `store-management`
- **Max recursion depth:** 4 levels (`MAX_CATEGORY_DEPTH = 4` in `packages/shared/src/constants/seed-categories.ts`)
- Recursion only runs in full-crawl mode (not single-category mode)

### Concurrency & Parallelism

| Setting | Value | Config Location |
|---------|-------|----------------|
| **Seed category concurrency** | 2 | `shopify/constants.ts → concurrentSeedCategories` |
| **Subcategory concurrency** | 3 | `category-scraper.ts → runConcurrent(..., 3)` |
| **Page fetching** | Sequential | `category-scraper.ts` (parallel was reverted — overwhelms Shopify) |

Seed categories are processed in batches of 2 (3 batches for 6 seeds). Within each seed, subcategories at each depth level are processed 3 at a time via `runConcurrent`. HttpClient's `waitForSlot()` (250ms delay, max 6 concurrent) provides global rate limiting across all parallel tasks.

### Batch DB Operations

All DB writes use chunked batch inserts (100 rows per chunk) instead of one-by-one:

- **`recordAppRankings()`** → batch upsert apps + batch insert rankings. Returns `slugToIdMap` reused by downstream methods. Deduplicates slugs before insert to avoid "ON CONFLICT cannot affect row twice" errors.
- **`recordCategoryAdSightings()`** → uses `slugToIdMap` from rankings (no extra SELECT queries). Batch insert sightings.
- **`ensureAppRecords()`** → batch upsert for hub pages.
- **`recordFeaturedSightings()`** → deduplicates both app slugs and sighting conflict keys before batch operations.

All batch values use explicit `null` (not `undefined` / spread omission) to ensure consistent column shapes across rows — Drizzle hangs on inconsistent shapes.

### Stop Conditions

1. Reached page limit (default 10)
2. No `<a rel="next">` link found on the page
3. Zero new apps found after deduplication (sponsored apps can repeat across pages)

### Deduplication

Tracks seen app slugs across pages with a `Set`. If a page returns only already-seen apps, pagination stops early.

### Featured Apps (Integrated)

The category scraper also extracts **featured app sections** from the same HTML it already fetches. This replaces the former standalone Featured Apps scraper.

- **Homepage**: Fetched before the category tree crawl begins
- **Category pages (depth 0-2)**: Featured sections parsed from each page
- **Depth 3+**: Skipped (no featured sections at deep levels)
- Uses `parseFeaturedSections()` from `featured-parser.ts`
- Records to `featured_app_sightings` table (app slug, section, position, date)

### Performance

| Metric | Before Optimization | After |
|--------|-------------------|-------|
| **Duration** | 22m 47s | **1m 28s** (93.5% reduction) |
| Categories scraped | ~119 | 119 |
| Rankings recorded | ~6000+ | 6373 |

### Does It Scrape App Details?

**No.** The cron job does not cascade into app detail scraping. It only records which apps appear in which categories and their positions. Cascade can be enabled manually via `scrapeAppDetails: true` option.

---

## 3. Keyword Search Scraper

**Source:** `apps/scraper/src/scrapers/keyword-scraper.ts`

### Page Depth

| Mode | Pages Per Keyword | Hard Limit |
|------|-------------------|------------|
| **Cron (default)** | **10** | — |
| `pages: "first"` | 1 | 1 |
| `pages: "all"` | Up to **20** | 20 |
| `pages: N` | Up to **N** | N |

### Stop Conditions

1. Reached page limit (default 10)
2. `has_next_page` is false (no next button in HTML)

### Concurrency & Rate Limiting

| Setting | Value | Config Location |
|---------|-------|----------------|
| **Keyword concurrency** | 3 | `shopify/constants.ts → keywordConcurrency` |
| **HTTP delay** | 500ms | `shopify/constants.ts → keywordDelayMs` (higher than category's 250ms) |
| **HTTP max concurrency** | 6 | `shopify/constants.ts → httpMaxConcurrency` |
| **Keyword timeout** | 90s | `keyword-scraper.ts → KEYWORD_TIMEOUT_MS` |
| **Page fetching** | Sequential | 10 pages per keyword fetched one at a time |
| **Metadata update** | Every 5 keywords | Reduces DB overhead (was every keyword) |

Keyword concurrency is intentionally kept at 3 (not higher) because:
1. Shopify's search endpoint is more rate-limit sensitive than categories
2. Keywords often return overlapping apps, causing PostgreSQL deadlocks on batch upserts at higher concurrency
3. The `keywordDelayMs: 500` (vs 250ms for categories) provides extra breathing room

### Batch DB Operations

All DB writes use chunked batch inserts (100 rows per chunk) with deadlock retry:

- **Subtitle change detection** → single batch SELECT existing apps + batch SELECT last changes (was: 2 queries per app)
- **Organic app upserts** → batch insert with `withDeadlockRetry()` wrapper (3 attempts, jittered backoff)
- **Rankings** → batch insert with `onConflictDoNothing`
- **Dropped apps** → batch insert null-position rankings
- **Sponsored apps** → batch upsert with deadlock retry + batch insert ad sightings

The `withDeadlockRetry()` helper retries on PostgreSQL deadlock errors (up to 3 attempts with randomized backoff), which can occur when concurrent keywords upsert the same popular apps.

### Deduplication

Maintains separate sets for sponsored and organic app slugs. The same app can appear in both categories. Organic position counter excludes sponsored and built-in apps.

### Dropped App Detection

After scraping, the scraper compares current results against the previous run. Apps that previously had a ranking but are no longer in results get recorded with `position: null` — this is how ranking drops are tracked.

### Performance

| Metric | Before Optimization | After |
|--------|-------------------|-------|
| **Duration** | 9m 36s | **~8m 18s** (14% reduction) |
| Keywords scraped | 78 | 77-78 |
| Failed | 0 | 0-1 |

The smaller improvement compared to categories is because keyword scraper is HTTP-bound (sequential page fetching per keyword, rate-limit-sensitive search endpoint), while category scraper benefited massively from subcategory parallelism.

### Does It Scrape App Details?

**No.** The cron job does not cascade into app detail scraping. Cascade can be enabled manually via `scrapeAppDetails: true` option.

### Keyword Suggestions Cascade

**Yes.** After keyword search completes, it **always** enqueues a `keyword_suggestions` job. This is hardcoded in the worker (not optional).

---

## 4. App Details Scraper

**Source:** `apps/scraper/src/scrapers/app-details-scraper.ts`

### Page Depth

**1 page per app** — fetches the app detail page at `apps.shopify.com/{slug}`.

### Scope

Runs on **tracked apps only** (apps associated with an account).

### 12-Hour Cache

Before scraping, checks the most recent snapshot. If the app was scraped within the last **12 hours**, it is skipped. This prevents redundant scraping when multiple triggers hit the same app.

### What It Collects

- App metadata (name, icon, tagline, pricing, rating, review count)
- Full description, features list
- SEO title and meta description
- Pricing plans
- Developer info
- Languages and integrations
- Similar apps section ("More apps like this") — records position of each similar app

### Change Detection

Compares current values against previous snapshot for: `name`, `appIntroduction`, `appDetails`, `seoTitle`, `seoMetaDescription`, `features`. Changes are recorded in the `app_field_changes` table.

### Does It Scrape Reviews?

**No.** The cron job does not cascade into review scraping. Cascade can be enabled manually via `scrapeReviews: true` option.

---

## 5. Review Scraper

**Source:** `apps/scraper/src/scrapers/review-scraper.ts`

### Page Depth

| Mode | Pages Per App | Hard Limit |
|------|---------------|------------|
| **Cron (default)** | **10** (most recent) | 10 |

Reviews are sorted newest-first by Shopify, so the first 10 pages contain the most recent reviews.

### Scope

Runs on **tracked apps only**.

### Stop Conditions

1. Reached page limit (default 10)
2. Page returns **0 reviews** (empty page)
3. `has_next_page` is false (no next button in HTML)

### Duplicate Handling

Uses `onConflictDoNothing()` on insert — relies on database unique constraints to prevent duplicate reviews. This means it safely re-scrapes pages it has already visited without creating duplicates.

### Note on Sort Order

Shopify defaults to newest-first review ordering. The 10-page limit ensures only the most recent reviews are scraped, keeping HTTP requests predictable.

---

## 6. Keyword Suggestion Scraper

**Source:** `apps/scraper/src/scrapers/keyword-suggestion-scraper.ts`

### Page Depth

**1 request per keyword** — calls the Shopify autocomplete API (`/search/autocomplete?q={keyword}`), which returns a single JSON response.

There is **no pagination**. The response contains all suggestions in one payload.

### What It Collects

- Autocomplete suggestions returned by Shopify's search API
- Filters out suggestions that match the keyword itself (case-insensitive)
- Stores as a JSON array of strings

### Storage

- Table: `keyword_auto_suggestions`
- **One record per keyword** — uses upsert (`onConflictDoUpdate` on `keywordId`)
- Each scrape overwrites the previous suggestions for that keyword
- Fields: `keywordId`, `suggestions` (jsonb array), `scrapedAt`, `scrapeRunId`

### Trigger

Not triggered by a cron job directly. Always cascaded automatically from the `keyword_search` job after it completes.

### Cascade Scoping

- **Full keyword scrape** → suggestions run for **all active keywords**
- **Single keyword scrape** → suggestions run for **only that keyword**

The cascade passes the `keyword` field from the parent job. When undefined (full scrape), `scrapeAll()` runs. When set (single keyword), only that keyword's suggestions are scraped.

---

## 7. Cascade (Chaining) Behavior

Cascade means one scraper job automatically enqueues another job after completion.

### Cascade Map

```
category ──────────────► app_details ──────────────► reviews
  (only if                  (only if
   scrapeAppDetails=true)    scrapeReviews=true)

keyword_search ────────► app_details ──────────────► reviews
  (only if                  (only if
   scrapeAppDetails=true)    scrapeReviews=true)

keyword_search ────────► keyword_suggestions
  (ALWAYS — hardcoded)
```

### Cron Defaults

| Cascade | Enabled in Cron? |
|---------|-----------------|
| Category → App Details | **No** |
| Keyword → App Details | **No** |
| Keyword → Suggestions | **Yes** (always) |
| App Details → Reviews | **No** |

Cascade options (`scrapeAppDetails`, `scrapeReviews`) can be enabled when jobs are triggered manually via API or CLI. The scheduler does **not** pass these options.

---

## 8. Rate Limiting & HTTP Configuration

**Source:** `apps/scraper/src/http-client.ts`, `apps/scraper/src/constants.ts`, `apps/scraper/src/process-job.ts`

### HTTP Client Defaults

| Setting | Default | Shopify Override | Env Variable |
|---------|---------|-----------------|-------------|
| Delay between requests | **2000 ms** | **250 ms** (categories), **500 ms** (keywords) | `SCRAPER_DELAY_MS` |
| Max concurrent requests | **2** | **6** | `SCRAPER_MAX_CONCURRENCY` |
| Max retries per request | **4** (5 total attempts) | — | — |
| Cumulative backoff budget | **45s** | — | — |
| Request timeout | **30s** | — | — |

Platform-specific overrides are defined in `apps/scraper/src/platforms/shopify/constants.ts` and applied in `process-job.ts:155-161`. The keyword scraper uses `keywordDelayMs` (500ms) instead of the default `rateLimit.minDelayMs` (250ms) because Shopify's search endpoint is more rate-limit sensitive.

### Adaptive Delay

The HttpClient has an adaptive delay mechanism (`http-client.ts`):
- On 429 (rate limit): delay multiplier doubles (up to 4x)
- After 20 consecutive successes: multiplier decreases by 10%
- This automatically adjusts request rate to Shopify's current tolerance

### Circuit Breaker

**Source:** `apps/scraper/src/circuit-breaker.ts`

When HTTP failures exceed a threshold, the circuit breaker opens for 1 hour, rejecting new scrape jobs for that platform. This prevents wasting resources when Shopify is actively blocking requests. The circuit must be manually reset or waited out before new jobs can start.

### Worker Queue

| Setting | Value |
|---------|-------|
| Background worker concurrency | **11** (one per platform) |
| Platform lock TTL | **5 minutes** (prevents same platform running twice) |
| Retry attempts | **2** per job |
| Retry backoff | Exponential, 30s base |

### Non-Retryable Errors

HTTP 4xx errors (404, 403, etc.) fail immediately without retrying.

---

## 9. Data Flow Overview

```
                          ┌────────────────────────────────────────────────────────┐
                          │                    CRON SCHEDULER                      │
                          │                   (scheduler.ts)                       │
                          └──┬──────┬──────┬──────┬──────┬───────────────────────┘
                             │      │      │      │      │
                             ▼      │      │      │      │
                 ┌───────────────┐  │      │      │      │
  03:00 daily    │  CATEGORIES   │  │      │      │      │
                 │ 10 pages/cat  │  │      │      │      │
                 │  depth 0-4    │  │      │      │      │
                 │  + homepage   │  │      │      │      │
                 │  + featured   │  │      │      │      │
                 │  (L0-L2)      │  │      │      │      │
                 └───────┬───────┘  │      │      │      │
                         │          │      │      │      │
                         ▼          ▼      │      │      │
                 Listing data +   ┌───────────────┐     │
                 featured data    │ KEYWORD SEARCH │     │
  00:00, 12:00                    │ 10 pages/kw    │     │
                                  └──┬──────┬──────┘     │
                                     │      │            │
                                     │      ▼            │
                                     │  ┌──────────┐     │
                                     │  │ KEYWORD  │     │
                                     │  │ SUGGEST  │     │
                                     │  │ (always) │     │
                                     │  └──────────┘     │
                                     │                   │
                                     ▼                   ▼
                               Listing data    ┌──────────────┐
                               (rankings)      │  APP DETAILS │
  01:00, 13:00                                 │ 1 page/app   │
                                               │ (12h cache)  │
                                               │ tracked only │
                                               └──────┬───────┘
                                                      │
                                                      ▼
                                               Detail data
                                               (snapshots)

  06:00 daily ──► REVIEWS (max 10 pages, most recent, tracked apps only)
  05:00 daily ──► DAILY DIGEST (email notifications, no scraping)
```

### Key Points

- **Listing scrapers** (category, keyword) only collect app slugs + positions — they do **not** visit app detail pages
- **Category scraper also extracts featured app sightings** from homepage + L0-L2 pages (no separate cron needed)
- **App details** and **reviews** run as separate cron jobs on their own schedules, operating only on tracked apps
- **Keyword suggestions** is the only cascade that runs automatically from cron
- All other cascades (listing → details → reviews) are opt-in via manual triggers
- All scrapers have hard page caps (10 pages for category, keyword, and reviews)

---

## 10. Performance Optimization Summary

### Batch DB Operations (All Scrapers)

Both category and keyword scrapers use **chunked batch inserts** (100 rows per chunk) instead of one-by-one DB operations. This is the single biggest performance improvement:

- **Before:** Each app required 2-5 sequential DB queries (upsert + ranking + ad sighting + change detection)
- **After:** All apps from a page/keyword batched into 2-3 queries total
- **Impact:** Reduced thousands of DB round-trips to dozens

Key implementation details:
- All batch values use explicit `null` (never `undefined` or spread omission) for consistent column shapes
- `sql\`excluded.column_name\`` syntax for ON CONFLICT DO UPDATE in batch inserts
- `COALESCE(excluded.field, current.field)` preserves existing values when new value is null
- Slug deduplication before batch insert prevents "ON CONFLICT cannot affect row twice" PostgreSQL error

### Category Scraper Parallelism

The category scraper runs 3 levels of parallelism, all throttled by a single shared HttpClient:

```
Seeds (2 parallel) → Subcategories (3 parallel each) → Pages (sequential)
```

- **2 seed categories** processed simultaneously (`concurrentSeedCategories: 2`)
- **3 subcategories** per parent in parallel (`runConcurrent(..., 3)`)
- **Pages** fetched sequentially (parallel page fetching was reverted — it overwhelmed Shopify with too many concurrent requests when combined with subcategory parallelism)
- HttpClient enforces 250ms minimum delay and max 6 concurrent HTTP requests globally

### Keyword Scraper: Conservative Approach

Unlike categories, keyword scraper cannot safely increase parallelism because:

1. **Rate limiting:** Shopify search endpoint is more sensitive (500ms delay needed vs 250ms for categories)
2. **Deadlocks:** Multiple keywords upsert the same popular apps → PostgreSQL row-level lock contention
3. **No structural parallelism:** Keywords don't have subcategories — the only dimension is keyword count

Mitigation: `withDeadlockRetry()` wrapper with 3 attempts and jittered backoff.

### Lessons Learned

| Lesson | Context |
|--------|---------|
| Batch values must have identical column shapes | Drizzle hangs on `INSERT ... VALUES` with inconsistent columns from spread operator |
| Deduplicate before batch upsert | PostgreSQL cannot update the same row twice in one INSERT ... ON CONFLICT |
| Parallel page fetching is unsafe with parallel subcategories | Combined parallelism overwhelms target servers; sequential pages + parallel structure is the sweet spot |
| Batch DB removes natural inter-request delays | Previously, slow sequential DB ops acted as implicit rate limiting; batch DB makes requests fire faster, requiring explicit delay increases |
| Circuit breaker has 1-hour TTL | After rate limit incidents, must manually reset or wait before new scrape jobs work |
| `keywordDelayMs` separate from `rateLimit.minDelayMs` | Different scraper types need different rate limits for the same platform |
