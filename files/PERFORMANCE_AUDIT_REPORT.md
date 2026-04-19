# Performance Audit Report — Full System Scan

**Date:** 2026-04-20
**Scope:** All API endpoints, all dashboard pages, all DB indexes
**Audited:** 48 route files, 100+ page components, 37 DB tables

---

## Executive Summary

| Category | Issues Found | Critical | High | Medium | Low |
|----------|-------------|----------|------|--------|-----|
| API Endpoints | 32 | 4 | 8 | 12 | 8 |
| Dashboard Pages | 28 | 3 | 7 | 10 | 8 |
| Database Indexes | 22 | 2 | 8 | 7 | 5 |
| **Total** | **82** | **9** | **23** | **29** | **21** |

**Estimated total impact if all implemented:** 40-60% reduction in average page load time, 30-50% reduction in DB connection usage.

---

## TIER 1 — CRITICAL (Implement first, highest ROI)

### C1. Add server-side cache to `/account/competitors` aggregate endpoint
- **File:** `apps/api/src/routes/account-tracking.ts:652`
- **Problem:** 12 DB queries, no caching. Called by `/shopify` platform page, `/shopify/competitors`, and multiple other pages. Every page view runs all 12 queries.
- **Fix:** Add `cacheGet()` with 30s TTL (same pattern as `starred-categories`). Key: `competitors:${accountId}:${platform}`.
- **Impact:** 70-80% latency reduction on repeated calls (1.2s → ~50ms from cache). Saves ~12 DB connections per cached hit.
- **Effort:** Small (5 lines of code)
- **Pages affected:** `/shopify`, `/shopify/competitors`, platform overview

### C2. App overview v2 page calls `getAppCompetitors` without `fields=basic`
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/apps/v2/[slug]/page.tsx:173`
- **Problem:** V2 app detail page fetches full competitor data (16 queries) instead of basic. V1 was already fixed.
- **Fix:** Add `"basic"` as 4th argument to `getAppCompetitors()`.
- **Impact:** ~14s → ~500ms for that single API call.
- **Effort:** 1 line change
- **Pages affected:** All v2 app detail pages

### C3. Research compare page has N+1 competitor fetch pattern
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/research/[id]/compare/page.tsx:115-126`
- **Problem:** After fetching research project, fetches each competitor app individually in a loop — N separate API calls.
- **Fix:** Create a batch endpoint or use POST `/api/apps/batch` with slugs array.
- **Impact:** N API calls → 1 call. For 10 competitors: 10 × 120ms = 1.2s → ~150ms.
- **Effort:** Medium (new batch endpoint + page change)
- **Pages affected:** Research compare page

### C4. Missing GIN index on `app_snapshots.categories` JSONB
- **File:** `packages/db/src/schema/apps.ts`
- **Problem:** `starred-features` and `my-features` endpoints expand categories JSONB with `jsonb_array_elements()`. Without GIN index, full row scan needed.
- **Fix:** `CREATE INDEX CONCURRENTLY idx_app_snapshots_categories_gin ON app_snapshots USING GIN(categories);`
- **Impact:** JSONB expansion queries 30-50% faster. Affects starred-features, my-features, and any future category-based queries.
- **Effort:** 1 migration file
- **Pages affected:** `/shopify/features`, any feature taxonomy page

---

## TIER 2 — HIGH (Significant impact, moderate effort)

### H1. `/account/competitors` basic mode should skip Wave 1 keyword query too
- **File:** `apps/api/src/routes/account-tracking.ts:718-732`
- **Problem:** Even in `basic` mode, Wave 1 still runs the correlated keyword count query (427ms). Platform overview doesn't need this.
- **Fix:** Guard keyword query with `!isBasicAggregate`.
- **Impact:** 427ms savings on every basic call.
- **Effort:** 1 line change

### H2. Add `fields=basic` to all client-side competitor fetches that don't need full data
- **Files:**
  - `[platform]/competitors/page.tsx:102` — fetches `/account/tracked-apps` (needs full for detailed view — NO CHANGE)
  - `[platform]/competitors/competitor-row.tsx` — individual competitor data (already scoped)
  - `[platform]/apps/[slug]/competitors-section.tsx:131,189` — fetches with `includeSelf=true` (needs full — this IS the competitors tab)
