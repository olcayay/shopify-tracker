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

Two modes, selected by `options.scope`:

| `scope` | Target | Trigger | Typical count (Shopify) |
|---------|--------|---------|-----------------------|
| **`"tracked"`** (default) | Tracked apps only (`apps.is_tracked = true`) | Cron every 12h | 36 |
| **`"all"`** | Every discovered app (`apps.platform = ?`) | Manual via System Admin UI | 13,681 |

The `scope=all` path is wired through `process-job.ts:261` → `AppDetailsScraper.scrapeAll()`. Triggered from the System Admin scraper page via the Database icon button per platform (confirms with "resume mode vs force re-scrape" dialog). See §11 for the bulk playbook.

### 12-Hour Cache (Resume Mechanism)

Before scraping, checks the most recent snapshot via `buildPreFetchedData(force)`. If the app was scraped within the last **12 hours**, it is skipped (in-memory check, ~48 apps/sec skim rate). This prevents redundant scraping when multiple triggers hit the same app and **doubles as the resume mechanism for bulk scrapes** — a killed/failed `scope=all` run can be re-triggered with `force=false` and will transparently skip already-scraped apps. When `force=true`, the cache is bypassed.

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

**No.** The cron job does not cascade into review scraping. Cascade can be enabled manually via `scrapeReviews: true` option. (Note: reviews cascade only fires for `scope=tracked` — skipped for `scope=all` to avoid queueing 13k review jobs.)

### Handling Delisted Apps (HTTP 404)

During full `scope=all` scrapes, ~0.5% of discovered apps return HTTP 404 (developer removed or Shopify delisted). Currently `AppNotFoundError` is only thrown by the Zoom platform module — Shopify and other platforms fall through to generic error handling, so 404s are incorrectly counted as `items_failed`. See PLA-1035 for the fix (add `apps.delisted_at` column + admin observation page).

Until PLA-1035 ships, expect `items_failed` on bulk runs to include ~0.5% delisted apps in addition to real failures.

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
| Delay between requests | **2000 ms** | **500 ms** (`rateLimit.minDelayMs`), **500 ms** (keywords via `keywordDelayMs`) | `SCRAPER_DELAY_MS` |
| Adaptive max delay | — | **3000 ms** (`rateLimit.maxDelayMs`) | — |
| Max concurrent requests | **2** | **6** (`httpMaxConcurrency`) | `SCRAPER_MAX_CONCURRENCY` |
| App-detail concurrency (tracked) | **3** | **8** (`appDetailsConcurrency`) | — |
| App-detail concurrency (bulk `scope=all`) | **3** | **2** (`appDetailsConcurrencyBulk`) | — |
| Max retries per request | **4** (5 total attempts) | — | — |
| Cumulative backoff budget | **90s** | — | — |
| Request timeout | **30s** | — | — |
| Job timeout (`scope=all`) | — | **6h** (`JOB_TIMEOUT_APP_DETAILS_ALL_MS`) | — |

Platform-specific overrides are defined in `apps/scraper/src/platforms/shopify/constants.ts` and applied in `process-job.ts:155-161`. The bulk knob (`appDetailsConcurrencyBulk`) caps Shopify at ~4 RPS effective (2 concurrent × 1/0.5s) during full `scope=all` runs, well under Shopify's ~10 RPS tolerance. Tracked cron scrapes stay at 8 concurrent for speed — they only touch 36 apps, so burst is acceptable.

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
| Bulk scrape needs a separate concurrency knob from tracked cron | Tracked (36 apps) tolerates bursts at concurrency=8; bulk (13k apps) sustains pressure for hours and 429s compound. `appDetailsConcurrencyBulk: 2` is the validated setting. |
| A killed BullMQ job auto-retries as "stalled" if `active` list isn't cleaned | Removing just the job hash + stalled ZSET leaves the `active` LIST entry; BullMQ re-runs it in parallel with any replacement job, doubling load. Observed 2026-04-12: jobs 1233+1235 ran in parallel for 3h, tripling 429 rate. Always `LREM ... :active` too. See §11. |
| Single persistent 429s continue to occur even at conservative rates | After rate tuning, ~0% HTTP 429 in single-job mode is achievable. Apparent "10% 429 rate" seen during tuning was pollution from a duplicate job. |

---

## 11. Bulk App-Details Scrape (`scope=all`) Playbook

This section documents operating the "scrape all discovered apps" feature — how to trigger, monitor, kill, and resume safely. Based on the first full Shopify bulk scrape (2026-04-12, jobs 1228–1252, baseline 13,681 apps).

### Triggering

Preferred path (UI):
1. System Admin → Scraper → Operational Matrix
2. Per-platform row → click **Database icon** (next to "All" + power buttons)
3. First confirm: "Resume mode OK / cancel" → OK
4. Second confirm: "Force re-scrape? / resume-friendly" → pick based on intent
   - **force=false (resume mode)**: skips apps scraped in last 12h. Use for re-runs / retries. Default recommendation.
   - **force=true**: bypasses cache, re-scrapes every app. Use only when snapshot data is known to be stale/corrupt.

