# Public Marketing Routes — Production Readiness Plan

> Scope: the four free, no-login public pages that power SEO top-of-funnel per `files/MARKETING.md` lines 554–561.
>
> Status: all four routes ship today with SSR + 3600s ISR + basic JSON-LD, but are not production-ready because they are **not discoverable** (not in sitemap), lack hub pages, have thin internal linking, miss key features (feature-based best lists, dynamic OG images, on-demand revalidation), and have no analytics or targeted tests.

---

## Table of Contents

1. [Context](#1-context)
2. [Current State Audit](#2-current-state-audit)
3. [Gap Analysis](#3-gap-analysis)
4. [Shared Infrastructure to Reuse](#4-shared-infrastructure-to-reuse)
5. [Phase 1 — SEO Foundation](#5-phase-1--seo-foundation)
6. [Phase 2 — Discoverability & Internal Linking](#6-phase-2--discoverability--internal-linking)
7. [Phase 3 — Data Quality & Freshness](#7-phase-3--data-quality--freshness)
8. [Phase 4 — Feature Expansion](#8-phase-4--feature-expansion)
9. [Phase 5 — Analytics, Tests, Observability](#9-phase-5--analytics-tests-observability)
10. [Sequencing & Dependencies](#10-sequencing--dependencies)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Verification & Rollout](#12-verification--rollout)
13. [Critical Files Reference](#13-critical-files-reference)

---

## 1. Context

`files/MARKETING.md` positions four public, no-login routes as the primary SEO/top-of-funnel engine:

| Route | Target Search Intent |
|---|---|
| `/apps/{platform}/{slug}` | "{app} reviews", "{app} pricing", "{app} alternatives" |
| `/compare/{platform}/{a}-vs-{b}` | "{A} vs {B}", "best alternative to {A}" |
| `/best/{platform}/{category}` | "best {category} apps for {platform}" |
| `/developers/{platform}/{slug}` | "{company name} shopify apps" |

The market hypothesis in MARKETING.md projects **10,000+ indexable pages within Year 1**, with the "best of" route being the highest-leverage SEO play (~950+ pages from categories × platforms × features). For this to translate to real traffic and signups, the pages must be:

- crawlable (complete sitemaps at Google's shard limits),
- discoverable internally (hubs + related links),
- semantically rich (complete JSON-LD for rich results),
- fresh (on-demand revalidation post-scrape),
- measurable (funnel analytics tied to signup conversion).

This plan closes every gap while reusing the existing SSR/ISR/cache infrastructure.

---

## 2. Current State Audit

### 2.1 Pages (Next.js App Router, `apps/dashboard/src/app/(marketing)/...`)

| Route | File | Rendering | SEO Metadata | JSON-LD |
|---|---|---|---|---|
| App page | `apps/[platform]/[slug]/page.tsx` (490 lines) | SSR + 3600s ISR, React `cache()` wrapped fetcher | title, description, canonical, OG, Twitter | `AppJsonLd` (SoftwareApplication + AggregateRating) + `BreadcrumbJsonLd` |
| Compare | `compare/[platform]/[slugs]/page.tsx` (277 lines) | SSR + 3600s ISR | title with similarity score | `ComparisonJsonLd` (Article) + `BreadcrumbJsonLd` |
| Best/Top-N | `best/[platform]/[slug]/page.tsx` (197 lines) | SSR + 3600s ISR | title w/ count+year | `CategoryJsonLd` (ItemList) + `BreadcrumbJsonLd` |
| Developer | `developers/[platform]/[slug]/page.tsx` (280 lines) | SSR + 3600s ISR | title w/ app count | **Only** `BreadcrumbJsonLd` — no developer JSON-LD |

All four have `loading.tsx` skeletons.

### 2.2 API (Fastify, `apps/api/src/routes/public.ts`)

Endpoints (all `cacheGet()`-wrapped, 1h TTL, `Cache-Control: public, max-age=3600, stale-while-revalidate=7200`):

- line 71 — `GET /public/apps/:platform/:slug`
- line 150 — `GET /public/categories/:platform/:slug`
- line 232 — `GET /public/categories/:platform`
- line 257 — `GET /public/developers/:platform/:slug`
- line 498 — `GET /public/apps/search`
- line 531 — `GET /public/compare/:platform/:slug1/:slug2`

Drizzle queries are direct; `appSimilarityScores` is already imported (line 11). Power Score is **not** surfaced publicly (exists in `packages/shared/src/app-power.ts`).

### 2.3 Sitemap & robots

- `apps/dashboard/src/app/sitemap.ts` (revalidate 21600s) — includes static pages, `/trends/{platform}`, `/categories/{platform}/{slug}`, `/best/{platform}/{slug}` **only for categories where `isListingPage = true`**. Sequential 12-platform loop (lines 39–58).
- **Missing from sitemap:** every `/apps/*`, `/compare/*`, `/developers/*`, and every feature-based/metric-based `/best/*` URL.
- `apps/dashboard/src/app/robots.ts` correctly allows all four path prefixes.

---

## 3. Gap Analysis

| # | Gap | Impact |
|---|---|---|
| 1 | Sitemap omits individual apps, comparisons, developers | Google cannot discover the long-tail URLs that make up the SEO thesis |
| 2 | No hub/index pages (`/apps/{platform}`, `/developers/{platform}`, `/compare/{platform}`, `/best/{platform}`) | No internal link graph entry point; users and crawlers can't browse |
| 3 | Developer page missing JSON-LD | No rich-result eligibility; weak topical signals |
| 4 | Comparison URL space is combinatorial (N×N); no curated allowlist | Either missing from sitemap (status quo) or would produce millions of low-quality pages |
| 5 | No dynamic OG images | Poor Twitter/LinkedIn/Slack unfurl preview — hurts viral share + CTR |
| 6 | Thin internal linking (no "related apps", "similar developers", "vs alternatives") | Crawl depth issues; users can't jump sideways |
| 7 | Power Score not surfaced on public pages | Loses MARKETING.md differentiator (objective ranking methodology) |
| 8 | No on-demand revalidation post-scrape | Up to 1h staleness after scrape; "Last updated: today" claim is weak |
| 9 | No "Last updated" / methodology UX | Reduces trust; no transparency for the ranking claim |
| 10 | Missing feature-based / trend-based best lists (top-rated, fastest-growing, new, by-feature) — **MARKETING.md lines 554–561 and 706–780 unfulfilled** | Leaves ~340 high-intent SEO pages on the table |
| 11 | No pagination on developer apps, category apps beyond top-N, reviews | Incomplete content exposure |
| 12 | No UTM-preserving signup CTAs, no PostHog events on public pages | Cannot measure funnel conversion |
| 13 | No targeted unit/E2E tests for public routes | Regressions ship silently |
| 14 | No observability on public-route latency/cache hit rate | Cannot tune TTLs or catch degradation |

---

## 4. Shared Infrastructure to Reuse

Before building anything new, extend or wrap these:

- **JSON-LD**: `apps/dashboard/src/components/seo/json-ld.tsx` — already exports `AppJsonLd`, `CategoryJsonLd`, `ComparisonJsonLd`, `BreadcrumbJsonLd`. Add `DeveloperJsonLd` here.
- **Power Score**: `packages/shared/src/app-power.ts` — `computeAppPower()` function, already unit-tested. Thread into API responses.
- **API cache**: `apps/api/src/utils/cache.ts` — `cacheGet(key, loader, ttl)`. Use 6h TTL for sitemap queries.
- **Similarity**: `appSimilarityScores` table — already used in dashboard research mode; reuse for public "related apps" blocks.
- **Category metadata**: `apps/api/src/utils/category-totals.ts` — app counts per category.
- **Existing public SSR pattern**: React `cache()` + `fetchPublicApi()` with `next: { revalidate: 3600 }` — copy pattern for new hub pages.
- **ISR pattern reference**: existing `/audit/[platform]/[slug]` and `/trends/[platform]` pages are working references for rendering + metadata.
- **Platform list**: `PLATFORM_IDS` from `@appranks/shared` — single source of truth.

---

## 5. Phase 1 — SEO Foundation

> **Blocks:** Phase 2 (sitemap shard infra reused).
> **Goal:** make all existing pages crawlable, add hub pages, fill JSON-LD gaps, ship OG images.

### 5.1 Sitemap sharding (`generateSitemaps()`)

Replace single `apps/dashboard/src/app/sitemap.ts` with a sitemap index that points at per-type sharded files. Each shard caps at Google's 50k URLs / 50MB limit.

**New files:**

```
apps/dashboard/src/app/apps-sitemap/[id]/sitemap.ts
apps/dashboard/src/app/developers-sitemap/[id]/sitemap.ts
apps/dashboard/src/app/compare-sitemap/[id]/sitemap.ts
apps/dashboard/src/app/best-sitemap/[id]/sitemap.ts
```

Each uses Next.js `export async function generateSitemaps()` to produce `[{ id: 0 }, { id: 1 }, ...]` based on total count ÷ 50k.

**Top-level `sitemap.ts`:** becomes the sitemap **index** (references shards + static pages + platform hubs).

**Cache stampede avoidance:** revalidate = `21600 + (hash(id) % 3600)` (jittered).

**Parallelism:** replace sequential 12-platform loop with `Promise.all`.

### 5.2 New API endpoints for sitemap generation

Add to `apps/api/src/routes/public.ts` — all `cacheGet`-wrapped, 6h TTL, cursor-paginated, ordered by `id` for stable pagination:

```
GET /public/sitemap/apps/:platform?cursor&limit=50000
GET /public/sitemap/developers/:platform?cursor&limit=50000
GET /public/sitemap/compare/:platform?cursor&limit=50000   (reads compare_allowlist — Phase 2)
GET /public/sitemap/best/:platform?cursor&limit=50000      (categories + features + metric variants)
```

Response shape:
```ts
{
  items: Array<{ slug: string; lastModified: string }>;
  nextCursor: string | null;
}
```

### 5.3 Developer JSON-LD

Add to `apps/dashboard/src/components/seo/json-ld.tsx`:

```tsx
export function DeveloperJsonLd({ developer }: { developer: PublicDeveloper }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: developer.name,
      url: developer.website,
      subjectOf: {
        "@type": "ItemList",
        itemListElement: developer.apps.map((app, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${BASE_URL}/apps/${app.platform}/${app.slug}`,
          name: app.name,
        })),
      },
    })}} />
  );
}
```

Wire into `apps/dashboard/src/app/(marketing)/developers/[platform]/[slug]/page.tsx`.

### 5.4 Dynamic OG images (`next/og`)

Create `opengraph-image.tsx` sibling for each route:

```
(marketing)/apps/[platform]/[slug]/opengraph-image.tsx       // icon + name + rating + Power Score
(marketing)/compare/[platform]/[slugs]/opengraph-image.tsx   // side-by-side icons + VS
(marketing)/best/[platform]/[slug]/opengraph-image.tsx       // "Top 10 {Category} Apps" + platform logo
(marketing)/developers/[platform]/[slug]/opengraph-image.tsx // dev name + app count + avg rating
```

Each uses `export const runtime = "edge"`, `size = { width: 1200, height: 630 }`, `ImageResponse` from `next/og`. Auto-cached by route-segment ISR.

### 5.5 Hub / index pages (new routes)

Four new listing pages:

| Route | Purpose | Source |
|---|---|---|
| `(marketing)/apps/[platform]/page.tsx` | Top-100 apps by Power Score + A–Z directory | `/public/apps/:platform/top` |
| `(marketing)/developers/[platform]/page.tsx` | Top-100 devs by portfolio reach | `/public/developers/:platform/top` |
| `(marketing)/compare/[platform]/page.tsx` | Curated comparisons grid | `/public/compare/:platform/allowlist` |
| `(marketing)/best/[platform]/page.tsx` | List of all "best of" pages for this platform | category list + feature handles |

Each hub:
- Uses `ItemList` JSON-LD.
- Sets `priority: 0.8` in sitemap.
- Internal-links to ≥50 detail pages.
- Has its own OG image.

### 5.6 Acceptance Criteria — Phase 1

- [ ] `/sitemap.xml` resolves to sitemap index
- [ ] Each shard is ≤50k URLs and ≤50MB
- [ ] Search Console validates sitemap without warnings
- [ ] `curl -I` on any sitemap shard returns `Cache-Control: public, max-age=21600` (plus jitter)
- [ ] Developer page passes Google Rich Results Test with Organization schema
- [ ] All 4 detail routes have valid OG images (verified via Twitter Card Validator / OpenGraph.xyz)
- [ ] 4 new hub pages return 200, LCP <2.5s, Lighthouse SEO ≥95
- [ ] No regression in existing tests (`npm test`)

---

## 6. Phase 2 — Discoverability & Internal Linking

> **Requires:** Phase 1. **Blocks:** Phase 3.3 (revalidation needs allowlist for compare).

### 6.1 Curated comparison allowlist

Solves Gap #4 (combinatorial blowup).

**Migration:** `packages/db/src/migrations/NNNN_compare_allowlist.sql`

```sql
CREATE TABLE IF NOT EXISTS compare_allowlist (
  platform TEXT NOT NULL,
  slug_a TEXT NOT NULL,
  slug_b TEXT NOT NULL,
  score REAL NOT NULL,
  category_slug TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (platform, slug_a, slug_b)
);
-- breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compare_allowlist_platform_score
  ON compare_allowlist (platform, score DESC);
```

**Remember (CLAUDE.md rule):** add the entry to `packages/db/src/migrations/meta/_journal.json`.

**Population job:** `apps/scraper/src/jobs/compute-compare-allowlist.ts` — runs daily. For each category, take top-50 apps by Power Score, generate pairwise combinations filtered by `similarity_score >= 0.3`. Expected output: ~150k–200k pairs total (capped).

**New API endpoints:**
```
GET /public/compare/:platform/allowlist?cursor
GET /public/compare/:platform/:slug/related  → top 6 allowlist partners for a given app
```

### 6.2 Internal link graph

Target: each detail page links to ≥15 other public pages.

| Page | New internal-link blocks |
|---|---|
| App | Related apps (top 6 by `appSimilarityScores`), "Compare with X" (3 from allowlist), "More from [Developer]" (top 5), category breadcrumb |
| Developer | Paginated apps list, "Similar developers" (same primary category, top 6) |
| Best/category | Sibling categories, parent category, "Top developers in this category" |
| Compare | 6 related pairs from allowlist, "vs alternatives" (3 siblings to each app) |

All blocks are server-rendered (SSR), not client-side, so they're crawlable.

### 6.3 Pagination

Add `?page=` support to:
- Developer apps list (24/page)
- Category/best "see all N apps" (24/page)
- App page reviews (already paginated on dashboard; add public variant)

Metadata emits `<link rel="prev" />` and `<link rel="next" />` via `alternates.canonical` + `other`. API endpoints accept `cursor` + `limit` (default 24).

### 6.4 Acceptance Criteria — Phase 2

- [ ] `compare_allowlist` populated daily; size 100k–250k rows
- [ ] Each of 4 detail page types links to ≥15 public pages (assert in E2E)
- [ ] Paginated endpoints return `nextCursor` deterministically
- [ ] Lighthouse SEO ≥95 on all 4 detail types

---

## 7. Phase 3 — Data Quality & Freshness

### 7.1 Surface Power Score publicly

- Import `computeAppPower` from `@appranks/shared` in `apps/api/src/routes/public.ts`.
- Add `powerScore` field to:
  - `GET /public/apps/:platform/:slug` response
  - `GET /public/developers/:platform/:slug` each app in the apps list
  - `GET /public/categories/:platform/:slug` top-apps list
- Render as a visible badge on the app page and developer apps table.
- Use as sort key on `/best/{platform}/{category}` (already the ranking basis, just make it explicit in UX).
- Include in JSON-LD as `additionalProperty: { "@type": "PropertyValue", name: "Power Score", value: 87 }`.

### 7.2 Last-updated UX + methodology page

- New component: `apps/dashboard/src/components/public/last-updated.tsx`. Reads `scrapedAt` (already returned in snapshots).
- New static page: `apps/dashboard/src/app/(marketing)/methodology/page.tsx` — explains Power Score, scrape cadence, data sources.
- Link from every public detail page footer.

### 7.3 On-demand revalidation

Replace pure ISR (up to 1h staleness) with push-based revalidation after each scrape for high-value pages.

**Dashboard route:** `apps/dashboard/src/app/api/revalidate/route.ts`
- POST only, HMAC-signed (`REVALIDATE_SECRET` env var).
- Body: `{ paths: string[] }`.
- Calls `revalidatePath(p)` for each valid path.

**Scraper hook:** `apps/scraper/src/jobs/notify-revalidate.ts`
- After each scrape cycle, compute top-500 most-changed apps (by snapshot diff or review delta).
- For each, compute affected paths: app page, developer page, each category the app is in, impacted `/best/*` lists.
- Deduplicate, POST to dashboard revalidate endpoint.

**Caps:**
- Max 500 app paths + 100 category paths + 50 developer paths per scrape cycle → ~1000 revalidations max.
- Queue through existing DLQ to absorb backpressure.

### 7.4 Acceptance Criteria — Phase 3

- [ ] Power Score visible on app page, developer apps table, category top-N
- [ ] `/methodology` page exists, linked from every public detail page
- [ ] After scraping an app, its public page reflects new data within 60s (not 1h)
- [ ] Revalidation endpoint rejects unsigned/invalid requests

---

## 8. Phase 4 — Feature Expansion

> Closes MARKETING.md lines 554–561 + 706–780 (trend/metric/feature lists).

### 8.1 New "best" variants

All under `/best/[platform]/...` as typed slug variants:

| Route | Source / Ranking |
|---|---|
| `best/[platform]/features/[featureHandle]/page.tsx` | `category_features` table + Power Score |
| `best/[platform]/top-rated/page.tsx` | `rating_count >= 50 AND average_rating >= 4.5` sorted by Power Score |
| `best/[platform]/fastest-growing/page.tsx` | 30-day review velocity delta (from pre-computed metrics) |
| `best/[platform]/new/page.tsx` | `launched_date` within 90 days |

### 8.2 New API endpoints

In `apps/api/src/routes/public.ts`:

```
GET /public/best/:platform/features/:featureHandle
GET /public/best/:platform/top-rated
GET /public/best/:platform/fastest-growing
GET /public/best/:platform/new
```

All `cacheGet`-wrapped, 6h TTL (these update less frequently than app details).

### 8.3 Sitemap + hub integration

- Include all four variants in `best-sitemap` shard (Phase 1.1).
- List them on `/best/[platform]/page.tsx` hub page (Phase 1.5).

### 8.4 Acceptance Criteria — Phase 4

- [ ] All 4 variants return ≥20 apps with deterministic ordering
- [ ] Each has `ItemList` JSON-LD
- [ ] Each has a dynamic OG image
- [ ] All variants appear in sitemap index

---

## 9. Phase 5 — Analytics, Tests, Observability

> Runs in parallel with Phases 2–4. Enforced by CLAUDE.md rules (tests must pass; bug fixes must include tests).

### 9.1 Analytics & UTM-preserving signup CTAs

New component: `apps/dashboard/src/components/public/signup-cta.tsx`

- Reads current pathname + platform + slug.
- Injects `utm_source=public&utm_medium=<route-type>&utm_campaign=<slug>` into signup links.
- Fires PostHog events: `public_page_view`, `public_cta_click`, `public_signup` (on post-signup callback).
- Used at bottom of every public page.

### 9.2 Tests

**Unit (Vitest):**
- Extend `apps/dashboard/src/__tests__/components/seo-json-ld.test.tsx` — add cases for `DeveloperJsonLd` and updated `AppJsonLd` (with Power Score).
- New `apps/api/src/__tests__/routes/public.test.ts` — covers every endpoint including the new sitemap + best-variant + allowlist endpoints. Tests: happy path, 404, cache hit/miss, input validation.

**Snapshot:**
- Each page component's `generateMetadata()` — snapshot title/description/OG.

**E2E (Playwright):** `apps/dashboard/e2e/public-routes.spec.ts`
- Each of 4 detail route types renders 200 with expected H1 + JSON-LD present.
- Each of 4 hub pages renders 200.
- Sitemap index returns 200 with ≥4 `<sitemap>` entries.
- Internal-link count ≥15 per detail page.

**CLAUDE.md enforced:** `npm test` must be 0 failures before commit; pre-commit hook blocks otherwise.

### 9.3 Observability

- Fastify hook in `public.ts` logs any query >500ms with route + params.
- Verify / add covering indexes (follow pattern in `packages/db/src/migrations/0132_ad_sightings_keyword_date_indexes.sql`):
  - `app_category_rankings (app_id, category_slug, scraped_at DESC)`
  - `app_snapshots (app_id, scraped_at DESC)` (likely exists)
  - `compare_allowlist (platform, score DESC)` (added in 6.1)
- Grafana panel: public-route p95 latency, cache hit rate, sitemap shard size, revalidation count/day.
- Alert: cache hit rate <70% for 15m.

### 9.4 Acceptance Criteria — Phase 5

- [ ] `apps/api/src/routes/public.ts` coverage ≥85%
- [ ] p95 latency <200ms (cache hit), <800ms (cache miss)
- [ ] All new E2E specs green in CI
- [ ] PostHog funnel `public_page_view → public_cta_click → public_signup` visible

---

## 10. Sequencing & Dependencies

```
Phase 1 ──┐
          ├──► Phase 2 ──► Phase 3 (3.3 needs allowlist)
          └──► Phase 4 (uses 1.1 shard pattern)
Phase 5 runs in parallel with 2/3/4 (tests added alongside features)
```

Suggested calendar (solo dev):

| Week | Work |
|---|---|
| 1 | Phase 1.1–1.2 (sitemap shards + developer JSON-LD) |
| 2 | Phase 1.3–1.5 (OG images + hub pages) |
| 3 | Phase 2.1–2.2 (allowlist + internal linking) |
| 4 | Phase 2.3 + Phase 3.1–3.2 (pagination, Power Score, methodology) |
| 5 | Phase 3.3 (revalidation) + Phase 4 (best variants) |
| 6 | Phase 5 (analytics, tests, observability, backfill coverage) |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Sitemap shard blowup (>50k URLs/shard) | `generateSitemaps()` count is `Math.ceil(total/50000)`; monitor shard size in Grafana |
| Cache stampede when sitemap shards expire simultaneously | Jittered revalidate = `21600 + hash(id)%3600` |
| Crawl budget exhaustion from low-value long-tail pages | Lower `priority` (0.3) on app pages with few reviews; exclude apps with `rating_count < 3` from sitemap |
| Compare allowlist blowup | Cap at 500k rows total; require `similarity_score >= 0.3`; enforce top-50 per category |
| Revalidation storm after large scrape | Hard cap: 500 app + 100 category + 50 developer paths/cycle; queue through DLQ |
| N+1 query in sitemap generation | Pre-aggregate per-platform counts in cached helper; `Promise.all` the 12-platform loop |
| Stale Power Score after ranking signal changes | Tied to scrape cadence; on-demand revalidation from Phase 3.3 propagates within 60s |
| OG image cold-start latency on Edge | First hit generates + caches; monitor p95 on `*/opengraph-image` in Grafana |
| Migration + journal drift (CLAUDE.md rule) | Add `_journal.json` entry in the same commit as the migration; pre-commit hook validates |

---

## 12. Verification & Rollout

### 12.1 Pre-commit (enforced by CLAUDE.md)

- `npm test` — all 4 packages green (0 failures).
- `./scripts/smoke-test.sh --platform shopify` — no new SKIPs (only if scraper code touched; not for this plan's scope).
- Local dashboard run: visit each of 4 detail types + 4 hubs, verify JSON-LD via Google Rich Results Test.

### 12.2 Staging

- Submit sitemap index to Google Search Console.
- Verify indexation of ≥100 sample URLs per shard within 72h.
- Twitter Card Validator on sample app/compare/best/developer page.
- Lighthouse run (Performance, SEO, Accessibility) on each of the 4 detail types and 4 hubs — target ≥95 SEO.

### 12.3 Production rollout

- Deploy Phase 1 behind feature flag `PUBLIC_SITEMAP_V2` (env var) — can fall back to old sitemap if issues.
- Monitor first 24h: public-route p95 latency, cache hit rate, Search Console coverage, 4xx/5xx rate.
- Phase 3.3 revalidation: ship with `REVALIDATE_SECRET` + `REVALIDATE_ENABLED=false` first; turn on per environment once endpoint proven.
- Phase 4 variants: ship one at a time; measure SEO traffic per variant after 30 days.

### 12.4 Success metrics (90-day window)

- Google-indexed public URLs: 500 → 10,000+.
- Organic traffic to `/apps/*`, `/best/*`, `/compare/*`, `/developers/*`: baseline + 5×.
- Signup conversion from public pages (via UTM attribution): track in PostHog funnel.
- Cache hit rate on `/public/*` API: ≥70% steady state.
- p95 public-route latency: <200ms cached, <800ms cold.

---

## 13. Critical Files Reference

### To modify

- `apps/dashboard/src/app/sitemap.ts` — rewrite as sitemap index
- `apps/api/src/routes/public.ts` — add sitemap + hub + best-variant + allowlist endpoints, add Power Score to responses
- `apps/dashboard/src/components/seo/json-ld.tsx` — add `DeveloperJsonLd`, extend `AppJsonLd` with Power Score
- `apps/dashboard/src/app/(marketing)/developers/[platform]/[slug]/page.tsx` — wire `DeveloperJsonLd`
- `apps/dashboard/src/app/(marketing)/apps/[platform]/[slug]/page.tsx` — Power Score badge, related apps block
- `apps/dashboard/src/app/(marketing)/compare/[platform]/[slugs]/page.tsx` — related pairs block
- `apps/dashboard/src/app/(marketing)/best/[platform]/[slug]/page.tsx` — sibling/parent category links, methodology link

### To create

- `apps/dashboard/src/app/{apps,developers,compare,best}-sitemap/[id]/sitemap.ts` — 4 shard files
- `apps/dashboard/src/app/(marketing)/{apps,developers,compare,best}/[platform]/page.tsx` — 4 hub pages
- `apps/dashboard/src/app/(marketing)/{apps,compare,best,developers}/[platform]/[...]/opengraph-image.tsx` — 4 OG images
- `apps/dashboard/src/app/(marketing)/best/[platform]/features/[featureHandle]/page.tsx`
- `apps/dashboard/src/app/(marketing)/best/[platform]/{top-rated,fastest-growing,new}/page.tsx`
- `apps/dashboard/src/app/(marketing)/methodology/page.tsx`
- `apps/dashboard/src/app/api/revalidate/route.ts`
- `apps/dashboard/src/components/public/{signup-cta,last-updated}.tsx`
- `apps/scraper/src/jobs/{compute-compare-allowlist,notify-revalidate}.ts`
- `packages/db/src/migrations/NNNN_compare_allowlist.sql` + `_journal.json` entry
- Tests: `apps/api/src/__tests__/routes/public.test.ts`, `apps/dashboard/e2e/public-routes.spec.ts`, extensions to `seo-json-ld.test.tsx`

### To reference (no changes)

- `packages/shared/src/app-power.ts` — import `computeAppPower`
- `apps/api/src/utils/cache.ts` — use `cacheGet`
- `apps/api/src/utils/category-totals.ts`
- `packages/db/src/migrations/0132_ad_sightings_keyword_date_indexes.sql` — index pattern reference

---

_End of plan._
