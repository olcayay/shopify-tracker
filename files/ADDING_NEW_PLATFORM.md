# Adding a New Platform — Comprehensive Guide

This document covers everything needed to add a new marketplace platform to the AppRanks tracking system. It draws from lessons learned integrating Shopify, Salesforce, Canva, Wix, WordPress, Google Workspace, Atlassian, Zoom, Zoho, and Zendesk.

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

### Phase 1: Platform Configuration
- [ ] Add platform config to `packages/shared/src/constants/platforms.ts`
- [ ] Add external URL builders to `packages/shared/src/constants/platforms.ts`
- [ ] Add dashboard URL builders to `apps/dashboard/src/lib/platform-urls.ts`
- [ ] Add similarity weights and stop words to `packages/shared/src/similarity.ts`
- [ ] Add metadata character limits to `apps/dashboard/src/lib/metadata-limits.ts`

### Phase 2: Database
- [ ] Create migration to seed `account_platforms` for existing accounts
- [ ] Create migration to seed `platform_visibility` (hidden by default until tested)
- [ ] Create migration to seed categories
- [ ] Update `packages/db/src/migrations/meta/_journal.json` with new migration entries

### Phase 3: Scraper
- [ ] Create scraper module directory under `apps/scraper/src/platforms/<name>/`
- [ ] Register module in `apps/scraper/src/platforms/registry.ts`
- [ ] Add scheduler cron jobs in `apps/scraper/src/scheduler.ts`
- [ ] Update browser client init in `apps/scraper/src/process-job.ts` (if SPA/JS-rendered)
- [ ] Update browser client init in `apps/scraper/src/cli.ts` (if SPA/JS-rendered)
- [ ] Add URL pattern to `apps/scraper/src/jobs/backfill-categories.ts`
- [ ] Add branch in `keyword-suggestion-scraper.ts` (if custom suggestion API)
- [ ] Add smoke test checks in `scripts/smoke-test.sh` (see [Smoke Test](#smoke-test) below)

### Phase 4: API
- [ ] Add live-search branch in `apps/api/src/routes/live-search.ts`
- [ ] Review `apps/api/src/routes/apps.ts` developer info extraction (if custom platformData)

### Phase 5: Dashboard UI
- [ ] Add `VALID_PLATFORMS` entry in `apps/dashboard/src/lib/auth-context.tsx`
- [ ] Add `VALID_PLATFORMS` entry in `apps/dashboard/src/proxy.ts`
- [ ] Add `VALID_PLATFORMS` entry in `apps/dashboard/src/components/admin-scraper-trigger.tsx`
- [ ] Add sidebar navigation in `apps/dashboard/src/components/sidebar.tsx`
- [ ] Update sidebar platform regex patterns (2 locations)
- [ ] Add `BADGE_CONFIG` entry in `apps/dashboard/src/components/app-badges.tsx`
- [ ] Add `PLATFORM_LABELS` and `PLATFORM_COLORS` entries in 3 files: `sidebar.tsx`, `platform-overview-cards.tsx`, `overview/page.tsx`
- [ ] Add `PLATFORM_BRANDS` entry in `apps/dashboard/src/components/platform-overview-cards.tsx` (overview page crashes without this!)
- [ ] Create preview component (`<platform>-preview.tsx`) and wire into `preview/page.tsx`
- [ ] Update field labels in `details/page.tsx`, `changes/page.tsx`, app overview `page.tsx`
- [ ] Add platform-specific sections to `compare/page.tsx` and `research/[id]/compare/page.tsx`
- [ ] Add to `isFlat` check in `categories/page.tsx` (if flat categories)
- [ ] Gate all dashboard tables/cards behind capability flags
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
    maxRatingStars: 5,          // Maximum rating stars (5 for most, 4 for Atlassian)
    pageSize: 20,               // Apps per page in search/category results
  },
} as const;
```

**Critical:** Get capability flags right from the start. Setting a flag to `true` when the platform doesn't support that feature causes empty columns, broken API calls, and confusing UI. Setting `false` is always safe — you can enable later.

**Current platforms and their flags:**

| Flag | Shopify | Salesforce | Canva | Wix | WordPress | Google WS | Atlassian | Zoom | Zoho | Zendesk |
|------|---------|------------|-------|-----|-----------|-----------|-----------|------|------|---------|
| hasKeywordSearch | true | true | true | true | true | true | true | true | true | true |
| hasReviews | true | true | false | true | true | true | true | false | false | true |
| hasFeaturedSections | true | false | false | true | true | true | true | true | false | true |
| hasAdTracking | true | false | false | false | false | false | false | false | false | false |
| hasSimilarApps | true | false | false | false | false | false | false | false | false | false |
| hasAutoSuggestions | true | false | true | false | false | false | false | false | false | false |
| hasFeatureTaxonomy | true | false | false | false | false | false | false | false | false | false |
| hasPricing | true | true | false | true | false | true | true | false | false | true |
| hasLaunchedDate | true | false | false | false | true | false | false | false | true | true |
| maxRatingStars | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 |
| pageSize | 20 | 12 | 20 | 20 | 20 | 20 | 50 | 100 | 50 | 24 |

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
export function buildExternalAppUrl(platform: PlatformId, slug: string, externalId?: string | null): string {
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

**Important — `externalId` parameter:** Some platforms use a different identifier in their human-readable URL than the API slug. For example, Atlassian uses `addonKey` (e.g., `com.xpandit.plugins.xray`) as the slug for API calls, but the human URL requires a numeric `addonId` (e.g., `https://marketplace.atlassian.com/apps/1211769`). When this is the case:

1. Store the external ID in the `apps.external_id` column during scraping (both category parser and app detail scraper)
2. Use the `externalId` parameter in `buildExternalAppUrl()` to construct the correct URL
3. Pass `app.externalId` from dashboard components that have the full app object
4. API endpoints that return app data should include `externalId` in the response (already part of the `apps` table via `...appRow`)

### 2.4 Dashboard URL Builders

**File:** `apps/dashboard/src/lib/platform-urls.ts`

Add cases to all URL builder functions:

```typescript
export function buildExternalAppUrl(platform: PlatformId, slug: string, externalId?: string | null): string {
  switch (platform) {
    // ... existing ...
    case "newplatform":
      // If the platform needs externalId for human URLs:
      if (externalId) return `https://marketplace.example.com/apps/${externalId}`;
      return `https://marketplace.example.com/apps/${slug}`;
  }
}

export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string { ... }
export function buildExternalSearchUrl(platform: PlatformId, query: string): string { ... }
export function buildExternalKeywordUrl(platform: PlatformId, keyword: string): string { ... }
```

**Note:** `platform-urls.ts` and `platforms.ts` both have URL builder functions. The shared package has `buildExternalAppUrl` and `buildExternalCategoryUrl`. The dashboard adds `buildExternalSearchUrl` and `buildExternalKeywordUrl`. Both must be updated.

### 2.5 Similarity Weights & Stop Words

**File:** `packages/shared/src/similarity.ts`

Has platform-keyed similarity weights and stop word sets. Add an entry for the new platform:

```typescript
const PLATFORM_SIMILARITY_WEIGHTS: Record<string, SimilarityWeights> = {
  // ... existing ...
  newplatform: { category: 0.25, feature: 0.25, keyword: 0.25, text: 0.25 },
};

const PLATFORM_SIMILARITY_STOP_WORDS: Record<string, Set<string>> = {
  // ... existing ...
  newplatform: new Set(["platform-specific", "stop", "words"]),
};
```

Also has `platform !== "shopify"` checks in `extractCategorySlugs()` and `extractFeatureHandles()` — non-Shopify platforms use different category slug extraction logic and skip feature taxonomy. Review if the new platform has a feature taxonomy (`hasFeatureTaxonomy`).

### 2.6 Metadata Character Limits

**File:** `apps/dashboard/src/lib/metadata-limits.ts`

This is the single source of truth for all listing field character limits. Used by preview editors AND compare pages.

```typescript
import type { MetadataLimits } from "@/lib/metadata-limits";

