# Scraping Depth & Pagination Reference

This document describes how deep each cron job scrapes, how many pages it visits, when it stops, and whether it triggers (cascades into) other scraper jobs.

---

## 1. Cron Job Schedule

| Job | Schedule | Frequency | Source |
|-----|----------|-----------|--------|
| **Categories** | `0 3 * * *` | Daily at 03:00 UTC | `scheduler.ts` |
| **App Details** | `0 */6 * * *` | Every 6 hours | `scheduler.ts` |
| **Keyword Search** | `0 0,12 * * *` | Every 12 hours (00:00, 12:00) | `scheduler.ts` |
| **Reviews** | `0 6,18 * * *` | Every 12 hours (06:00, 18:00) | `scheduler.ts` |
| **Featured Apps** | `0 4 * * *` | Daily at 04:00 UTC | `scheduler.ts` |
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

1. Reached page limit (default 1)
2. No `<a rel="next">` link found on the page
3. Zero new apps found after deduplication (sponsored apps can repeat across pages)

### Deduplication

Tracks seen app slugs across pages with a `Set`. If a page returns only already-seen apps, pagination stops early.

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

1. Reached page limit (default 4)
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

## 4. Featured Apps Scraper

**Source:** `apps/scraper/src/scrapers/featured-apps-scraper.ts`

### Page Depth

| Target | Pages |
|--------|-------|
| **Homepage** | 1 |
| **Category pages** (level 0, 1, 2) | 1 each |

There is **no pagination** within pages — each page is fetched once and all featured app sections are extracted from that single HTML response.

### Scope

Scrapes the homepage plus all categories with `categoryLevel <= 2`. Deeper subcategories (level 3, 4) are skipped.

### Does It Scrape App Details?

**No.** Only records featured app sightings (app slug, section name, position, date).

---

## 5. App Details Scraper

**Source:** `apps/scraper/src/scrapers/app-details-scraper.ts`

### Page Depth

**1 page per app** — fetches the app detail page at `apps.shopify.com/{slug}`.

### Scope

Runs on **tracked apps only** (apps associated with an account).

### 6-Hour Cache

Before scraping, checks the most recent snapshot. If the app was scraped within the last **6 hours**, it is skipped. This prevents redundant scraping when multiple triggers hit the same app.

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

## 6. Review Scraper

**Source:** `apps/scraper/src/scrapers/review-scraper.ts`

### Page Depth

| Mode | Pages Per App | Hard Limit |
|------|---------------|------------|
| **Cron (default)** | **Unlimited** | None |

The review scraper has **no hard page limit**. It pages through all review pages until it reaches the end.

### Scope

Runs on **tracked apps only**.

### Stop Conditions

1. Page returns **0 reviews** (empty page)
2. `has_next_page` is false (no next button in HTML)

### Duplicate Handling

Uses `onConflictDoNothing()` on insert — relies on database unique constraints to prevent duplicate reviews. This means it safely re-scrapes pages it has already visited without creating duplicates.

### Note on Performance

Because pagination is unlimited, an app with thousands of reviews will generate many HTTP requests. This is throttled by the HTTP client's 2-second delay between requests.

---

## 7. Keyword Suggestion Scraper

**Source:** `apps/scraper/src/scrapers/keyword-suggestion-scraper.ts`

### Page Depth

**1 request per keyword** — calls the Shopify autocomplete API (`/search/autocomplete?q={keyword}`), which returns a single JSON response.

There is **no pagination**. The response contains all suggestions in one payload.

### Trigger

Not triggered by a cron job directly. Always cascaded automatically from the `keyword_search` job after it completes.

---

## 8. Cascade (Chaining) Behavior

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

## 9. Rate Limiting & HTTP Configuration

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

## 10. Data Flow Overview

```
                          ┌────────────────────────────────────────────────────────┐
                          │                    CRON SCHEDULER                      │
                          │                   (scheduler.ts)                       │
                          └──┬──────┬──────┬──────┬──────┬──────┬────────────────┘
                             │      │      │      │      │      │
                             ▼      │      │      │      │      │
                 ┌───────────────┐  │      │      │      │      │
  03:00 daily    │  CATEGORIES   │  │      │      │      │      │
                 │  1 page/cat   │  │      │      │      │      │
                 │  depth 0-4    │  │      │      │      │      │
                 └───────┬───────┘  │      │      │      │      │
                         │          │      │      │      │      │
                         ▼          ▼      │      │      │      │
                   Listing data   ┌───────────────┐     │      │
                   (positions)    │ KEYWORD SEARCH │     │      │
  00:00, 12:00                    │  4 pages/kw    │     │      │
                                  └──┬──────┬──────┘     │      │
                                     │      │            │      │
                                     │      ▼            │      │
                                     │  ┌──────────┐     │      │
                                     │  │ KEYWORD  │     │      │
                                     │  │ SUGGEST  │     │      │
                                     │  │ (always) │     │      │
                                     │  └──────────┘     │      │
                                     │                   │      │
                                     ▼                   ▼      │
                               Listing data    ┌──────────────┐ │
                               (rankings)      │  APP DETAILS │ │
  Every 6h                                     │ 1 page/app   │ │
                                               │ (6h cache)   │ │
                                               │ tracked only │ │
                                               └──────┬───────┘ │
                                                      │         │
                                                      ▼         ▼
                                               Detail data   ┌──────────┐
                                               (snapshots)   │ REVIEWS  │
  06:00, 18:00                                               │ ALL pages│
                                                             │ no limit │
                                                             │ tracked  │
                                                             └──────────┘
                                                                  │
                                                                  ▼
                                                             Review data

  04:00 daily ──► FEATURED APPS (homepage + L0-L2 categories, 1 page each)
  05:00 daily ──► DAILY DIGEST (email notifications, no scraping)
```

### Key Points

- **Listing scrapers** (category, keyword, featured) only collect app slugs + positions — they do **not** visit app detail pages
- **App details** and **reviews** run as separate cron jobs on their own schedules, operating only on tracked apps
- **Keyword suggestions** is the only cascade that runs automatically from cron
- All other cascades (listing → details → reviews) are opt-in via manual triggers
- The review scraper is the only one with **unlimited pagination** — all others have hard caps