Direct BullMQ enqueue (when UI is down or for scripting):
```bash
gcloud compute ssh deploy@appranks-api --zone=europe-west1-b --tunnel-through-iap --command \
  "docker exec appranks-api-1 node -e \"
  const { Queue } = require('bullmq');
  const q = new Queue('scraper-jobs-background', { connection: { host: '10.0.1.5', port: 6379 } });
  q.add('scrape:app_details', {
    type: 'app_details',
    platform: 'shopify',
    triggeredBy: 'admin:<reason>',
    options: { scope: 'all', force: false }
  }).then(j => console.log('enqueued', j.id));
  \""
```

### Monitoring

Live progress from DB (replace `<jobId>`):
```sql
SELECT job_id, status, NOW() - started_at AS elapsed,
  metadata->>'items_scraped' sc, metadata->>'items_failed' fl,
  metadata->>'current_index' idx, metadata->>'total_apps' tot
FROM scrape_runs WHERE job_id = '<jobId>' ORDER BY created_at DESC LIMIT 1;
```

Error breakdown:
```sql
SELECT COUNT(*) FILTER (WHERE error_message LIKE '%HTTP 429%')       AS http_429,
       COUNT(*) FILTER (WHERE error_message LIKE '%HTTP 404%')       AS not_found,
       COUNT(*) FILTER (WHERE error_message LIKE '%Rate limit backoff%') AS backoff_budget
FROM scrape_item_errors
WHERE scrape_run_id IN (SELECT id FROM scrape_runs WHERE job_id = '<jobId>');
```

Duplicate-job check (CRITICAL before diagnosing elevated error rates):
```bash
gcloud compute ssh deploy@appranks-email --zone=europe-west1-b --tunnel-through-iap \
  --command="docker exec appranks-redis-1 redis-cli lrange bull:scraper-jobs-background:active 0 -1"
```
If more than one job id appears, see "Clean kill" below — parallel jobs double request rate.

### Clean kill procedure (must do ALL steps in order)

Skipping any step causes BullMQ to auto-retry the "stalled" job in parallel with any replacement. This happened on 2026-04-12 and tripled the observed 429 rate.

```bash
# 1) Redis cleanup (run on VM with Redis — appranks-email)
gcloud compute ssh deploy@appranks-email --zone=europe-west1-b --tunnel-through-iap --command="
  docker exec appranks-redis-1 redis-cli lrem bull:scraper-jobs-background:active 0 <jobId>
  docker exec appranks-redis-1 redis-cli zrem bull:scraper-jobs-background:stalled <jobId>
  docker exec appranks-redis-1 redis-cli del bull:scraper-jobs-background:<jobId> bull:scraper-jobs-background:<jobId>:logs
"

# 2) Restart workers (flushes in-flight promises, resets circuit breaker state)
gcloud compute ssh deploy@appranks-scraper --zone=europe-west1-b --tunnel-through-iap \
  --command="docker restart appranks-worker-1 appranks-worker-interactive-1"

# 3) Mark scrape_run row as failed in DB
#    (run on appranks-api VM with the postgres psql container)
UPDATE scrape_runs SET status='failed', completed_at=NOW(),
  error='killed by admin: <reason>'
WHERE job_id='<jobId>' AND status='running';
```

Notes on the Redis data types — `:active` is a **LIST** (use `LREM`), `:stalled` is a **ZSET** (use `ZREM`). Using the wrong command silently no-ops.

### Expected performance (Shopify, 13.5k apps)

| Phase | Duration | Throughput |
|-------|----------|-----------|
| 12h cache skim (previously-scraped apps) | ~5 min for ~7k apps | ~25–50 apps/sec |
| Fresh scraping | ~4–6 h for ~6k fresh apps | ~0.4–0.7 apps/sec |
| Full pass (no cache hits) | ~5–6 h | ~0.65 apps/sec |

Failure rate in clean single-job mode: **<0.1% HTTP 429** + ~0.5% HTTP 404 (delisted apps — see PLA-1035).

### Resume behavior

- Failure-tolerant by design. If the job crashes/times out mid-run, simply re-trigger with `force=false`:
  - Apps successfully scraped in the last 12h → skipped (cached)
  - Failed apps (429, etc.) → retried (they have no fresh snapshot, so cache doesn't hit)
  - Never-scraped apps → scraped for the first time
- The `app_snapshots.scraped_at` timestamp is authoritative; `scrape_runs.status` is just run-level bookkeeping and can be safely set to `failed` without affecting the cache.
- Practical pattern: trigger once → wait ~6h → if any failures remain → re-trigger with `force=false` (will only retry the failures, ~10 min). After 2–3 such passes, failure rate approaches zero.
