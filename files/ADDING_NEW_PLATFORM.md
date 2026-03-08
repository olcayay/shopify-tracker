# Adding a New Platform — Comprehensive Guide

This document covers everything needed to add a new marketplace platform to the AppRanks tracking system. It draws from lessons learned integrating Shopify, Salesforce, and Canva.

---

## Table of Contents

1. [Quick Checklist](#1-quick-checklist)
2. [Phase 1: Platform Configuration](#2-phase-1-platform-configuration)
3. [Phase 2: Database](#3-phase-2-database)
4. [Phase 3: Scraper Module](#4-phase-3-scraper-module)
5. [Phase 4: API Routes](#5-phase-4-api-routes)
6. [Phase 5: Dashboard UI](#6-phase-5-dashboard-ui)
7. [Phase 6: Workers & Scheduler](#7-phase-6-workers--scheduler)
8. [Phase 7: Account Access Control](#8-phase-7-account-access-control)
9. [Capability Flags Deep Dive](#9-capability-flags-deep-dive)
10. [Common Pitfalls & Lessons Learned](#10-common-pitfalls--lessons-learned)
11. [Testing & Verification Checklist](#11-testing--verification-checklist)
12. [File Reference](#12-file-reference)

---

## 1. Quick Checklist

Use this as a high-level task tracker. Each item links to a detailed section below.

- [ ] Add platform config to `packages/shared/src/constants/platforms.ts`
- [ ] Add external URL builders to `packages/shared/src/constants/platforms.ts`
- [ ] Add dashboard URL builders to `apps/dashboard/src/lib/platform-urls.ts`
- [ ] Create scraper module directory under `apps/scraper/src/platforms/<name>/`
- [ ] Register module in `apps/scraper/src/platforms/registry.ts`
- [ ] Add scheduler cron jobs in `apps/scraper/src/scheduler.ts`
- [ ] Update browser client init in `apps/scraper/src/process-job.ts` (if needed)
- [ ] Add `VALID_PLATFORMS` entry in `apps/dashboard/src/lib/auth-context.tsx`
- [ ] Add sidebar navigation in `apps/dashboard/src/components/sidebar.tsx`
- [ ] Gate all dashboard tables/cards behind capability flags
- [ ] Seed `account_platforms` for existing accounts (migration)
- [ ] Verify all pages work for the new platform
- [ ] Verify existing platforms still work (regression check)

---

## 2. Phase 1: Platform Configuration

### 2.1 Shared Platform Constants

**File:** `packages/shared/src/constants/platforms.ts`

Add the new platform to the `PLATFORMS` object. Every capability flag controls UI visibility across 50+ dashboard files.

```typescript
export const PLATFORMS = {
  // ... existing platforms ...
  newplatform: {
    id: "newplatform" as const,
    name: "New Platform Marketplace",       // Display name in sidebar, titles, tooltips
    baseUrl: "https://marketplace.example.com",
    hasKeywordSearch: true,     // Can search apps by keyword?
    hasReviews: true,           // Does the marketplace show user reviews + ratings?
    hasFeaturedSections: false, // Does the marketplace have curated/featured sections?
    hasAdTracking: false,       // Are there sponsored/ad placements in search results?
    hasSimilarApps: false,      // Does the app detail page show "similar apps"?
    hasAutoSuggestions: false,  // Does the search have an autocomplete/suggest API?
    hasFeatureTaxonomy: false,  // Does the marketplace have a structured feature taxonomy?
    hasPricing: true,           // Do apps have visible pricing plans?
    hasLaunchedDate: true,      // Do apps have a visible launch/published date?
    pageSize: 20,               // Apps per page in search/category results
  },
} as const;
```

**Critical:** Get capability flags right from the start. Setting a flag to `true` when the platform doesn't support that feature causes empty columns, broken API calls, and confusing UI. Setting `false` is always safe — you can enable later.

### 2.2 PlatformCapabilities Type

In the same file, ensure `PlatformCapabilities` Pick type includes all capability flags:

```typescript
export type PlatformCapabilities = Pick<PlatformConfig,
  "hasKeywordSearch" | "hasReviews" | "hasFeaturedSections" |
  "hasAdTracking" | "hasSimilarApps" | "hasAutoSuggestions" |
  "hasFeatureTaxonomy" | "hasPricing" | "hasLaunchedDate"
>;
```

If you add a NEW capability flag (e.g., `hasAppBundles`), you must:
1. Add it to every platform in the `PLATFORMS` object
2. Add it to the `PlatformCapabilities` Pick type
3. Gate the relevant UI with `{caps.hasAppBundles && ...}`

### 2.3 External URL Builders

**File:** `packages/shared/src/constants/platforms.ts`

Add cases to `buildExternalAppUrl()` and `buildExternalCategoryUrl()`:

```typescript
export function buildExternalAppUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    // ... existing cases ...
    case "newplatform":
      return `https://marketplace.example.com/apps/${slug}`;
  }
}

export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    // ... existing cases ...
    case "newplatform":
      return `https://marketplace.example.com/categories/${slug}`;
  }
}
```

### 2.4 Dashboard URL Builders

**File:** `apps/dashboard/src/lib/platform-urls.ts`

Add cases to all URL builder functions:

```typescript
export function buildExternalAppUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    // ... existing ...
    case "newplatform":
      return `https://marketplace.example.com/apps/${slug}`;
  }
}

export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string { ... }
export function buildExternalSearchUrl(platform: PlatformId, query: string): string { ... }
export function buildExternalKeywordUrl(platform: PlatformId, keyword: string): string { ... }
```

**Note:** `platform-urls.ts` and `platforms.ts` both have URL builder functions. The shared package has `buildExternalAppUrl` and `buildExternalCategoryUrl`. The dashboard adds `buildExternalSearchUrl` and `buildExternalKeywordUrl`. Both must be updated.

---

## 3. Phase 2: Database

### 3.1 Schema Design

No schema changes needed if you're following the existing multi-platform pattern. All data tables already have a `platform` column with composite unique indexes:

| Table | Unique Constraint |
|-------|------------------|
| `apps` | `(platform, slug)` |
| `categories` | `(platform, slug)` |
| `tracked_keywords` | `(platform, keyword)` + `(platform, slug)` |
| `scrape_runs` | `(platform, scraper_type, started_at)` |
| `app_power_scores` | `(platform, ...)` |
| `research_projects` | `(platform, ...)` |

All tables default to `'shopify'`, so existing data is safe.

### 3.2 Migration for Account Platform Access

Create a migration to seed platform access for existing accounts (if desired):

```sql
-- Allow all existing accounts to access the new platform
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'newplatform' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
```

### 3.3 Schema Files Reference

These files define the DB schema with platform columns:

| File | Tables |
|------|--------|
| `packages/db/src/schema/apps.ts` | `apps`, `appSnapshots` |
| `packages/db/src/schema/categories.ts` | `categories`, `categorySnapshots` |
| `packages/db/src/schema/keywords.ts` | `trackedKeywords`, `keywordSnapshots` |
| `packages/db/src/schema/scrape-runs.ts` | `scrapeRuns` |
| `packages/db/src/schema/reviews.ts` | `reviews` |
| `packages/db/src/schema/account-platforms.ts` | `accountPlatforms` |
| `packages/db/src/schema/account-tracking.ts` | `accountTrackedApps`, `accountTrackedKeywords`, `accountCompetitorApps` |

### 3.4 Drizzle ORM Gotchas

- Schema file inter-imports must NOT use `.js` extensions (drizzle-kit uses CJS resolver)
- Run migrations from repo root: `npx drizzle-kit generate` then `npx drizzle-kit migrate`
- Date objects in drizzle `sql``...`` templates throw errors — convert to ISO string first

---

## 4. Phase 3: Scraper Module

### 4.1 Directory Structure

Create a new platform directory:

```
apps/scraper/src/platforms/newplatform/
├── index.ts          # PlatformModule implementation (main class)
├── constants.ts      # Seed categories, rate limits, scoring config, tracked fields
├── urls.ts           # URL builder functions
└── parsers/
    ├── app-parser.ts       # Parse app detail page → NormalizedAppDetails
    ├── category-parser.ts  # Parse category page → NormalizedCategoryPage
    ├── search-parser.ts    # Parse search results → NormalizedSearchPage (if hasKeywordSearch)
    ├── review-parser.ts    # Parse reviews → NormalizedReviewPage (if hasReviews)
    ├── featured-parser.ts  # Parse featured sections → NormalizedFeaturedSection[] (if hasFeaturedSections)
    └── suggest-parser.ts   # Parse autocomplete → string[] (if hasAutoSuggestions)
```

### 4.2 The PlatformModule Interface

Your module must implement `PlatformModule` from `apps/scraper/src/platforms/platform-module.ts`:

```typescript
interface PlatformModule {
  readonly platformId: PlatformId;
  readonly capabilities: PlatformCapabilities;
  readonly constants: PlatformConstants;
  readonly scoringConfig: PlatformScoringConfig;

  // Required
  buildAppUrl(slug: string): string;
  buildCategoryUrl(slug: string, page?: number): string;
  fetchAppPage(slug: string): Promise<string>;
  fetchCategoryPage(slug: string, page?: number): Promise<string>;
  parseAppDetails(html: string, slug: string): NormalizedAppDetails;
  parseCategoryPage(html: string, url: string): NormalizedCategoryPage;
  extractSlugFromUrl(url: string): string;

  // Optional (only implement if platform supports)
  buildSearchUrl?(keyword: string, page?: number): string;
  buildReviewUrl?(slug: string, page?: number): string;
  buildAutoSuggestUrl?(keyword: string): string;
  fetchSearchPage?(keyword: string, page?: number): Promise<string | null>;
  fetchReviewPage?(slug: string, page?: number): Promise<string | null>;
  parseSearchPage?(html: string, keyword: string, page: number, offset: number): NormalizedSearchPage;
  parseReviewPage?(html: string, page: number): NormalizedReviewPage;
  parseFeaturedSections?(html: string): NormalizedFeaturedSection[];
  generateSuggestions?(keyword: string): Promise<string[]>;  // For custom suggestion APIs
  extractCategorySlugs?(platformData: Record<string, unknown>): string[];
  extractFeatureHandles?(platformData: Record<string, unknown>): string[];
  closeBrowser?(): Promise<void>;  // Cleanup for browser-based modules
}
```

### 4.3 Normalized Types

All parsers return normalized types. Platform-specific data goes into `platformData` (stored as JSONB):

```typescript
interface NormalizedAppDetails {
  name: string;
  slug: string;
  averageRating: number | null;    // null if platform has no reviews
  ratingCount: number | null;      // null if platform has no reviews
  pricingHint: string | null;      // null if platform has no pricing
  iconUrl: string | null;
  developer: { name: string; url?: string; website?: string } | null;
  badges: string[];                // e.g., ["built_for_shopify"]
  platformData: Record<string, unknown>;  // ALL platform-specific data
}
```

**Important:** `platformData` is your escape hatch. Put everything platform-specific here (features, screenshots, permissions, integrations, etc.). It's stored as JSONB and can be displayed on the app detail page.

### 4.4 Constants & Scoring Config

**File:** `apps/scraper/src/platforms/newplatform/constants.ts`

```typescript
import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

export const NEWPLATFORM_CONSTANTS: PlatformConstants = {
  seedCategories: ["category-1", "category-2", "category-3"],  // Top-level category slugs to start crawling
  maxCategoryDepth: 3,              // How many levels of subcategories to follow
  defaultPagesPerCategory: 5,       // Max pages to scrape per category
  trackedFields: [                  // Fields tracked for change detection
    "description", "pricing", "averageRating", "ratingCount", "developer",
  ],
  rateLimit: { minDelayMs: 1500, maxDelayMs: 3000 },  // Random delay between requests
};

export const NEWPLATFORM_SCORING: PlatformScoringConfig = {
  pageSize: 20,           // Must match PLATFORMS[newplatform].pageSize
  pageDecay: 0.85,        // Ranking score decay per page (0-1)
  similarityWeights: {    // Weights for competitor similarity scoring
    category: 0.25,       // Shared category weight
    feature: 0.25,        // Shared feature taxonomy weight (0 if no feature taxonomy)
    keyword: 0.25,        // Keyword ranking overlap weight
    text: 0.25,           // Text similarity (description) weight
  },
  stopWords: new Set([    // Words to exclude from text similarity
    "the", "and", "for", "with", "your", "this", "app",
  ]),
};
```

### 4.5 URL Builder

**File:** `apps/scraper/src/platforms/newplatform/urls.ts`

```typescript
const BASE_URL = "https://marketplace.example.com";

export const newplatformUrls = {
  base: BASE_URL,
  app: (slug: string) => `${BASE_URL}/apps/${slug}`,
  category: (slug: string) => `${BASE_URL}/categories/${slug}`,
  categoryPage: (slug: string, page?: number) =>
    `${BASE_URL}/categories/${slug}${page && page > 1 ? `?page=${page}` : ""}`,
  search: (keyword: string, page = 1) =>
    `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&page=${page}`,
  // Add review URL, autocomplete URL etc. as needed
} as const;
```

### 4.6 HTTP vs Browser Fetching

Two fetching strategies:

**HTTP Client (Cheerio)** — for static HTML pages:
```typescript
constructor(httpClient?: HttpClient) {
  this.httpClient = httpClient || new HttpClient();
}

async fetchAppPage(slug: string): Promise<string> {
  return this.httpClient.fetchPage(this.buildAppUrl(slug));
}
```

**Browser Client (Playwright)** — for JS-rendered SPAs or Cloudflare-protected sites:
```typescript
constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
  this.httpClient = httpClient || new HttpClient();
  this.browserClient = browserClient;
}

async fetchAppPage(slug: string): Promise<string> {
  const page = await this.ensureBrowserPage();
  await page.goto(this.buildAppUrl(slug), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // Wait for SPA hydration
  return page.content();
}
```

**When to use browser:** If the marketplace uses client-side rendering (React/Next.js SPA), is behind Cloudflare challenge, or requires JavaScript execution for search APIs.

### 4.7 Slug Format

Choose a slug format that is URL-safe and can uniquely identify apps:

| Platform | Slug Example | Notes |
|----------|-------------|-------|
| Shopify | `oberlo` | Direct URL path segment |
| Salesforce | `a0N3u00000PXabc` | Salesforce listingId |
| Canva | `AAFxxx--my-app` | Canva app ID + name, `--` separator (replaces `/`) |

**Canva gotcha:** Canva uses `/apps/AAFxxx/my-app-name` URLs, but `/` is not safe in URL path segments. We use `--` as separator: `AAFxxx--my-app-name`. Convert back with `slug.replace("--", "/")` for external URLs.

### 4.8 Register in Platform Registry

**File:** `apps/scraper/src/platforms/registry.ts`

```typescript
import { NewPlatformModule } from "./newplatform/index.js";

export function getModule(platformId: PlatformId, httpClient?: HttpClient, browserClient?: BrowserClient): PlatformModule {
  switch (platformId) {
    // ... existing cases ...
    case "newplatform":
      module = new NewPlatformModule(httpClient, browserClient);
      break;
    default:
      throw new Error(`Unknown platform: ${platformId}`);
  }
  // ...
}
```

### 4.9 Browser Client Init in Process Job

**File:** `apps/scraper/src/process-job.ts`

If your platform needs browser rendering, add initialization:

```typescript
let browserClient: BrowserClient | undefined;
if (platform === "salesforce" && type === "app_details") {
  browserClient = new BrowserClient();
}
if (platform === "canva") {
  browserClient = new BrowserClient();
}
// Add your platform:
if (platform === "newplatform") {
  browserClient = new BrowserClient();
}
```

---

## 5. Phase 4: API Routes

### 5.1 Platform Extraction

All API routes use `getPlatformFromQuery()` from `apps/api/src/utils/platform.ts`:

```typescript
import { getPlatformFromQuery } from "../utils/platform.js";

app.get("/", async (request) => {
  const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
  // Use: eq(apps.platform, platform)
});
```

The dashboard auto-injects `?platform=` from the current URL path, so API routes automatically receive the correct platform. No changes needed to API routes for a new platform — they're already platform-aware.

### 5.2 Routes That Filter by Platform

These route files use `eq(table.platform, platform)`:

| File | What it filters |
|------|----------------|
| `apps/api/src/routes/apps.ts` | Apps, app snapshots, rankings, search, membership |
| `apps/api/src/routes/categories.ts` | Categories, category snapshots, tree building |
| `apps/api/src/routes/keywords.ts` | Keywords, keyword snapshots, rankings |
| `apps/api/src/routes/competitors.ts` | Competitor apps, rankings, similarity scores |
| `apps/api/src/routes/featured.ts` | Featured sections (gated by `requireCapability`) |
| `apps/api/src/routes/reviews.ts` | Reviews (gated by `requireCapability`) |
| `apps/api/src/routes/ads.ts` | Ad sightings (gated by `requireCapability`) |
| `apps/api/src/routes/research.ts` | Research projects, competitor suggestions |
| `apps/api/src/routes/overview.ts` | Overview stats, freshness, recent changes |
| `apps/api/src/routes/account.ts` | Tracked apps/keywords CRUD (platform-scoped) |
| `apps/api/src/routes/system-admin.ts` | Scraper trigger, stats |

### 5.3 Capability Gating in API

Some API routes check platform capabilities before executing:

```typescript
import { requireCapability } from "../utils/platform.js";

app.get("/reviews", async (request) => {
  const platform = getPlatformFromQuery(request.query);
  requireCapability(platform, "hasReviews"); // Throws 400 if not supported
  // ...
});
```

---

## 6. Phase 5: Dashboard UI

This is the most labor-intensive phase. The dashboard has 50+ files with platform-aware logic.

### 6.1 Auth Context — VALID_PLATFORMS

**File:** `apps/dashboard/src/lib/auth-context.tsx`

Add to the `VALID_PLATFORMS` set:

```typescript
const VALID_PLATFORMS = new Set(["shopify", "salesforce", "canva", "newplatform"]);
```

This controls the auto-injection of `?platform=` in API calls. If your platform isn't in this set, no API calls from dashboard pages under `/<platform>/` will work.

### 6.2 Sidebar Navigation

**File:** `apps/dashboard/src/components/sidebar.tsx`

Add label and color:

```typescript
const PLATFORM_LABELS: Record<PlatformId, string> = {
  // ... existing ...
  newplatform: "New Platform",
};

const PLATFORM_COLORS: Record<PlatformId, string> = {
  // ... existing ...
  newplatform: "#FF5733",  // Brand color
};
```

The sidebar auto-generates navigation items from `PLATFORMS` config using `getNavItems()`:

```typescript
function getNavItems(platformId: PlatformId) {
  const p = `/${platformId}`;
  const caps = PLATFORMS[platformId];
  const items = [
    { href: `${p}/overview`, label: "Overview", icon: LayoutDashboard },
    { href: `${p}/apps`, label: "Apps", icon: AppWindow },
    { href: `${p}/competitors`, label: "Competitors", icon: Star },
  ];
  if (caps.hasKeywordSearch) items.push({ href: `${p}/keywords`, label: "Keywords", icon: Search });
  items.push({ href: `${p}/categories`, label: "Categories", icon: FolderTree });
  if (caps.hasFeaturedSections) items.push({ href: `${p}/featured`, label: "Featured", icon: Sparkles });
  if (caps.hasFeatureTaxonomy) items.push({ href: `${p}/features`, label: "Features", icon: Puzzle });
  items.push({ href: `${p}/research`, label: "Research", icon: FlaskConical });
  return items;
}
```

This automatically adapts based on capability flags — no additional changes needed.

### 6.3 Capability Flag Usage in Dashboard

The `caps` pattern is used across all dashboard pages:

```typescript
const { platform } = useParams();
const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
```

Then capability flags gate UI elements:

```tsx
{/* Hide entire column if platform has no reviews */}
{caps.hasReviews && (
  <TableHead>Rating</TableHead>
)}

{/* Hide card if platform has no pricing */}
{caps.hasPricing && (
  <Card>
    <CardTitle>Pricing</CardTitle>
    ...
  </Card>
)}
```

### 6.4 Pages That Need Capability Gating

**CRITICAL:** This is where Canva integration taught us the most. Every table, card, and column that shows platform-specific data must be wrapped with the appropriate `caps.hasX` check.

Here's every file that needs capability checks:

#### App List & Detail Pages

| File | What to gate |
|------|-------------|
| `[platform]/apps/page.tsx` | Rating, Reviews, Pricing, Min. Paid, Launched columns |
| `[platform]/apps/[slug]/layout.tsx` | Rating card, Reviews card, Pricing card, Launched card, `cardCount` calculation |
| `[platform]/apps/[slug]/page.tsx` | Review Pulse card, Ads in Visibility card, ad data fetch |
| `[platform]/apps/[slug]/app-nav.tsx` | Reviews tab, Similar tab, Featured tab, Ads tab |
| `[platform]/apps/[slug]/competitors-section.tsx` | `isCol()` and `visibleToggleableColumns` for: rating, reviews, pricing, ads, featured, launchedDate |

#### Keyword Pages

| File | What to gate |
|------|-------------|
| `[platform]/keywords/[slug]/app-results.tsx` | Rating, Reviews, Min. Paid, Launched columns |

#### Overview Page

| File | What to gate |
|------|-------------|
| `[platform]/overview/page.tsx` | Rating, Reviews columns in My Apps and Competitor Apps tables |

#### Competitors Page

| File | What to gate |
|------|-------------|
| `[platform]/competitors/page.tsx` | `isCol()` and `visibleToggleableColumns` for: rating, reviews, v7d, v30d, v90d, momentum, pricing, minPaidPrice, adKeywords, launchedDate |

#### Research Pages

| File | What to gate |
|------|-------------|
| `[platform]/research/[id]/page.tsx` | Market Overview avg rating/reviews, inline rating displays in CompetitorSuggestions, InlineAppSearch, ManualAppSearch; CompetitorTable headers+cells for Rating, Reviews, Pricing, Launched |
| `[platform]/research/[id]/competitors/page.tsx` | Rating, Reviews, Pricing, Launched headers+cells; inline search rating; default sort key |

#### Shared Components

| File | What to gate |
|------|-------------|
| `components/app-list-table.tsx` | Ads column, Launched column (both header + cell) |
| `components/power-score-popover.tsx` | Review-related score breakdown items |

### 6.5 The `isCol()` and `visibleToggleableColumns` Pattern

For tables with toggleable columns (competitors, app-list-table), columns are hidden in TWO places:

```typescript
// 1. isCol() — controls whether a column renders at all
function isCol(key: string) {
  if (hiddenCols.has(key)) return false;
  // Platform capability filters:
  if ((key === "rating" || key === "reviews") && !caps.hasReviews) return false;
  if ((key === "pricing" || key === "minPaidPrice") && !caps.hasPricing) return false;
  if (key === "ads" && !caps.hasAdTracking) return false;
  if (key === "featured" && !caps.hasFeaturedSections) return false;
  if (key === "launchedDate" && !caps.hasLaunchedDate) return false;
  return true;
}

// 2. visibleToggleableColumns — controls the column toggle dropdown
const visibleToggleableColumns = allToggleableColumns.filter((col) => {
  if ((col.key === "rating" || col.key === "reviews") && !caps.hasReviews) return false;
  if ((col.key === "pricing" || col.key === "minPaidPrice") && !caps.hasPricing) return false;
  if (col.key === "ads" && !caps.hasAdTracking) return false;
  if (col.key === "featured" && !caps.hasFeaturedSections) return false;
  if (col.key === "launchedDate" && !caps.hasLaunchedDate) return false;
  return true;
});
```

**Both must be updated.** If you only update `isCol()`, the column disappears but the toggle dropdown still shows it.

### 6.6 Default Sort Key

When a page sorts by a column that doesn't exist for the new platform, it breaks:

```typescript
// BAD — will break for platforms without reviews
const [sortKey, setSortKey] = useState<SortKey>("reviews");

// GOOD — conditional default
const [sortKey, setSortKey] = useState<SortKey>(caps.hasReviews ? "reviews" : "name");
```

This affects:
- `research/[id]/page.tsx` — CompetitorTable
- `research/[id]/competitors/page.tsx` — main table
- Any other table with review/rating as default sort

### 6.7 Sub-Component Gotcha

In `research/[id]/page.tsx`, there are multiple sub-components (`SummaryCards`, `CompetitorSuggestions`, `InlineAppSearch`, `ManualAppSearch`). Each one needs its OWN `caps` computation because they're separate React components:

```typescript
function SummaryCards({ ... }) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  // Now can use caps.hasReviews etc.
}
```

You cannot rely on `caps` being passed down from a parent — each component must compute it independently if it needs capability checks.

---

## 7. Phase 6: Workers & Scheduler

### 7.1 Scheduler Config

**File:** `apps/scraper/src/scheduler.ts`

Add cron jobs for the new platform. Stagger timing to avoid resource conflicts:

```typescript
const SCHEDULES = [
  // ... existing Shopify, Salesforce, Canva schedules ...

  // ── New Platform ──
  {
    name: "newplatform_category",
    cron: "0 5 * * *",            // Daily — stagger from other platforms
    type: "category" as const,
    platform: "newplatform" as const,
  },
  {
    name: "newplatform_app_details",
    cron: "30 3,15 * * *",        // Every 12 hours
    type: "app_details" as const,
    platform: "newplatform" as const,
  },
  // Add keyword_search if hasKeywordSearch
  // Add reviews if hasReviews
  // Always add compute_app_scores
  {
    name: "newplatform_compute_app_scores",
    cron: "0 11 * * *",           // Daily
    type: "compute_app_scores" as const,
    platform: "newplatform" as const,
  },
];
```

### 7.2 Job Types

Available job types and when to schedule them:

| Job Type | Schedule | Condition |
|----------|----------|-----------|
| `category` | Daily | Always |
| `app_details` | Every 12h | Always |
| `keyword_search` | Every 12h | `hasKeywordSearch` |
| `keyword_suggestions` | Cascaded from keyword_search | `hasAutoSuggestions` |
| `reviews` | Daily | `hasReviews` |
| `compute_app_scores` | Daily | Always |
| `compute_review_metrics` | Cascaded from reviews | `hasReviews` |
| `compute_similarity_scores` | Cascaded from app_details | Always |
| `daily_digest` | Daily | Platform-agnostic (per account) |

### 7.3 Job Cascading

Jobs cascade automatically in `process-job.ts`. The platform is passed through the cascade chain:

```
category → app_details (for each tracked app)
app_details → reviews (if hasReviews) → compute_review_metrics
keyword_search → keyword_suggestions (if hasAutoSuggestions)
```

### 7.4 Two Queue System

- **Interactive queue:** User-triggered (track app, manual scrape) — no rate limiter
- **Background queue:** Scheduled cron jobs — rate-limited (1 job per 5 seconds)

Both workers use the same `process-job.ts` logic. The platform module handles its own rate limiting internally.

---

## 8. Phase 7: Account Access Control

### 8.1 Account Platforms Table

`account_platforms` junction table controls which accounts can access which platforms:

```sql
CREATE TABLE account_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform varchar(20) NOT NULL,
  enabled_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, platform)
);
```

### 8.2 Package Limits

Packages (subscription tiers) have a `max_platforms` limit:

| Package | max_platforms |
|---------|-------------|
| free | 1 |
| starter | 3 |
| pro | 3 |
| enterprise | 3 |

### 8.3 Enabling Platform Access

When a new platform is launched, you need a migration to seed access:

```sql
-- Give all existing accounts access to the new platform
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'newplatform' FROM accounts
ON CONFLICT DO NOTHING;
```

Or, for selective rollout, only grant to paid accounts:

```sql
INSERT INTO account_platforms (account_id, platform)
SELECT a.id, 'newplatform'
FROM accounts a
JOIN packages p ON a.package_id = p.id
WHERE p.slug IN ('starter', 'pro', 'enterprise')
ON CONFLICT DO NOTHING;
```

---

## 9. Capability Flags Deep Dive

### What Each Flag Controls

| Flag | Scraper | API | Dashboard |
|------|---------|-----|-----------|
| `hasKeywordSearch` | Search scraper enabled | Keyword endpoints active | Keywords nav item, keyword pages |
| `hasReviews` | Review scraper enabled | Reviews endpoint active, `requireCapability` | Rating/Reviews columns, Review Pulse card, Reviews tab, inline ratings |
| `hasFeaturedSections` | Featured scraper enabled | Featured endpoint active | Featured nav item, Featured tab, featured columns |
| `hasAdTracking` | Ad detection in search | Ads endpoint active | Ads tab, Ads columns, Visibility card ads section |
| `hasSimilarApps` | Similar apps parser | Similar endpoint | Similar tab |
| `hasAutoSuggestions` | Suggestion scraper enabled | Suggest endpoint | Auto-suggest in search bars |
| `hasFeatureTaxonomy` | Feature parsing | Features endpoint | Features nav item |
| `hasPricing` | Pricing plan parsing | Pricing in snapshots | Pricing column/card, Min. Paid column |
| `hasLaunchedDate` | Launch date parsing | Launch date in app response | Launched column/card |

### Adding a New Capability Flag

1. Add to all platforms in `packages/shared/src/constants/platforms.ts`
2. Add to `PlatformCapabilities` Pick type
3. Add to scraper module's `capabilities` object
4. Gate relevant dashboard UI with `caps.hasNewFlag`
5. Gate relevant API routes with `requireCapability`
6. Update sidebar `getNavItems()` if it controls navigation
7. Update `app-nav.tsx` if it controls a tab
8. Update `isCol()` and `visibleToggleableColumns` if it controls table columns

---

## 10. Common Pitfalls & Lessons Learned

### Pitfall 1: Setting capability flags to `true` prematurely

**Problem:** Setting `hasFeaturedSections: true` for Canva caused empty featured sections to render.

**Solution:** Start with `false` for everything you're not 100% sure about. Enable flags only after confirming the platform supports that feature and your scraper collects the data.

### Pitfall 2: Missing capability gates in tables

**Problem:** After adding Canva, we found Rating/Reviews/Pricing/Launched columns still showing in 5+ pages that weren't in the original plan.

**Solution:** Do a project-wide search for every table column before marking the task complete:

```bash
# Find all Rating/Reviews column references
grep -r "Rating" apps/dashboard/src --include="*.tsx" -l
grep -r "Reviews" apps/dashboard/src --include="*.tsx" -l
grep -r "Pricing" apps/dashboard/src --include="*.tsx" -l
grep -r "Launched" apps/dashboard/src --include="*.tsx" -l
```

### Pitfall 3: Forgetting `visibleToggleableColumns`

**Problem:** Column hidden from table but still appears in the column toggle dropdown.

**Solution:** Always update BOTH `isCol()` AND `visibleToggleableColumns` in the same edit.

### Pitfall 4: Default sort on non-existent column

**Problem:** Page crashes or shows unexpected order when defaulting to `useState("reviews")` for a platform without reviews.

**Solution:** Use conditional defaults: `caps.hasReviews ? "reviews" : "name"`.

### Pitfall 5: Sub-components without `caps`

**Problem:** TypeScript error `Cannot find name 'caps'` in sub-components within `research/[id]/page.tsx`.

**Solution:** Each sub-component must independently compute `caps` using `useParams()`.

### Pitfall 6: Missing `VALID_PLATFORMS` entry

**Problem:** Dashboard API calls don't include `?platform=` for the new platform.

**Solution:** Add platform to `VALID_PLATFORMS` set in `auth-context.tsx`.

### Pitfall 7: Forgetting URL builders

**Problem:** "View on Platform" external link goes to wrong URL.

**Solution:** Update switch statements in BOTH:
- `packages/shared/src/constants/platforms.ts` → `buildExternalAppUrl`, `buildExternalCategoryUrl`
- `apps/dashboard/src/lib/platform-urls.ts` → all 4 URL builder functions

### Pitfall 8: Slug format issues

**Problem:** Slugs with special characters break URLs.

**Solution:** Design URL-safe slug format from the start. If the platform uses `/` in identifiers, replace with `--` or similar.

### Pitfall 9: Scraper rate limiting

**Problem:** Getting blocked by Cloudflare or rate limiters.

**Solution:** Use conservative rate limits, browser client for SPAs, and save auth state (cookies) for Cloudflare-protected sites.

### Pitfall 10: Empty data columns (category rankings)

**Problem:** Category ranking columns appear empty for new platform.

**Solution:** This is a data issue, not a UI bug. Ensure the category scraper has been run first: `npx tsx apps/scraper/src/cli.ts category --platform=newplatform`.

---

## 11. Testing & Verification Checklist

After implementation, verify every page for the new platform AND confirm existing platforms still work.

### New Platform Verification

- [ ] `/<platform>/overview` — No unsupported columns in tables, stat cards correct
- [ ] `/<platform>/apps` — Table columns match capability flags (no Rating/Reviews/Pricing/Launched if disabled)
- [ ] `/<platform>/apps/<slug>` — Overview page: no broken cards, no empty sections
- [ ] `/<platform>/apps/<slug>` — Tab navigation: only supported tabs visible
- [ ] `/<platform>/apps/<slug>/competitors` — Correct columns in competitor table
- [ ] `/<platform>/apps/<slug>/keywords` — Keywords page works
- [ ] `/<platform>/apps/<slug>/reviews` — 404 or hidden if no reviews
- [ ] `/<platform>/apps/<slug>/details` — Detail page renders
- [ ] `/<platform>/apps/<slug>/changes` — Change history renders
- [ ] `/<platform>/competitors` — Global competitors table: correct columns
- [ ] `/<platform>/keywords` — Keyword list (if hasKeywordSearch)
- [ ] `/<platform>/keywords/<slug>` — Keyword detail: app results table has correct columns
- [ ] `/<platform>/categories` — Category tree/list renders
- [ ] `/<platform>/categories/<slug>` — Category detail renders
- [ ] `/<platform>/research` — Research projects page
- [ ] `/<platform>/research/<id>` — Research detail: tables have correct columns, no inline ratings if disabled
- [ ] `/<platform>/research/<id>/competitors` — Correct columns, correct default sort
- [ ] `/<platform>/featured` — Hidden from nav if `hasFeaturedSections: false`
- [ ] `/<platform>/features` — Hidden from nav if `hasFeatureTaxonomy: false`
- [ ] Search bar — App search works for new platform
- [ ] Track/untrack — Can follow/unfollow apps
- [ ] External links — "View on Platform" opens correct URL

### Regression Verification (Shopify + Salesforce)

- [ ] `/shopify/apps` — All columns still visible
- [ ] `/shopify/apps/<slug>` — All tabs, all cards present
- [ ] `/salesforce/apps` — All columns still visible
- [ ] `/salesforce/apps/<slug>` — Correct tabs/cards for Salesforce capabilities

### Scraper Verification

- [ ] CLI category scrape: `npx tsx apps/scraper/src/cli.ts category --platform=newplatform`
- [ ] CLI app scrape: `npx tsx apps/scraper/src/cli.ts app <slug> --platform=newplatform`
- [ ] Data appears in database: `SELECT * FROM apps WHERE platform = 'newplatform' LIMIT 5;`
- [ ] CLI keyword scrape (if applicable): `npx tsx apps/scraper/src/cli.ts keyword <keyword> --platform=newplatform`

---

## 12. File Reference

### Shared Package (must change)

| File | Change |
|------|--------|
| `packages/shared/src/constants/platforms.ts` | Add platform config + capability flags + URL builders |

### Scraper (must change)

| File | Change |
|------|--------|
| `apps/scraper/src/platforms/<name>/index.ts` | PlatformModule implementation |
| `apps/scraper/src/platforms/<name>/constants.ts` | Seed categories, rate limits, scoring config |
| `apps/scraper/src/platforms/<name>/urls.ts` | URL builders |
| `apps/scraper/src/platforms/<name>/parsers/*.ts` | HTML/JSON parsers |
| `apps/scraper/src/platforms/registry.ts` | Register module in switch statement |
| `apps/scraper/src/scheduler.ts` | Add cron schedules |
| `apps/scraper/src/process-job.ts` | Add browser client init (if needed) |

### API (usually no changes needed)

| File | Change |
|------|--------|
| (none) | Routes are already platform-aware via `getPlatformFromQuery()` |

### Dashboard (must change)

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/auth-context.tsx` | Add to `VALID_PLATFORMS` |
| `apps/dashboard/src/lib/platform-urls.ts` | Add URL builder cases |
| `apps/dashboard/src/components/sidebar.tsx` | Add label + color |
| All table pages (see Section 6.4) | Gate columns with capability flags |

### Database (conditional)

| File | Change |
|------|--------|
| `packages/db/src/migrations/XXXX_*.sql` | Seed `account_platforms` for new platform |

---

## Summary

Adding a new platform follows this order:

1. **Config first** — Get capability flags right in `platforms.ts`
2. **Scraper second** — Build module, parsers, register, schedule
3. **Dashboard last** — Gate ALL UI behind capability flags
4. **Test everything** — New platform pages AND regression on existing platforms

The biggest time sink is the dashboard — systematically finding and gating every table column, card, tab, and inline display that shows platform-specific data. Use grep to find all references before declaring the task complete.