const newplatformLimits: MetadataLimits = {
  appName: 30,           // Max characters for app name
  subtitle: 60,          // Tagline / subtitle
  introduction: 100,     // Short description / app introduction
  details: 500,          // Full description / app details
  feature: 80,           // Per-feature character limit
  seoTitle: 60,          // SEO title tag
  seoMetaDescription: 160, // SEO meta description
};
```

Add to the `limitsByPlatform` record:

```typescript
const limitsByPlatform: Record<string, MetadataLimits> = {
  // ... existing ...
  newplatform: newplatformLimits,
};
```

**Current limits by platform:**

| Field | Shopify | Salesforce | Canva | Wix | WordPress | Google WS | Atlassian | Zoom | Zoho | Zendesk |
|-------|---------|------------|-------|-----|-----------|-----------|-----------|------|------|---------|
| appName | 30 | 80 | 18 | 50 | 70 | 50 | 50 | 50 | 50 | 50 |
| subtitle | 62 | 62 | 50 | 80 | 150 | 200 | 80 | 80 | 80 | 80 |
| introduction | 100 | 500 | 50 | 200 | 150 | 200 | 150 | 200 | 200 | 200 |
| details | 500 | 2000 | 200 | 2000 | 5000 | 16000 | 5000 | 2000 | 2000 | 5000 |
| feature | 80 | 80 | 80 | 80 | 0 | 0 | 0 | 0 | 0 | 0 |
| seoTitle | 60 | 60 | 60 | 60 | 0 | 0 | 0 | 0 | 0 | 0 |
| seoMetaDescription | 160 | 160 | 160 | 160 | 0 | 0 | 0 | 0 | 0 | 0 |

**Important:** Research your platform's actual limits before setting values. These control CharBadge color thresholds — wrong limits create misleading UI. Use `0` for fields the platform doesn't have.

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

### 3.2 Migrations (3 migrations needed)

Each new platform requires 3 migrations, following the established naming convention:

**Migration 1: Platform access (`XXXX_seed_<name>_platform.sql`)**

```sql
-- Allow all existing accounts to access the new platform
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'newplatform' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;
```

**Migration 2: Category seeding (`XXXX_seed_<name>_categories.sql`)**

```sql
-- Seed top-level categories
INSERT INTO categories (platform, slug, title, category_level)
VALUES
  ('newplatform', 'category-one', 'Category One', 0),
  ('newplatform', 'category-two', 'Category Two', 0)
ON CONFLICT (platform, slug) DO NOTHING;

-- Seed sub-categories
INSERT INTO categories (platform, slug, title, category_level)
VALUES
  ('newplatform', 'category-one--sub-cat', 'Sub Category', 1)
ON CONFLICT (platform, slug) DO NOTHING;

-- Seed parent-child relationships
INSERT INTO category_parents (category_id, parent_category_id)
SELECT c.id, p.id
FROM categories c
JOIN categories p ON p.platform = 'newplatform' AND p.slug = 'category-one'
WHERE c.platform = 'newplatform' AND c.slug = 'category-one--sub-cat'
ON CONFLICT DO NOTHING;
```

**Migration 3: Platform visibility (`XXXX_seed_<name>_visibility.sql`)**

```sql
-- Hide by default until scraper is tested and data is populated
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('newplatform', false)
ON CONFLICT (platform) DO UPDATE SET is_visible = false;
```

Set `is_visible = true` once the platform is ready for users.

### 3.3 Drizzle Migration Journal

After creating migration SQL files, you MUST update the journal:

**File:** `packages/db/src/migrations/meta/_journal.json`

Add an entry for each new migration:

```json
{
  "idx": 72,
  "version": "7",
  "when": 1774915200000,
  "tag": "0072_seed_newplatform_platform",
  "breakpoints": true
}
```

**Pattern for `when` timestamp:** Use a timestamp that's after the last entry. Convention: increment by 86400000 (1 day) per migration.

**Pattern for `tag`:** Must match the SQL filename without `.sql` extension.

### 3.4 Schema Files Reference

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
| `packages/db/src/schema/platform-visibility.ts` | `platformVisibility` |

### 3.5 Drizzle ORM Gotchas

- Schema file inter-imports must NOT use `.js` extensions (drizzle-kit uses CJS resolver)
- Run migrations from repo root: `npx drizzle-kit generate` then `npx drizzle-kit migrate`
- Date objects in drizzle `sql``...`` templates throw errors — convert to ISO string first
- When creating migrations manually (SQL files), you must also add entries to `_journal.json` — drizzle-kit won't discover bare SQL files without a journal entry

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
  // Optional: if the platform has curated/editorial sections that look like categories
  // but should be tracked as featured_app_sightings instead:
  featuredSectionSlugs: ["editors-choice", "popular-apps"],
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

#### `featuredSectionSlugs` — Curated Sections as Featured Data

Some platforms have curated/editorial sections (e.g., "Editor's Choice", "Popular Apps", "Recommended") that use the same URL structure as regular categories but shouldn't create category records. Instead, their apps should be recorded as `featured_app_sightings`.

**Pattern (Google Workspace example):**

```typescript
export const GOOGLE_WORKSPACE_SEED_CATEGORIES = [
  "business-tools", "communication", "productivity",  // Real categories
] as const;

export const GOOGLE_WORKSPACE_FEATURED_SECTIONS = [
  "apps-to-discover", "popular-apps", "recommended", "top-rated",  // Curated sections
] as const;

export const GOOGLE_WORKSPACE_CONSTANTS: PlatformConstants = {
  seedCategories: [...GOOGLE_WORKSPACE_SEED_CATEGORIES, ...GOOGLE_WORKSPACE_FEATURED_SECTIONS],
  featuredSectionSlugs: [...GOOGLE_WORKSPACE_FEATURED_SECTIONS],
  // ...
};
```

When `featuredSectionSlugs` is set, the category scraper's `crawlCategoryGeneric()` method automatically:
1. Checks if the current slug is in `featuredSectionSlugs`
2. If yes: records apps as `featured_app_sightings` (surface="home", surfaceDetail=slug) instead of category rankings
3. Skips category record creation/updates for these slugs

**Important:** Also set `hasFeaturedSections: true` in the platform config when using this pattern.

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

### 4.6 Fetching Strategies

There are multiple fetching patterns used across platforms. Choose the right one based on how the marketplace serves its data.

#### Strategy 1: HTTP Client — Static HTML (Shopify, Wix)

Simplest approach. Use when pages return server-rendered HTML:

```typescript
async fetchAppPage(slug: string): Promise<string> {
  return this.httpClient.fetchPage(this.buildAppUrl(slug));
}
```

#### Strategy 2: HTTP Client with Custom Headers (Shopify, Salesforce, Zoom)

Some endpoints require specific headers to return the right format:

```typescript
// Shopify search — Turbo Frame partial response
async fetchSearchPage(keyword: string): Promise<string | null> {
  return this.httpClient.fetchPage(url, { headers: { "Turbo-Frame": "search-results" } });
}

// Zoom — JSON API requires Accept header
async fetchCategoryPage(slug: string): Promise<string> {
  return this.httpClient.fetchPage(url, { headers: { Accept: "application/json" } });
}
```

#### Strategy 3: REST/JSON API (WordPress, Atlassian, Zoom)

When the marketplace has a public REST API, fetch JSON directly. Parsers use `JSON.parse()` instead of Cheerio:

```typescript
// WordPress — REST API for plugins
async fetchAppPage(slug: string): Promise<string> {
  return this.httpClient.fetchPage(`https://wordpress.org/wp-json/wp/v2/plugins/${slug}`);
}