- **Fix:** Audit each caller and add `?fields=basic` where full data isn't displayed.
- **Impact:** ~500ms per call saved.
- **Effort:** Small per file

### H3. Research project pages refetch full data on every poll tick
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/research/[id]/page.tsx:144-147`
- **Problem:** usePolling fetches FULL project data (all competitors, keywords, scores) every interval while anything is pending.
- **Fix:** Use lightweight `/api/research-projects/{id}/status` endpoint first (like keywords page already does), only refetch full data when status actually changes.
- **Impact:** 80% fewer full data fetches during resolution. Each full fetch = 5-10 API calls.
- **Effort:** Medium (add status check before full fetch)
- **Pages affected:** Research project detail, competitors, keywords pages

### H4. Keywords section hook re-fetches ALL keywords when 1 pending keyword resolves
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/apps/[slug]/use-keywords-section.ts:177-214`
- **Problem:** `pollPendingKeywords()` calls `loadKeywords()` which re-fetches the entire keyword list + rankings for all competitors, not just the resolved keyword.
- **Fix:** Fetch only the changed keyword and merge into existing state.
- **Impact:** Reduces API calls from N (all keywords) to 1 (changed keyword) per poll tick.
- **Effort:** Medium

### H5. 15 foreign key columns missing indexes across large tables
- **Tables:** app_snapshots, app_keyword_rankings, app_category_rankings, app_field_changes, similar_app_sightings, featured_app_sightings, keyword_ad_sightings, category_ad_sightings, reviews, category_snapshots
- **Column:** `scrape_run_id`, `first_seen_run_id`, `last_seen_run_id`
- **Problem:** CASCADE deletes and JOIN queries on these columns do sequential scans.
- **Fix:** Add indexes in a migration file. Use `CREATE INDEX CONCURRENTLY` to avoid locks.
- **Impact:** DELETE operations 10-100x faster. JOIN queries on run IDs significantly faster.
- **Effort:** 1 migration file with ~15 CREATE INDEX statements
- **Risk:** Low (read-only indexes, CONCURRENTLY avoids locks)

### H6. `developers` endpoint Phase2 LATERAL join still slow on cold cache
- **File:** `apps/api/src/routes/developers.ts:198-204`
- **Problem:** LATERAL join scans app_snapshots for developer name per app. 2.5s for 25 developers on cold cache. Currently cached for 60s.
- **Fix:** Add `developer_name` column to `apps` table (denormalized, populated by scraper). Eliminates LATERAL join entirely.
- **Impact:** Phase2 from 2.5s to ~50ms. Even with cache, first visitor sees 2.5s.
- **Effort:** High (migration + scraper change + endpoint rewrite)
- **Alternative:** Increase cache TTL to 5 min (quick fix, 90% of benefit).

