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

### Deduplication

Maintains separate sets for sponsored and organic app slugs. The same app can appear in both categories. Organic position counter excludes sponsored and built-in apps.

### Dropped App Detection

After scraping, the scraper compares current results against the previous run. Apps that previously had a ranking but are no longer in results get recorded with `position: null` — this is how ranking drops are tracked.

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

### Trigger

Not triggered by a cron job directly. Always cascaded automatically from the `keyword_search` job after it completes.

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

**Source:** `apps/scraper/src/http-client.ts`, `apps/scraper/src/worker.ts`

### HTTP Client Defaults

| Setting | Default | Env Variable |
|---------|---------|-------------|
| Delay between requests | **2000 ms** (2 seconds) | `SCRAPER_DELAY_MS` |
| Max concurrent requests | **2** | `SCRAPER_MAX_CONCURRENCY` |
| Max retries per request | **3** (4 total attempts) | — |
| Retry backoff | Exponential (1s, 2s, 4s, 8s...) | — |

### Worker Queue

| Setting | Value |
|---------|-------|
| Job concurrency | **1** (one job at a time) |
| Rate limit | **1 job per 5 seconds** |
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