// Atlassian — parallel API calls to multiple endpoints
async fetchAppPage(slug: string): Promise<string> {
  const [addon, version, vendor, pricing] = await Promise.all([
    this.httpClient.fetchPage(`/rest/2/addons/${slug}`),
    this.httpClient.fetchPage(`/rest/2/addons/${slug}/versions/latest`),
    this.httpClient.fetchPage(`/rest/2/addons/${slug}/vendor`),
    this.httpClient.fetchPage(`/rest/2/addons/${slug}/pricing`),
  ]);
  return JSON.stringify({ addon, version, vendor, pricing });
}
```

#### Strategy 4: Direct `fetch()` — Third-Party API (Zendesk/Algolia)

When the marketplace uses a third-party service (e.g., Algolia) with its own API. Bypasses both httpClient and browserClient:

```typescript
// Zendesk — Algolia API for categories & search
private async algoliaQuery(params: { query?: string; facetFilters?: string[][] }): Promise<string> {
  const body = JSON.stringify({
    requests: [{ indexName: "appsIndex", params: urlParams.toString() }],
  });
  const url = `${ALGOLIA_BASE}?x-algolia-api-key=${API_KEY}&x-algolia-application-id=${APP_ID}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://www.zendesk.com/" },
    body,
  });
  return resp.text();
}
```

#### Strategy 5: Browser Client — SPA / Cloudflare (Canva, Google Workspace, Zendesk)

For JavaScript-rendered SPAs or Cloudflare-protected pages:

```typescript
async fetchAppPage(slug: string): Promise<string> {
  return this.browserClient.fetchPage(url, {
    waitUntil: "domcontentloaded",
    extraWaitMs: 3000,  // Wait for SPA hydration
  });
}
```

**When to use browser:** Client-side rendering (React/Angular SPA), Cloudflare challenge, or JavaScript execution required.

#### Strategy 6: Browser with Response Interception (Canva)

For SPAs where the real data comes from XHR/fetch calls that the browser makes. Intercept API responses instead of parsing rendered HTML:

```typescript
// Canva — intercept search API response triggered by typing in search box
async fetchSearchPage(keyword: string): Promise<string | null> {
  const page = await this.ensureBrowserPage();
  let apiResponse: string | null = null;
  page.on("response", async (resp) => {
    if (resp.url().includes("/_ajax/appsearch/search")) {
      apiResponse = await resp.text();
    }
  });
  await page.fill("input[type=search]", keyword);
  // ... wait for response
  return apiResponse;
}
```

#### Strategy 7: Script Tag Extraction (Atlassian, Wix, Zoho)

When data is embedded in HTML as a JavaScript variable or JSON blob. Fetch HTML via HTTP, then extract embedded data in the parser:

```typescript
// Zoho — app details embedded as `var detailsObject = {...}` in script tag
async fetchAppPage(slug: string): Promise<string> {
  return this.httpClient.fetchPage(url);  // Standard HTTP GET
}
// Parser extracts: html.match(/var detailsObject\s*=\s*({[\s\S]*?});/)?.[1]

// Atlassian — Apollo cache in __INITIAL_STATE__ script tag
// Parser extracts: html.match(/__INITIAL_STATE__\s*=\s*({.*});/)?.[1]

// Wix — React Query state (base64-encoded)
// Parser extracts: html.match(/__REACT_QUERY_STATE__\s*=\s*"([^"]+)"/)?.[1]
```

#### Strategy 8: Browser with Scroll/Lazy Loading (Google Workspace)

For infinite-scroll pages that load more content as you scroll:

```typescript
// Google Workspace — scroll to load all results
private async scrollToLoadAll(page: Page): Promise<void> {
  let previousHeight = 0;
  while (true) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
  }
}
```

#### Strategy 9: Mixed Strategies Per Content Type (Salesforce, Zoho, Zendesk)

Many platforms use different strategies for different content types. This is the most common real-world pattern:

| Platform | App Details | Categories | Search | Reviews | Featured |
|----------|------------|------------|--------|---------|----------|
| Salesforce | Browser (fallback: HTTP) | HTTP + API headers | HTTP + API headers | HTTP + JSON header | N/A |
| Zoho | HTTP (script tag) | Browser (SPA) | Browser (SPA) | N/A | N/A |
| Zendesk | Browser (Cloudflare) | Algolia API (`fetch()`) | Algolia API (`fetch()`) | Browser (same as app) | Browser |

**Tip:** Always prefer HTTP/API over browser when possible — it's faster, more reliable, and doesn't need Playwright.

---

**Current fetching strategy by platform:**

| Platform | Primary Strategy | Special Patterns |
|----------|-----------------|------------------|
| Shopify | HTTP | Custom `Turbo-Frame` header for search |
| Salesforce | HTTP + API headers | Browser fallback for app details; parallel not used |
| Canva | Persistent browser | Response interception for search/app APIs; Cloudflare handling |
| Wix | HTTP | `__REACT_QUERY_STATE__` (base64) script tag extraction |
| WordPress | REST API (JSON) | HTML only for review pages |
| Google Workspace | Persistent browser | `scrollToLoadAll()` for lazy-loaded content; auth state |
| Atlassian | REST API + HTML | Parallel API calls for app details; `__INITIAL_STATE__` for categories |
| Zoom | JSON API | `Accept: application/json` header; public endpoints only |
| Zoho | Mixed HTTP/Browser | HTTP for app details (`var detailsObject`); Browser for SPA categories/search |
| Zendesk | Mixed Algolia/Browser | Direct `fetch()` POST to Algolia API; Browser for app details (Cloudflare) |

**Browser auth state:** For Cloudflare-protected or session-dependent sites, persist auth cookies:
```typescript
const AUTH_STATE_FILE = "canva-auth-state.json";
await browserContext.storageState({ path: AUTH_STATE_FILE });
// On next launch:
const context = await browser.newContext({ storageState: AUTH_STATE_FILE });
```

### 4.7 Slug Format

Choose a slug format that is URL-safe and can uniquely identify apps:

| Platform | Slug Example | Notes |
|----------|-------------|-------|
| Shopify | `oberlo` | Direct URL path segment |
| Salesforce | `a0N3u00000PXabc` | Salesforce listingId |
| Canva | `AAFxxx--my-app` | `--` separator (replaces `/` in URL path) |
| Wix | `plugin-name` | Direct slug |
| WordPress | `plugin-name` | Direct slug |
| Google Workspace | `vendor--app-name` | `--` separator (replaces `/` in URL path) |
| Atlassian | `com.vendor.plugin-key` | addonKey (reverse domain notation); uses `external_id` for human URLs |
| Zoom | `base64-like-id` | App ID from Zoom JSON API |
| Zoho | `crm--jotform` | `{service}--{namespace}` format; service is the Zoho product (crm, desk, books, etc.) |
| Zendesk | `972305--slack` | `{numericId}--{textSlug}`; product type (support/sell/chat) in `externalId` for URL reconstruction |

**`--` separator pattern:** Canva, Google Workspace, Zoho, and Zendesk use hierarchical URL paths but `/` is not safe in URL path segments. We use `--` as separator: `AAFxxx--my-app-name`. Convert back with `slug.replace("--", "/")` for external URLs. Zoho uses `{service}--{namespace}`, Zendesk uses `{numericId}--{textSlug}`.

**Same `--` pattern for category slugs:** Wix and Google Workspace also use `--` for hierarchical category slugs (e.g., `business-tools--accounting`).

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
if (platform === "canva" || platform === "google_workspace" || platform === "zoho" || platform === "zendesk") {
  browserClient = new BrowserClient();
}
// Add your platform:
if (platform === "newplatform") {
  browserClient = new BrowserClient();
}
```

**Also update `apps/scraper/src/cli.ts`** — the CLI tool has its own browser client init:

```typescript
if (platformArg === "salesforce" || platformArg === "canva" || platformArg === "google_workspace" || platformArg === "zoho" || platformArg === "zendesk") {
  browserClient = new BrowserClient();
}
```

### 4.10 Scraper Platform Checks (Hardcoded Logic in Scrapers)

The base scraper classes have hardcoded `isShopify` branching and platform-specific checks. These use a **Shopify-first pattern** — Shopify has its own code path, and all other platforms go through a generic `platformModule` path. Review each file carefully when adding a new platform:

#### `apps/scraper/src/scrapers/app-details-scraper.ts`

- **`isShopify` getter** (line ~39): Branches between Shopify-specific and generic parsing
- **Category resolution** (line ~314): Non-Shopify platforms match existing DB categories; Shopify creates new categories on the fly
- **Category ranking** (line ~397): Non-Shopify platforms insert `appCategoryRankings`; Shopify doesn't (categories come from category scraper)
- **Similar apps** (line ~412): Only Shopify parses similar apps from HTML

Most new platforms will automatically work via the generic `platformModule` path. Only review if your platform has unique category or similar app handling.

#### `apps/scraper/src/scrapers/category-scraper.ts`

- **`isShopify` getter** (line ~64): Branches between Shopify's featured app recording and generic category crawling
- **Featured section detection**: Checks `mod.constants.featuredSectionSlugs` to route curated sections to `recordFeaturedSightingsFromApps()` instead of normal category flow
- **`recordFeaturedSightingsFromApps()`**: Upserts apps and creates `featured_app_sightings` rows (surface="home", surfaceDetail=slug)
- **Hardcoded `"shopify"` strings**: Several methods have `platform: "shopify"` literals in record-writing calls — these are inside Shopify-only code paths so won't affect new platforms, but review for correctness

New platforms use the generic `crawlCategoryGeneric()` path via `platformModule`.

#### `apps/scraper/src/scrapers/keyword-scraper.ts`

- **`isShopify` getter** (line ~33): Branches between Shopify HTML scraping and generic module path
- **`is_built_for_shopify` field** (lines ~211, 394): Set during keyword ranking snapshots — irrelevant for non-Shopify
- **Rating validation** (line ~453): `if (this.platform !== "shopify" && (hasRating || hasCount))` — special validation for non-Shopify platforms

New platforms use the generic `scrapeKeywordGeneric()` path.

#### `apps/scraper/src/scrapers/keyword-suggestion-scraper.ts`

- **Canva hardcheck** (line ~105): `if (this.platform === "canva" && this.platformModule)` — calls `(this.platformModule as CanvaModule).generateSuggestions()` with a hardcoded type cast
- If the new platform has a custom suggestion API, add a similar branch here, or better: implement `generateSuggestions()` on the PlatformModule interface

#### `apps/scraper/src/jobs/backfill-categories.ts`

- **URL pattern extraction** (lines ~51-69): Each platform has a different category URL pattern:
  ```typescript
  if (platform === "shopify") slug = url.match(/\/categories\/([\w-]+)/)?.[1];
  else if (platform === "salesforce") slug = url.match(/\/collection\/([\w-]+)/)?.[1];
  else if (platform === "canva") slug = url.match(/\/apps\/collection\/([\w-]+)/)?.[1];
  else if (platform === "wix") {
    const m = url.match(/\/category\/([^/?]+)(?:\/([^/?]+))?/);
    slug = m ? (m[2] ? `${m[1]}--${m[2]}` : m[1]) : undefined;
  }
  else if (platform === "wordpress") slug = url.match(/\/tags\/([\w-]+)/)?.[1];
  else if (platform === "google_workspace") {
    const m = url.match(/\/marketplace\/category\/([^/?]+)(?:\/([^/?]+))?/);
    slug = m ? (m[2] ? `${m[1]}--${m[2]}` : m[1]) : undefined;
  }
  else if (platform === "atlassian") slug = url.match(/\/categories\/([^/?]+)/)?.[1];
  else if (platform === "zoom") {
    const zoomMatch = url.match(/[?&]category=([^&]+)/);
    slug = zoomMatch?.[1] ? decodeURIComponent(zoomMatch[1]) : undefined;
  }
  else if (platform === "zoho") {
    const zohoMatch = url.match(/\/app\/([^/?#]+)$/);
    slug = zohoMatch?.[1] ?? undefined;
  }
  else if (platform === "zendesk") {
    const zendeskMatch = url.match(/[?&]categories\.name=([^&]+)/);
    slug = zendeskMatch?.[1] ? decodeURIComponent(zendeskMatch[1]) : undefined;
  }
  ```
  **MUST add** a new `else if` for the new platform's category URL pattern.

### 4.11 Parser Best Practices

**Category title parsing:** Be careful with selectors that pick up extra text from tooltips, adjacent elements, or hidden content. Always strip unwanted suffixes:
```typescript
const rawTitle = $("h1").first().text().trim();
// Strip tooltip/junk text that gets concatenated
const title = rawTitle.replace(/info\s*More details about user reviews$/i, "").trim();
```

**Rating parsing:** Some platforms show ratings as text ("4.5 out of 5"), some as data attributes, some in structured JSON. Always validate parsed values are in the expected range (0-5 for ratings, >= 0 for counts).

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

The dashboard auto-injects `?platform=` from the current URL path, so API routes automatically receive the correct platform. Most routes are already platform-aware — but some have hardcoded platform logic.

### 5.2 Routes That Auto-Handle (no changes needed)

These route files use `eq(table.platform, platform)` and auto-work for any platform:

| File | What it filters |
|------|----------------|
| `apps/api/src/routes/keywords.ts` | Keywords, keyword snapshots, rankings |
| `apps/api/src/routes/competitors.ts` | Competitor apps, rankings, similarity scores |
| `apps/api/src/routes/featured-apps.ts` | Featured sections, sightings, my-apps (gated by `requireCapability`) |
| `apps/api/src/routes/reviews.ts` | Reviews (gated by `requireCapability`) |
| `apps/api/src/routes/ads.ts` | Ad sightings (gated by `requireCapability`) |
| `apps/api/src/routes/research.ts` | Research projects, competitor suggestions |
| `apps/api/src/routes/overview.ts` | Overview stats, freshness, recent changes |
| `apps/api/src/routes/system-admin.ts` | Scraper trigger, stats (uses `PLATFORM_IDS` iteration) |

**Important:** The featured-apps `/sections` endpoint uses `innerJoin(apps, ...)` with `eq(apps.platform, platform)` to filter by platform. Without this join, sections from all platforms would be mixed together.

### 5.3 Routes With Hardcoded Platform Logic (MUST UPDATE)

#### Live Search Route (CRITICAL)

**File:** `apps/api/src/routes/live-search.ts`

This is the most platform-coupled API route. Each platform has a completely different live-search implementation:

```typescript
if (platform === "salesforce") {
  return salesforceLiveSearch(q);   // Calls AppExchange API directly
}
if (platform === "canva") {
  return canvaLiveSearch(q);        // Uses Playwright browser server or DB fallback
}
if (platform === "zoho") {
  return zohoDbSearch(db, q);       // Database fallback (no live search API)
}
if (platform === "zendesk") {
  return zendeskDbSearch(db, q);    // Database fallback (Algolia used only in scraper)
}
// Default: Shopify — HTML scrapes apps.shopify.com/search
```

**You MUST add** a new `if (platform === "newplatform")` branch with a dedicated search function before the Shopify fallback. For platforms without a live search API, use a database fallback:

```typescript
if (platform === "newplatform") {
  return dbFallbackSearch(db, platform, q);  // Search apps table by name ILIKE
}
```

#### Apps Route — Developer Info Extraction

**File:** `apps/api/src/routes/apps.ts`

Has platform-keyed maps for extracting developer contact info from JSONB `platform_data`:

```typescript
const emailPath: Record<string, string> = {
  canva: "platform_data->>'developerEmail'",
  salesforce: "platform_data->'publisher'->>'email'",
};
```

And the `by-developer` endpoint has explicit `if (platform === "canva") { ... } else if (platform === "salesforce") { ... }` branches.

**Update if** the new platform stores developer info in `platform_data` with a custom JSON structure.

#### Account Route — Similarity Suggestions

**File:** `apps/api/src/routes/account.ts`

The competitor suggestions endpoint has Shopify-specific logic:
- Queries `similar_app_sightings` table (Shopify-only data)
- Applies +5% score bonus for apps in Shopify's "similar apps" sidebar
- Returns `isBuiltForShopify` and `isShopifySimilar` flags

These signals silently zero out for non-Shopify platforms — no breakage, but no benefit either.

#### Categories Route — Hub Page Apps

**File:** `apps/api/src/routes/categories.ts`

Hub page `firstPageApps` parsing assumes `apps.shopify.com` URLs and `is_built_for_shopify` field. Only triggers on Shopify data, so no breakage for other platforms.

### 5.4 Capability Gating in API

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

### 6.1 VALID_PLATFORMS (3 files!)

There are **3 separate `VALID_PLATFORMS` definitions** that must ALL be updated:

**a) Auth Context — `apps/dashboard/src/lib/auth-context.tsx`**

```typescript
const VALID_PLATFORMS = new Set(["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "newplatform"]);
```

Controls the auto-injection of `?platform=` in API calls. If your platform isn't in this set, no API calls from dashboard pages under `/<platform>/` will work.

**b) Proxy — `apps/dashboard/src/proxy.ts`**

```typescript
const VALID_PLATFORMS = ["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "newplatform"];
```

Controls which platforms the Next.js proxy accepts. Missing this causes API proxy 404s.

**c) Admin Scraper Trigger — `apps/dashboard/src/components/admin-scraper-trigger.tsx`**

```typescript
const VALID_PLATFORMS = new Set(["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "newplatform"]);
```

Controls which platforms appear in the system admin scraper trigger UI.

### 6.2 Sidebar Navigation

**File:** `apps/dashboard/src/components/sidebar.tsx`

**4 things to update:**

**a) Label and color:**

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

**b) Platform regex patterns (2 locations):**

The sidebar uses regex to extract the current platform from the URL path. Both occurrences must include the new platform:

```typescript
// ~line 103
const match = pathname.match(/^\/(shopify|salesforce|canva|wix|wordpress|google_workspace|atlassian|zoom|zoho|zendesk|newplatform)(\/|$)/);

// ~line 136
const platformMatch = pathname.match(/^\/(shopify|salesforce|canva|wix|wordpress|google_workspace|atlassian|zoom|zoho|zendesk|newplatform)(\/|$)/);
```

**Missing this causes:** The sidebar won't highlight the correct platform or render nav items for the new platform's routes.

**c) Research exclusion (hardcoded):**

Research is currently excluded for some platforms via a hardcoded check. Decide whether the new platform should have Research. If not, add it to the exclusion list.

**d) Beta badge (optional):**

If the new platform should show a badge in the sidebar:

```typescript
{platformId === "newplatform" && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
    Beta
  </span>
)}
```

**Nav items** are auto-generated from capability flags via `getNavItems()` — no additional changes needed for that part.

### 6.3 App Badges

**File:** `apps/dashboard/src/components/app-badges.tsx`

Has a `BADGE_CONFIG` record keyed by platform. Add an entry for the new platform:

```typescript
const BADGE_CONFIG: Record<string, Record<string, { label: string; color: string }>> = {
  // ... existing ...
  newplatform: {
    // Add platform-specific badges if any
    verified: { label: "Verified", color: "bg-green-100 text-green-800" },
  },
};
```

Also has a hardcoded `platform === "shopify"` check for the "Built for Shopify" badge (line 53). If the new platform has a similar "built for" badge concept, add it here.

### 6.4 Platform Labels, Colors & Brands (3 files!)

There are **3 files** with `PLATFORM_LABELS` and/or `PLATFORM_COLORS` records. All must be updated:

**a) Sidebar — `apps/dashboard/src/components/sidebar.tsx`**

```typescript
const PLATFORM_LABELS: Record<PlatformId, string> = { ..., newplatform: "New Platform" };
const PLATFORM_COLORS: Record<PlatformId, string> = { ..., newplatform: "#FF5733" };
```

**b) Platform Overview Cards — `apps/dashboard/src/components/platform-overview-cards.tsx`**

```typescript
const PLATFORM_LABELS: Record<PlatformId, string> = { ..., newplatform: "New Platform" };
const PLATFORM_COLORS: Record<PlatformId, string> = { ..., newplatform: "#FF5733" };
```

**CRITICAL: `PLATFORM_BRANDS` record** — This file also has a `PLATFORM_BRANDS` record used on the `/overview` page. **If the new platform is missing from this record, the overview page will crash.** Add:

```typescript
const PLATFORM_BRANDS: Record<string, { label: string; color: string; textColor?: string }> = {
  // ... existing ...
  newplatform: { label: "New Platform", color: "#FF5733" },
};
```

**c) Overview Page — `apps/dashboard/src/app/(dashboard)/[platform]/overview/page.tsx`**

```typescript
const PLATFORM_COLORS: Record<string, string> = { ..., newplatform: "#FF5733" };
```

This controls the accent color on the overview page header card.

### 6.5 Capability Flag Usage in Dashboard

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

### 6.6 Platform-Specific Pages (Hardcoded Logic)

These pages have hardcoded platform checks (`isCanva`, `isSalesforce`, etc.) that **must** be updated when adding a new platform. They are NOT driven by capability flags.

#### Preview Page & Component

**Files:**
- `[platform]/apps/[slug]/preview/page.tsx` — routing & guard
- `[platform]/apps/[slug]/preview/<platform>-preview.tsx` — NEW file per platform

The preview page has a hardcoded guard, component selector, and label. You must create a `<platform>-preview.tsx` file following the same pattern (returns `{ preview, editor, resetToOriginal }`). Use `getMetadataLimits(platform)` for character limits.

#### Details Page — Field Labels & Platform-Specific Sections

**File:** `[platform]/apps/[slug]/details/page.tsx`

Has hardcoded `isCanva` and `isSalesforce` checks for:
- **Field labels**: "App Introduction" vs "Short Description" (Canva) vs "Description"
- **CharBadge limits**: Using `getMetadataLimits()` for character count badges
- **Feature labels**: "Features" vs "Highlights" (Salesforce)
- **Platform-only sections**: Industries/Business Needs (Salesforce), Permissions (Canva)
- **SEO section**: Hidden for platforms without SEO metadata

For a new platform, decide: Does it have unique sections? Does it use different field labels?

#### Changes Page — Field Labels

**File:** `[platform]/apps/[slug]/changes/page.tsx`

Has a `getFieldLabels()` function with platform-specific labels. Must add a branch for the new platform if it uses different terminology.

#### App Overview Page — Field Labels

**File:** `[platform]/apps/[slug]/page.tsx`

Has a `getFieldLabels()` function. Update with the new platform's terminology.

#### Compare Page — Section Configuration (~25+ locations)

**File:** `[platform]/apps/[slug]/compare/page.tsx`

This is the most complex page for platform-specific logic. It uses `isCanva` and `isSalesforce` booleans to control section labels, visibility, and field rendering (~15 locations). When adding a new platform, update the `SECTIONS` array builder and all conditional renders.

#### Featured Page — Platform-Aware Description

**File:** `[platform]/featured/page.tsx`

The featured page description references the platform name. Uses `PLATFORMS[platform].name`.

#### Featured Tabs — External URL Handling

**File:** `[platform]/featured/featured-tabs.tsx`

The `SectionCard` component builds external URLs differently depending on the `surface` and `surfaceDetail`. For curated sections (surface="home", surfaceDetail=slug), it links to the platform's base URL or builds a category-style external URL.

#### Keywords Page — Ads Column

**File:** `[platform]/keywords/page.tsx`

Has a hardcoded Shopify-specific ads check. If the new platform has ad tracking, update this (or use `caps.hasAdTracking`).

#### Research Compare Page

**File:** `[platform]/research/[id]/compare/page.tsx`

Has platform exclusion checks for ratings/reviews section. If the new platform doesn't have reviews, add it to this exclusion.

### 6.7 Pages That Need Capability Gating

**CRITICAL:** Every table, card, and column that shows platform-specific data must be wrapped with the appropriate `caps.hasX` check.

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

### 6.8 The `isCol()` and `visibleToggleableColumns` Pattern

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

### 6.9 Default Sort Key

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

### 6.10 Sub-Component Gotcha

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
  // ... existing Shopify, Salesforce, Canva, Wix, WordPress, Google Workspace schedules ...

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

### 8.2 Platform Visibility Table

`platform_visibility` controls whether a platform is visible to regular users. Even if an account has platform access, the platform won't appear in the sidebar or overview page if `is_visible = false`.

```sql
CREATE TABLE platform_visibility (
  platform varchar(20) PRIMARY KEY,
  is_visible boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT NOW()
);
```

**Strategy:** Set `is_visible = false` initially while testing the scraper and populating data. Set to `true` once the platform is ready for production use. System admins can toggle this via the admin panel.

### 8.3 Package Limits

Packages (subscription tiers) have a `max_platforms` limit:

| Package | max_platforms |
|---------|-------------|
| free | 1 |
| starter | 3 |
| pro | 3 |
| enterprise | 3 |

### 8.4 Enabling Platform Access

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
| `hasFeaturedSections` | Featured scraper enabled | Featured endpoint active | Featured nav item, Featured tab, featured columns, My Featured Apps section |
| `hasAdTracking` | Ad detection in search | Ads endpoint active | Ads tab, Ads columns, Visibility card ads section |
| `hasSimilarApps` | Similar apps parser | Similar endpoint | Similar tab |
| `hasAutoSuggestions` | Suggestion scraper enabled | Suggest endpoint | Auto-suggest in search bars |
| `hasFeatureTaxonomy` | Feature parsing | Features endpoint | Features nav item |
| `hasPricing` | Pricing plan parsing | Pricing in snapshots | Pricing column/card, Min. Paid column |
| `hasLaunchedDate` | Launch date parsing | Launch date in app response | Launched column/card |
| `maxRatingStars` | N/A (data field) | N/A | Controls star count in Rating card, Review Pulse card, Rating Distribution, and inline review stars |

### Platform-Specific Rating Scale

Most platforms use a 5-star rating scale, but some differ (e.g., Atlassian uses 4 stars). The `maxRatingStars` property in the platform config controls:

- **Rating stat card** (`layout.tsx`): Number of star icons displayed (`Array.from({ length: caps.maxRatingStars }, ...)`)
- **Rating Distribution** (`reviews/page.tsx`): Number of rows in the distribution breakdown (no 5-star row for Atlassian)
- **Review Pulse mini distribution** (`page.tsx`): Same as Rating Distribution
- **Inline review stars** (`page.tsx`): Empty star count uses `caps.maxRatingStars - r.rating` instead of `5 - r.rating`

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

**Problem:** Setting `hasFeaturedSections: true` before having featured data causes empty featured sections to render.

**Solution:** Start with `false` for everything you're not 100% sure about. Enable flags only after confirming the platform supports that feature and your scraper collects the data.

### Pitfall 2: Missing capability gates in tables

**Problem:** After adding a new platform, Rating/Reviews/Pricing/Launched columns still show in 5+ pages that weren't in the original plan.

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

**Solution:** Add platform to `VALID_PLATFORMS` set in ALL 3 files: `auth-context.tsx`, `proxy.ts`, `admin-scraper-trigger.tsx`.

### Pitfall 7: Forgetting URL builders

**Problem:** "View on Platform" external link goes to wrong URL.

**Solution:** Update switch statements in BOTH:
- `packages/shared/src/constants/platforms.ts` → `buildExternalAppUrl`, `buildExternalCategoryUrl`
- `apps/dashboard/src/lib/platform-urls.ts` → all 4 URL builder functions

### Pitfall 8: Slug format issues

**Problem:** Slugs with special characters break URLs.

**Solution:** Design URL-safe slug format from the start. If the platform uses `/` in identifiers, replace with `--` or similar. Canva, Wix, and Google Workspace all use this pattern.

### Pitfall 8b: External URL needs a different ID than the slug

**Problem:** The platform uses one identifier (e.g., `addonKey`) for API calls but a different identifier (e.g., numeric `addonId`) for human-readable URLs. Example: Atlassian uses `com.xpandit.plugins.xray` as the slug for `/rest/2/addons/{key}`, but the marketplace URL is `https://marketplace.atlassian.com/apps/1211769`.

**Solution:**
1. Add migration: `ALTER TABLE apps ADD COLUMN IF NOT EXISTS external_id varchar(100);`
2. Store the external identifier during scraping (in both category parser via `NormalizedCategoryApp.externalId` and app detail scraper via `_externalId` field)
3. Use the optional `externalId` parameter in `buildExternalAppUrl(platform, slug, externalId?)`
4. Pass `app.externalId` in dashboard components where the full app object is available
5. Add `externalId: apps.externalId` to API endpoint `select()` queries that return competitor/app data

### Pitfall 9: Scraper rate limiting and OOM

**Problem:** Getting blocked by rate limiters, or OOM kills when running full category scrape on production.

**Solution:**
- Use conservative rate limits and browser client for SPAs
- Save auth state (cookies) for Cloudflare-protected sites
- On production, run scrapers one section at a time via the interactive worker container, not all at once
- For browser-based platforms, memory usage is significantly higher — monitor container memory

### Pitfall 10: Empty data columns (category rankings)

**Problem:** Category ranking columns appear empty for new platform.

**Solution:** This is a data issue, not a UI bug. Ensure the category scraper has been run first: `npx tsx apps/scraper/src/cli.ts category --platform=newplatform`.

### Pitfall 11: Sidebar regex patterns not updated

**Problem:** New platform's URL path doesn't match the sidebar's platform extraction regex, causing no nav items to render.

**Solution:** Update BOTH regex patterns in `sidebar.tsx`.

### Pitfall 12: Missing metadata-limits entry

**Problem:** Preview editor and compare page show wrong character limits (falls back to Shopify defaults).

**Solution:** Always add the new platform to `metadata-limits.ts` with researched limits.

### Pitfall 13: Hardcoded field labels in multiple files

**Problem:** App overview, details, changes, and compare pages all have `isCanva ? "X" : "Y"` patterns for field labels. Missing one causes inconsistent terminology.

**Solution:** Search for all `isCanva` and `isSalesforce` references and add the new platform's labels. Files: `page.tsx` (overview), `details/page.tsx`, `changes/page.tsx`, `compare/page.tsx`.

### Pitfall 14: Login/legacy redirects hardcoded to Shopify

**Problem:** After login/register, users are redirected to `/shopify/overview` regardless of their enabled platforms.

**Solution:** Currently hardcoded in `auth-context.tsx` and `proxy.ts`. Consider making dynamic based on `enabledPlatforms[0]`.

### Pitfall 15: Forgetting proxy.ts VALID_PLATFORMS

**Problem:** Dashboard API calls fail with 404 even though `auth-context.tsx` VALID_PLATFORMS is updated.

**Solution:** There are **3 separate VALID_PLATFORMS** definitions. Missing any one causes subtle failures.

### Pitfall 16: Missing BADGE_CONFIG entry

**Problem:** App badges don't render for the new platform, or worse, crash with undefined key access.

**Solution:** Add an entry (even empty) to `BADGE_CONFIG` in `app-badges.tsx`.

### Pitfall 17: Scraper backfill-categories URL pattern

**Problem:** Category backfill job silently skips the new platform because URL pattern doesn't match.

**Solution:** Add an `else if (platform === "newplatform")` branch in `backfill-categories.ts` with the correct category URL regex pattern.

### Pitfall 18: Missing PLATFORM_BRANDS in overview cards (CRASH)

**Problem:** The `/overview` page crashes with a runtime error if the new platform is missing from the `PLATFORM_BRANDS` record in `platform-overview-cards.tsx`.

**Solution:** Always add the new platform to `PLATFORM_BRANDS` in `platform-overview-cards.tsx`. This is different from `PLATFORM_LABELS`/`PLATFORM_COLORS` — it's a separate record used specifically for the cross-platform overview page cards.

### Pitfall 19: Curated categories vs real categories

**Problem:** Some platforms (e.g., Google Workspace) have curated/editorial sections ("Editor's Choice", "Popular Apps") that use the same URL structure as regular categories. If you scrape these as regular categories, they pollute the category tree with non-hierarchical entries.

**Solution:** Use `featuredSectionSlugs` in `PlatformConstants` to mark these slugs. The category scraper will automatically route them to `featured_app_sightings` instead of creating category records. Also set `hasFeaturedSections: true`.

### Pitfall 20: Featured apps API missing platform filter

**Problem:** The `/api/featured-apps/sections` endpoint returned sections from ALL platforms mixed together because it only filtered `featured_app_sightings` by date, not by platform.

**Solution:** The sections endpoint MUST use `innerJoin(apps, eq(apps.id, featuredAppSightings.appId))` and filter with `eq(apps.platform, platform)`. This was a real bug discovered during Google Workspace integration.

### Pitfall 21: Category title parser picks up junk text

**Problem:** HTML parsers may pick up tooltip text, hidden elements, or adjacent content when extracting category/section titles. Example: Google Workspace's `h1` tag included "infoMore details about user reviews" tooltip text.

**Solution:** Always strip known junk patterns from parsed titles. Validate titles look reasonable before storing.

### Pitfall 22: Container replacement during long scrape operations

**Problem:** Running a long scrape operation (e.g., category scraper for all sections) on production, the container gets replaced mid-scrape when Coolify auto-deploys a new commit.

**Solution:** Be aware that pushes to main trigger auto-deploy. Either:
- Pause auto-deploy during long scrape operations
- Run scrapes one section at a time so each completes quickly
- Use the interactive worker container (which has a different lifecycle)

### Pitfall 23: Drizzle migration journal not updated

**Problem:** Created SQL migration files but forgot to add entries to `_journal.json`. Drizzle-kit doesn't discover them automatically.

**Solution:** Always update `packages/db/src/migrations/meta/_journal.json` with an entry for each new migration file. Use sequential `idx` and `when` timestamps.

### Pitfall 24: Flat vs tree category display not updated

**Problem:** Categories page renders as a tree by default. Platforms with flat (non-hierarchical) categories need to be added to the `isFlat` check.

**Solution:** In `apps/dashboard/src/app/(dashboard)/[platform]/categories/page.tsx`, update the `isFlat` constant:

```typescript
const isFlat = platform === "wordpress" || platform === "zoom" || platform === "atlassian"
  || platform === "zoho" || platform === "zendesk";
```

If your new platform uses flat categories (no parent-child hierarchy), add it here. Tree view is default for hierarchical platforms (Shopify, Salesforce, Canva, Wix, Google Workspace).

### Pitfall 25: API-only platforms (no HTML scraping)

**Problem:** Some platforms expose public REST/JSON APIs that return structured data, making HTML scraping unnecessary.

**Solution:** For API-only platforms (like Atlassian REST API, Zoom JSON API), the `fetchAppPage` / `fetchCategoryPage` methods still return a string — but it's JSON, not HTML. Parsers use `JSON.parse()` instead of Cheerio. The PlatformModule interface works the same way; only the parser implementation differs.

**Current API-only or hybrid-API platforms:**
| Platform | API Type | Notes |
|----------|----------|-------|
| Atlassian | REST API v2 (`/rest/2/addons`) + HTML (`window.__INITIAL_STATE__`) | REST for apps/search/reviews/featured, HTML for categories |
| Zoom | Public JSON API (`/api/v1/apps`) | Pure JSON for everything, no HTML at all |
| Zoho | HttpClient (`var detailsObject`) + BrowserClient (SPA) | App details from inline JS; categories/search need Playwright |
| Zendesk | Algolia API + BrowserClient (Cloudflare) | Categories/search via Algolia JSON API; app details need Playwright (Cloudflare) |

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
- [ ] `/<platform>/apps/<slug>/details` — Detail page renders with correct field labels
- [ ] `/<platform>/apps/<slug>/changes` — Change history renders with correct field labels
- [ ] `/<platform>/apps/<slug>/preview` — Preview page renders (not "Preview not available")
- [ ] `/<platform>/apps/<slug>/preview` — Editor fields have correct character limits
- [ ] `/<platform>/apps/<slug>/compare` — Compare page shows correct sections for platform
- [ ] `/<platform>/competitors` — Global competitors table: correct columns
- [ ] `/<platform>/keywords` — Keyword list (if hasKeywordSearch)
- [ ] `/<platform>/keywords/<slug>` — Keyword detail: app results table has correct columns
- [ ] `/<platform>/categories` — Category tree/list renders
- [ ] `/<platform>/categories/<slug>` — Category detail renders
- [ ] `/<platform>/research` — Research projects page
- [ ] `/<platform>/research/<id>` — Research detail: tables have correct columns, no inline ratings if disabled
- [ ] `/<platform>/research/<id>/competitors` — Correct columns, correct default sort
- [ ] `/<platform>/featured` — Hidden from nav if `hasFeaturedSections: false`, shows "My Featured Apps and Competitors" section with data if enabled
- [ ] `/<platform>/features` — Hidden from nav if `hasFeatureTaxonomy: false`
- [ ] `/overview` — Cross-platform overview page shows the new platform card (no crash!)
- [ ] Search bar — App search works for new platform
- [ ] Track/untrack — Can follow/unfollow apps
- [ ] External links — "View on Platform" opens correct URL

### Regression Verification (All Existing Platforms)

- [ ] `/shopify/apps` — All columns still visible
- [ ] `/shopify/apps/<slug>` — All tabs, all cards present
- [ ] `/salesforce/apps` — All columns still visible
- [ ] `/salesforce/apps/<slug>` — Correct tabs/cards for Salesforce capabilities
- [ ] `/canva/apps` — Correct columns (no reviews/pricing/launched)
- [ ] `/canva/apps/<slug>` — Correct tabs/cards for Canva capabilities
- [ ] `/wix/apps` — Correct columns for Wix capabilities
- [ ] `/wordpress/apps` — Correct columns for WordPress capabilities
- [ ] `/google_workspace/apps` — Correct columns for Google Workspace capabilities
- [ ] `/atlassian/apps` — Correct columns (4-star ratings, no launched date)
- [ ] `/atlassian/apps/<slug>` — Correct tabs/cards for Atlassian capabilities
- [ ] `/zoom/apps` — Correct columns (no reviews, no pricing, no launched)
- [ ] `/zoom/apps/<slug>` — Correct tabs/cards for Zoom capabilities
- [ ] All platform previews still work with correct character limits
- [ ] `/overview` — Cross-platform overview page shows all platforms

### Scraper Verification

- [ ] CLI category scrape: `npx tsx apps/scraper/src/cli.ts category --platform=newplatform`
- [ ] CLI app scrape: `npx tsx apps/scraper/src/cli.ts app <slug> --platform=newplatform`
- [ ] Data appears in database: `SELECT * FROM apps WHERE platform = 'newplatform' LIMIT 5;`
- [ ] CLI keyword scrape (if applicable): `npx tsx apps/scraper/src/cli.ts keyword <keyword> --platform=newplatform`
- [ ] Featured sections appear (if applicable): `SELECT * FROM featured_app_sightings fas JOIN apps a ON a.id = fas.app_id WHERE a.platform = 'newplatform' LIMIT 5;`

### Smoke Test

**File:** `scripts/smoke-test.sh`

The smoke test script runs live CLI checks against every platform. When adding a new platform, you **must** add a `test_<platform>()` function to this script. The goal is **0 SKIPs** — only list checks the platform actually supports.

- [ ] Add a `test_<platform>()` function with the appropriate checks
- [ ] Add the platform name to the `ALL_PLATFORMS` array
- [ ] Add `--skip-browser` guard if the platform requires Playwright
- [ ] Run `./scripts/smoke-test.sh --platform <name>` and verify all checks pass
- [ ] Run `./scripts/smoke-test.sh` (full) and confirm 0 SKIPs in summary

**Which checks to include** — only add a line for checks the platform supports:

| Check | When to include | Example CLI command |
|-------|----------------|---------------------|
| `categories` | Always | `$CLI --platform <name> categories <slug>` |
| `app` | If app detail scraping works without auth | `$CLI --platform <name> app <slug>` |
| `keyword` | If `hasKeywordSearch: true` | `$CLI --platform <name> keyword "<term>"` |
| `reviews` | If `hasReviews: true` | `$CLI --platform <name> reviews <slug>` |
| `featured` | If `fetchFeaturedSections()` is implemented | `$CLI --platform <name> featured` |

**Do NOT** add checks that will always fail (e.g., reviews for a platform with `hasReviews: false`, or app detail for a platform requiring auth). Omit the line entirely instead of adding a skip.

**Template:**

```bash
test_newplatform() {
  local t=$TIMEOUT_HTTP  # or $TIMEOUT_BROWSER for Playwright platforms
  # Add this guard for browser-dependent platforms:
  # if $SKIP_BROWSER; then skip_check newplatform all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ newplatform${RESET} (HTTP only)"
  run_check newplatform categories "$t" $CLI --platform newplatform categories <category-slug>
  run_check newplatform app        "$t" $CLI --platform newplatform app <app-slug>
  run_check newplatform keyword    "$t" $CLI --platform newplatform keyword "<search-term>"
  run_check newplatform reviews    "$t" $CLI --platform newplatform reviews <app-slug>
  run_check newplatform featured   "$t" $CLI --platform newplatform featured
}
```

---

## 12. File Reference

### Shared Package (must change)

| File | Change |
|------|--------|
| `packages/shared/src/constants/platforms.ts` | Add platform config + capability flags + URL builders |
| `packages/shared/src/similarity.ts` | Add similarity weights + stop words |

### Scraper (must change)

| File | Change |
|------|--------|
| `apps/scraper/src/platforms/<name>/index.ts` | PlatformModule implementation |
| `apps/scraper/src/platforms/<name>/constants.ts` | Seed categories, rate limits, scoring config, `featuredSectionSlugs` |
| `apps/scraper/src/platforms/<name>/urls.ts` | URL builders |
| `apps/scraper/src/platforms/<name>/parsers/*.ts` | HTML/JSON parsers |
| `apps/scraper/src/platforms/registry.ts` | Register module in switch statement |
| `apps/scraper/src/scheduler.ts` | Add cron schedules |
| `apps/scraper/src/process-job.ts` | Add browser client init (if needed) |
| `apps/scraper/src/cli.ts` | Add browser client init (if needed) — mirrors `process-job.ts` logic |
| `apps/scraper/src/jobs/backfill-categories.ts` | Add category URL pattern extraction |
| `apps/scraper/src/scrapers/keyword-suggestion-scraper.ts` | Add branch if custom suggestion API |
| `scripts/smoke-test.sh` | Add `test_<name>()` function and add to `ALL_PLATFORMS` array |

### API (review required)

| File | Change |
|------|--------|
| `apps/api/src/routes/live-search.ts` | **CRITICAL** — Add platform-specific live search function |
| `apps/api/src/routes/apps.ts` | Add developer info extraction from `platformData` (if custom JSON structure) |
| `apps/api/src/routes/account.ts` | Review Shopify-specific similarity signals (no breakage, but no benefit) |
| `apps/api/src/routes/categories.ts` | Review hub page parsing (Shopify-specific, no breakage) |
| `apps/api/src/routes/featured-apps.ts` | Auto-handles — verify platform filter on `/sections` uses innerJoin |
| Other routes | Auto-handle via `getPlatformFromQuery()` — no changes needed |

### Dashboard (must change)

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/auth-context.tsx` | Add to `VALID_PLATFORMS` |
| `apps/dashboard/src/proxy.ts` | Add to `VALID_PLATFORMS` array |
| `apps/dashboard/src/lib/platform-urls.ts` | Add URL builder cases (4 switch statements) |
| `apps/dashboard/src/lib/metadata-limits.ts` | Add platform character limits |
| `apps/dashboard/src/components/sidebar.tsx` | Add label, color, update 2 regex patterns |
| `apps/dashboard/src/components/admin-scraper-trigger.tsx` | Add to `VALID_PLATFORMS` set |
| `apps/dashboard/src/components/app-badges.tsx` | Add `BADGE_CONFIG` entry |
| `apps/dashboard/src/components/platform-overview-cards.tsx` | Add `PLATFORM_LABELS`, `PLATFORM_COLORS`, and **`PLATFORM_BRANDS`** entries |
| `[platform]/overview/page.tsx` | Add to `PLATFORM_COLORS` record |
| `[platform]/apps/[slug]/preview/page.tsx` | Add guard, component selector, label |
| `[platform]/apps/[slug]/preview/<name>-preview.tsx` | **NEW** — Platform preview component |
| `[platform]/apps/[slug]/details/page.tsx` | Add field labels, platform-specific sections |
| `[platform]/apps/[slug]/changes/page.tsx` | Add field labels |
| `[platform]/apps/[slug]/page.tsx` | Add field labels in `getFieldLabels()` |
| `[platform]/apps/[slug]/compare/page.tsx` | Add sections config, field labels (~25 locations) |
| `[platform]/categories/page.tsx` | Add to `isFlat` check if flat categories (no parent-child hierarchy) |
| `[platform]/research/[id]/compare/page.tsx` | Add platform exclusion checks if no reviews |
| All table pages (see Section 6.7-6.10) | Gate columns with capability flags |

### Database (conditional)

| File | Change |
|------|--------|
| `packages/db/src/migrations/XXXX_seed_<name>_platform.sql` | Seed `account_platforms` for new platform |
| `packages/db/src/migrations/XXXX_seed_<name>_categories.sql` | Seed categories and parent-child relationships |
| `packages/db/src/migrations/XXXX_seed_<name>_visibility.sql` | Seed `platform_visibility` (hidden by default) |
| `packages/db/src/migrations/meta/_journal.json` | Add entries for all new migrations |

---

## Summary

Adding a new platform follows this order (9th platform and beyond):

1. **Config first** — Get capability flags right in `platforms.ts`, add URL builders, similarity weights, metadata limits
2. **Database second** — Create 3 migrations: platform access, categories, visibility
3. **Scraper third** — Build module, parsers, register, schedule, update `backfill-categories.ts` URL pattern
4. **API fourth** — Add live-search function, review `apps.ts` developer info extraction
5. **Dashboard last** — Update ALL 3 `VALID_PLATFORMS`, sidebar (labels, colors, 2 regex patterns), `app-badges.tsx`, `platform-overview-cards.tsx` (LABELS + COLORS + **BRANDS**), preview component, field labels (details, changes, overview, compare pages), research compare page, capability-gate all tables
6. **Test everything** — New platform pages AND regression on ALL 8 existing platforms

The biggest time sinks are:
- **Compare pages** — `[slug]/compare/page.tsx` (~25 locations) + `research/[id]/compare/page.tsx` with hardcoded platform checks
- **Details/changes pages** — Field label mappings per platform
- **Preview** — Creating a new platform-specific preview component
- **Tables** — Systematically finding and gating every column, card, tab, and inline display
- **VALID_PLATFORMS** — 3 separate definitions that must ALL be updated
- **PLATFORM_BRANDS** — Separate from labels/colors, missing it crashes the overview page

Use grep to find all platform-specific references before declaring the task complete:

```bash
grep -rn "isCanva\|isSalesforce\|isShopify\|isAtlassian\|isZoom\|platform === \"shopify\"\|platform === \"canva\"\|platform === \"salesforce\"\|platform === \"wix\"\|platform === \"wordpress\"\|platform === \"google_workspace\"\|platform === \"atlassian\"\|platform === \"zoom\"" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```