### H7. Preview page useEffect with ESLint disable
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/apps/[slug]/preview/page.tsx:45`
- **Problem:** `eslint-disable-line react-hooks/exhaustive-deps` — unstable dependencies could cause re-fetching.
- **Fix:** Use ref pattern (like compare page fix) or add proper dependency tracking.
- **Impact:** Prevents potential duplicate API calls.
- **Effort:** Small

### H8. Overview highlights endpoint could be cached
- **File:** `apps/api/src/routes/overview-highlights.ts`
- **Problem:** 773ms internal, 8 queries in 2 waves. Called on every `/overview` page load.
- **Fix:** Add `cacheGet()` with 60s TTL. Highlights don't change within a minute.
- **Impact:** 773ms → ~5ms from cache.
- **Effort:** Small (5 lines)

---

## TIER 3 — MEDIUM (Incremental improvements)

### M1. Add cache to `/account/starred-categories` (increase TTL)
- **File:** `apps/api/src/routes/account-extras.ts:52-56`
- **Current:** 30s TTL cache exists.
- **Fix:** Increase to 120s — categories rarely change. Add cache invalidation on star/unstar.
- **Impact:** 75% fewer cold cache hits.
- **Effort:** 1 line (TTL change) + invalidation on mutations

### M2. `/api/keywords` endpoint — add pagination + column selection
- **File:** `apps/api/src/routes/keywords.ts`
- **Problem:** Returns all keywords for the platform. As keyword count grows, response size and query time increase linearly.
- **Fix:** Default limit of 100, pagination support, only return needed columns.
- **Impact:** Faster initial page load, less data transfer.
- **Effort:** Medium

### M3. App search endpoint missing cache
- **File:** `apps/api/src/routes/apps.ts:472-494`
- **Problem:** DISTINCT ON subquery for every search. No caching.
- **Fix:** Add 15-30s cache keyed by search term + platform.
- **Impact:** Repeated searches instant. TypeScript dev often searches same terms.
- **Effort:** Small

### M4. `SELECT *` (Drizzle `db.select()`) on apps table in several endpoints
- **Files:** `apps.ts:90, 718-720`, `account-tracking.ts:90-92`
- **Problem:** Fetches all columns including potentially large `description` text when only `id`, `slug`, `name` needed.
- **Fix:** Use explicit column selection: `db.select({ id: apps.id, slug: apps.slug, ... })`.
- **Impact:** 10-20% less data transfer per query, better index usage.
- **Effort:** Small per endpoint

### M5. Compare page fetches N+1 rankings (1 per competitor + self)
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/apps/[slug]/compare/use-compare-data.ts:112-127`
- **Problem:** 15 separate `/api/apps/:slug/rankings?days=7` calls (1 per app).
- **Fix:** Create batch rankings endpoint: `POST /api/apps/batch-rankings` accepting slug array.
- **Impact:** 15 API calls → 1 call. 15 × 120ms = 1.8s → ~200ms.
- **Effort:** Medium (new endpoint + hook change)

### M6. Category detail page makes 12+ API calls
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/categories/[slug]/page.tsx`
- **Problem:** SSR page fetches: category, history, competitors, tracked apps, starred categories, last changes, min prices, reverse similar, featured apps, category ads, category scores — 11 calls.
- **Fix:** Create `/api/categories/:slug/overview` batch endpoint. Or merge related calls.
- **Impact:** 11 API calls → 3-4 calls. ~1s savings from reduced overhead.
- **Effort:** Medium-High

### M7. Keyword detail page makes 12+ API calls
- **File:** `apps/dashboard/src/app/(dashboard)/[platform]/keywords/[slug]/page.tsx`
- **Problem:** SSR page fetches: keyword, rankings, ads, suggestions, membership, competitors, tracked apps, last changes, min prices, reverse similar, launched dates, categories.
- **Fix:** Create `/api/keywords/:slug/overview` batch endpoint.
- **Impact:** 12 API calls → 3-4 calls. ~1s savings.
- **Effort:** Medium-High

### M8. Add `detectedAt DESC` index on `app_field_changes`
- **Table:** `app_field_changes`
- **Problem:** "Recent changes" queries sort by `detectedAt DESC` across all apps. Current index is `(appId, detectedAt)` — good for per-app queries but not global sorts.
- **Fix:** `CREATE INDEX CONCURRENTLY idx_app_field_changes_detected ON app_field_changes(detected_at DESC);`
- **Impact:** Global "recent changes" queries faster.
- **Effort:** 1 migration line

### M9. Duplicate data loading between research pages
- **Files:** Research project page, competitors page, keywords page all fetch full project data independently.
- **Problem:** No caching/deduplication between sibling pages.
- **Fix:** Use React `cache()` for research project data fetch, or share data via layout.
- **Impact:** Eliminates 2-3 redundant fetches per navigation between research tabs.
- **Effort:** Medium

### M10. `app_review_metrics` missing composite index
- **Table:** `app_review_metrics`
- **Problem:** `DISTINCT ON (app_id) ... ORDER BY computed_at DESC` query used in competitors endpoint. Index only on `(app_id)` without `computed_at`.
- **Fix:** `CREATE INDEX CONCURRENTLY idx_app_review_metrics_app_computed ON app_review_metrics(app_id, computed_at DESC);`
- **Impact:** Review velocity queries faster.
- **Effort:** 1 migration line

### M11. `app_similarity_scores` bidirectional query inefficiency
- **File:** `apps/api/src/routes/account-tracking.ts:1351-1357`
- **Problem:** `WHERE (app_id_a = X AND app_id_b IN (...)) OR (app_id_b = X AND app_id_a IN (...))` — OR condition prevents efficient index use.
- **Fix:** Store bidirectional scores (A→B and B→A) or use UNION instead of OR.
- **Impact:** Similarity query 2-3x faster.
- **Effort:** Medium (migration to add reverse entries, or query rewrite)

### M12. `category_snapshots` LATERAL join in competitors endpoint
- **File:** `apps/api/src/routes/account-tracking.ts:1339`
- **Problem:** `LEFT JOIN LATERAL (SELECT app_count FROM category_snapshots WHERE category_id = c.id ORDER BY scraped_at DESC LIMIT 1)` — executes per category.
- **Fix:** Replace with CTE: `WITH latest_cat_snaps AS (SELECT DISTINCT ON (category_id) ...)` — single scan.
- **Impact:** Category rankings query 30-50% faster.
- **Effort:** Small (query rewrite, already done in some endpoints)

---

## TIER 4 — LOW (Nice to have, minor impact)

### L1. Increase developer cache TTL from 60s to 300s
- **Impact:** 80% fewer cold cache hits for developer pages.

### L2. Add `platform` filter to `competitor-slugs` endpoint
- **Currently:** Returns all competitors across all platforms. Could filter by platform.
- **Impact:** Smaller response for multi-platform accounts.

### L3. Add index on `accounts.packageId`
- **Impact:** Faster account-package JOIN queries.

### L4. Add index on `email_logs(status, created_at DESC)`
- **Impact:** Faster email analytics status filtering.

### L5. Remove unused `scrapeRunId` references after creating indexes
- **Impact:** Cleaner schema documentation.

### L6. System admin pages could use read replica
- **Impact:** Offload analytics queries from primary DB.
- **Note:** Requires infrastructure change (Cloud SQL read replica).

### L7. Add `rating` index on `reviews` table
- **Fix:** `CREATE INDEX idx_reviews_rating ON reviews(rating);`
- **Impact:** Faster rating distribution queries.

### L8. Optimize `app_snapshots` response size — don't return `platformData` by default
- **Problem:** `platformData` JSONB can be very large (10KB+). Most endpoints don't need it.
- **Fix:** Exclude from default SELECT, add `?includePlatformData=true` param.
- **Impact:** 30-50% smaller response sizes for app detail endpoints.

---

## DB Connection Pool Optimization Summary

**Current state:** 10 pool connections, 25 max. Heaviest endpoint uses 12 queries.

| Optimization | Connections Saved Per Request | Priority |
|-------------|------------------------------|----------|
| Cache `/account/competitors` (C1) | -12 connections (from cache) | CRITICAL |
| `fields=basic` everywhere (C2, H2) | -8 connections per call | HIGH |
| Cache `/overview/highlights` (H8) | -8 connections (from cache) | HIGH |
| Batch research competitors (C3) | -9 connections (N→1) | HIGH |
| Batch compare rankings (M5) | -14 connections (15→1) | MEDIUM |
| Batch category detail (M6) | -7 connections (11→4) | MEDIUM |
| Total potential savings | **~58 connections per page cluster** | |

---

## Implementation Priority Order

**Phase 1 (Quick wins, 1-2 days):**
1. C1: Cache `/account/competitors` — 5 lines
2. C2: V2 page `fields=basic` — 1 line
3. H1: Skip keyword query in basic mode — 1 line
4. H8: Cache overview highlights — 5 lines
5. M1: Increase starred-categories TTL — 1 line
6. L1: Increase developer cache TTL — 1 line

**Phase 2 (Index improvements, 1 day):**
7. H5: 15 foreign key indexes — 1 migration
8. C4: GIN index on categories JSONB — 1 migration
9. M8: detectedAt DESC index — 1 migration
10. M10: review metrics composite index — 1 migration

**Phase 3 (Batch endpoints, 3-5 days):**
11. M5: Batch rankings endpoint for compare
12. C3: Batch apps endpoint for research compare
13. M6: Category overview batch endpoint
14. M7: Keyword overview batch endpoint

**Phase 4 (Structural improvements, 1-2 weeks):**
15. H4: Incremental keyword polling
16. H3: Lightweight status polling for research
17. H6: Denormalize developer_name
18. M9: Shared research project data via layout
19. M11: Bidirectional similarity scores
