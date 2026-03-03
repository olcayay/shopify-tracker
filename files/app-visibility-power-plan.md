# App Visibility & App Power Score - Data Model Reference & Implementation Plan

## Table of Contents

1. [Data Models Overview](#1-data-models-overview)
2. [App Model (Core + Snapshots + Metrics)](#2-app-model)
3. [Keyword Model (Core + Snapshots + Rankings)](#3-keyword-model)
4. [Category Model (Core + Snapshots + Rankings)](#4-category-model)
5. [Model Relationships](#5-model-relationships)
6. [Available Data for Scoring](#6-available-data-for-scoring)
7. [App Visibility Score Design](#7-app-visibility-score-design)
8. [App Power Score Design](#8-app-power-score-design)
9. [Implementation Plan](#9-implementation-plan)

---

## 1. Data Models Overview

The project uses **Drizzle ORM with PostgreSQL**. Data is organized around three core entities (`apps`, `trackedKeywords`, `categories`) and connected via time-series snapshot/ranking tables linked to `scrapeRuns`.

**Key Design Patterns:**
- **Snapshot Pattern** - Temporal data stored as immutable records per scrape run
- **Sighting Pattern** - Tracks individual occurrences (ads, featured placements)
- **Account-Scoped Tracking** - Multi-tenant layer on top of global data

---

## 2. App Model

### 2.1 Core Table: `apps`

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `slug` | varchar(255) | UNIQUE, NOT NULL - primary identifier |
| `name` | text | NOT NULL |
| `isTracked` | boolean | default: false |
| `isBuiltForShopify` | boolean | default: false |
| `launchedDate` | timestamp | nullable |
| `iconUrl` | text | nullable |
| `appCardSubtitle` | text | nullable |
| `averageRating` | decimal(3,2) | nullable - current rating |
| `ratingCount` | integer | nullable - current review count |
| `pricingHint` | text | nullable |
| `createdAt` | timestamp | NOT NULL |
| `updatedAt` | timestamp | NOT NULL |

### 2.2 `appSnapshots` - Full App Detail at Point in Time

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |
| `scrapedAt` | timestamp | when scraped |
| `appIntroduction` | text | short description |
| `appDetails` | text | long description |
| `seoMetaDescription` | text | SEO meta |
| `seoTitle` | text | SEO title |
| `features` | jsonb (string[]) | feature list |
| `pricing` | text | pricing summary |
| `averageRating` | decimal(3,2) | rating at scrape time |
| `ratingCount` | integer | review count at scrape time |
| `developer` | jsonb (AppDeveloper) | {name, url, website?} |
| `demoStoreUrl` | text | nullable |
| `languages` | jsonb (string[]) | supported languages |
| `integrations` | jsonb (string[]) | integrations |
| `categories` | jsonb (AppCategory[]) | categories + subcategories + features |
| `pricingPlans` | jsonb (PricingPlan[]) | pricing tiers |
| `support` | jsonb (AppSupport) | {email, portal_url, phone} |

**Index:** (appSlug, scrapedAt)

### 2.3 `appFieldChanges` - Field-Level Change History

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `field` | varchar(50) | field name that changed |
| `oldValue` | text | previous value |
| `newValue` | text | current value |
| `detectedAt` | timestamp | when change detected |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |

### 2.4 `appCategoryRankings` - App Position in Category Pages

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `categorySlug` | varchar(255) | denormalized category reference |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |
| `scrapedAt` | timestamp | |
| `position` | smallint | rank position on category page |

**Index:** (appSlug, categorySlug, scrapedAt)

### 2.5 `appReviewMetrics` - Computed Review Statistics

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `computedAt` | date | computation date |
| `ratingCount` | integer | total reviews |
| `averageRating` | decimal(3,2) | average score |
| `v7d` | integer | reviews in last 7 days |
| `v30d` | integer | reviews in last 30 days |
| `v90d` | integer | reviews in last 90 days |
| `accMicro` | decimal(8,2) | micro acceleration (7d actual vs expected) |
| `accMacro` | decimal(8,2) | macro acceleration (30d actual vs expected) |
| `momentum` | varchar(20) | spike / accelerating / slowing / stable / flat |

**Unique:** (appSlug, computedAt)

### 2.6 `appSimilarityScores` - Inter-App Similarity

| Field | Type | Notes |
|-------|------|-------|
| `appSlugA` / `appSlugB` | varchar(255) | FK -> apps.slug |
| `overallScore` | decimal(5,4) | weighted overall |
| `categoryScore` | decimal(5,4) | Jaccard on categories |
| `featureScore` | decimal(5,4) | Jaccard on features |
| `keywordScore` | decimal(5,4) | Jaccard on keywords |
| `textScore` | decimal(5,4) | Jaccard on text tokens |
| `computedAt` | date | |

### 2.7 `reviews` - Individual User Reviews

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `reviewDate` | date | |
| `content` | text | review text |
| `reviewerName` | varchar(500) | |
| `reviewerCountry` | varchar(255) | nullable |
| `durationUsingApp` | varchar(255) | nullable |
| `rating` | smallint | 1-5 |
| `developerReplyDate` | date | nullable |
| `developerReplyText` | text | nullable |

### 2.8 Sighting Tables

#### `featuredAppSightings` - Featured Placements
| Field | Type | Notes |
|-------|------|-------|
| `appSlug` | varchar(255) | FK -> apps.slug |
| `surface` | varchar(50) | homepage / category |
| `surfaceDetail` | varchar(255) | specific section |
| `sectionHandle` | varchar(255) | section identifier |
| `position` | smallint | placement position |
| `seenDate` | date | |
| `timesSeenInDay` | smallint | |

#### `similarAppSightings` - "More Like This" Section
| Field | Type | Notes |
|-------|------|-------|
| `appSlug` | varchar(255) | the app being viewed |
| `similarAppSlug` | varchar(255) | the recommended app |
| `position` | smallint | |
| `seenDate` | date | |

#### `categoryAdSightings` - Ads in Category Pages
| Field | Type | Notes |
|-------|------|-------|
| `appSlug` | varchar(255) | advertiser app |
| `categorySlug` | varchar(255) | target category |
| `seenDate` | date | |
| `timesSeenInDay` | smallint | |

---

## 3. Keyword Model

### 3.1 Core Table: `trackedKeywords`

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `keyword` | varchar(255) | UNIQUE, NOT NULL - the search term |
| `slug` | varchar(255) | UNIQUE, NOT NULL - URL-safe version |
| `isActive` | boolean | default: true |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 3.2 `keywordSnapshots` - Full Search Results at Point in Time

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `keywordId` | integer | FK -> trackedKeywords.id |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |
| `scrapedAt` | timestamp | |
| `totalResults` | integer | nullable - total matching apps in Shopify |
| `results` | jsonb (KeywordSearchApp[]) | all apps from search pages |

**Each `KeywordSearchApp` contains:**

| Property | Type | Notes |
|----------|------|-------|
| `position` | number | rank in results |
| `app_slug` | string | app identifier |
| `app_name` | string | |
| `short_description` | string | |
| `average_rating` | number | |
| `rating_count` | number | |
| `app_url` | string | |
| `logo_url` | string | |
| `pricing_hint` | string? | |
| `is_sponsored` | boolean? | ad placement |
| `is_built_in` | boolean? | Shopify native |
| `is_built_for_shopify` | boolean? | BFS badge |

**Index:** (keywordId, scrapedAt)

### 3.3 `appKeywordRankings` - App Position for a Keyword Over Time

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `keywordId` | integer | FK -> trackedKeywords.id |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |
| `scrapedAt` | timestamp | |
| `position` | smallint | nullable (null = dropped out) |

**Index:** (appSlug, keywordId, scrapedAt)

### 3.4 `keywordAutoSuggestions` - Autocomplete Data

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `keywordId` | integer | FK -> trackedKeywords.id |
| `suggestions` | jsonb (string[]) | autocomplete terms |
| `scrapedAt` | timestamp | |

### 3.5 `keywordAdSightings` - Ad Appearances on Keywords

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `appSlug` | varchar(255) | FK -> apps.slug |
| `keywordId` | integer | FK -> trackedKeywords.id |
| `seenDate` | date | |
| `timesSeenInDay` | smallint | |

**Unique:** (appSlug, keywordId, seenDate)

### 3.6 Keyword Tags (Account-Scoped)

#### `keywordTags`
| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PRIMARY KEY |
| `accountId` | uuid | FK -> accounts.id |
| `name` | varchar(50) | tag name |
| `color` | varchar(20) | display color |

#### `keywordTagAssignments`
| Field | Type | Notes |
|-------|------|-------|
| `tagId` | uuid | FK -> keywordTags.id |
| `keywordId` | integer | FK -> trackedKeywords.id |

---

## 4. Category Model

### 4.1 Core Table: `categories`

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `slug` | varchar(255) | UNIQUE, NOT NULL |
| `title` | varchar(500) | NOT NULL |
| `url` | varchar(500) | NOT NULL |
| `parentSlug` | varchar(255) | nullable - parent category for hierarchy |
| `categoryLevel` | smallint | NOT NULL - depth in tree (1=root, 2=sub, etc.) |
| `description` | text | default: "" |
| `isTracked` | boolean | default: true |
| `isListingPage` | boolean | default: true (false = hub page) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 4.2 `categorySnapshots` - Category Data at Point in Time

| Field | Type | Notes |
|-------|------|-------|
| `id` | serial | PRIMARY KEY |
| `categorySlug` | varchar(255) | FK -> categories.slug |
| `scrapeRunId` | uuid | FK -> scrapeRuns.id |
| `scrapedAt` | timestamp | |
| `dataSourceUrl` | varchar(500) | |
| `appCount` | integer | nullable - total apps in category |
| `firstPageMetrics` | jsonb (FirstPageMetrics) | aggregated stats |
| `firstPageApps` | jsonb (FirstPageApp[]) | ranked apps on first page |
| `breadcrumb` | text | |

**`FirstPageMetrics` contains:**

| Property | Type | Notes |
|----------|------|-------|
| `sponsored_count` | number | ads on first page |
| `built_for_shopify_count` | number | BFS apps on first page |
| `count_100_plus_reviews` | number | apps with 100+ reviews |
| `count_1000_plus_reviews` | number | apps with 1000+ reviews |
| `total_reviews` | number | sum of all first page reviews |
| `top_4_avg_rating` | number | average rating of top 4 |
| `top_4_avg_rating_count` | number | average review count of top 4 |
| `top_1_pct_reviews` | number | top 1 app's review share |
| `top_4_pct_reviews` | number | top 4 apps' review share |
| `top_8_pct_reviews` | number | top 8 apps' review share |

**`FirstPageApp` contains:**

| Property | Type | Notes |
|----------|------|-------|
| `name` | string | |
| `short_description` | string | |
| `average_rating` | number | |
| `rating_count` | number | |
| `app_url` | string | |
| `logo_url` | string | |
| `position` | number? | rank on page |
| `pricing_hint` | string? | |
| `is_sponsored` | boolean? | |
| `is_built_for_shopify` | boolean? | |

**Index:** (categorySlug, scrapedAt)

---

## 5. Model Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                        RELATIONSHIP MAP                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   App ◄──── appKeywordRankings ────► Keyword                    │
│    │         (position per scrape)      │                        │
│    │                                    │                        │
│    │        keywordAdSightings          │                        │
│    ├──── (ad on keyword search) ───────►│                        │
│    │                                    │                        │
│    │        keywordSnapshots.results    │                        │
│    ├──── (in search results JSONB) ────►│                        │
│    │                                                             │
│    │                                                             │
│    │◄──── appCategoryRankings ────► Category                    │
│    │       (position per scrape)       │                         │
│    │                                   │                         │
│    │      categoryAdSightings          │                         │
│    ├──── (ad on category page) ───────►│                         │
│    │                                   │                         │
│    │      categorySnapshots            │                         │
│    ├──── (in firstPageApps JSONB) ────►│                         │
│    │                                                             │
│    │                                                             │
│    ├──── appSnapshots (full detail)                              │
│    ├──── appFieldChanges (delta tracking)                        │
│    ├──── reviews (user reviews)                                  │
│    ├──── appReviewMetrics (computed stats)                       │
│    ├──── appSimilarityScores (app-to-app)                       │
│    ├──── featuredAppSightings (homepage/hub placements)          │
│    └──── similarAppSightings (recommendation section)            │
│                                                                  │
│   Category                                                       │
│    ├──── categorySnapshots (first page data)                     │
│    └──── self-reference via parentSlug (hierarchy)               │
│                                                                  │
│   Keyword                                                        │
│    ├──── keywordSnapshots (full search results)                  │
│    └──── keywordAutoSuggestions (autocomplete)                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Available Data for Scoring

### 6.1 Data Available for App Visibility Score

| Data Point | Source Table | Notes |
|------------|-------------|-------|
| Keywords an app ranks for | `appKeywordRankings` | position per keyword per day |
| Search result position | `appKeywordRankings.position` | smallint, null = not ranking |
| Total results for keyword (proxy for search volume) | `keywordSnapshots.totalResults` | no real search volume data |
| Category rankings | `appCategoryRankings.position` | position on category page |
| Total apps in category | `categorySnapshots.appCount` | nullable |
| Featured placements | `featuredAppSightings` | homepage/hub visibility |
| Ad presence | `keywordAdSightings`, `categoryAdSightings` | paid visibility |
| "Similar Apps" placements | `similarAppSightings` | recommendation visibility |

**Important Note:** We do NOT have actual keyword search volume data from Shopify. `totalResults` (total apps matching a keyword) serves as a demand proxy.

### 6.2 Data Available for App Power Score

| Data Point | Source Table | Notes |
|------------|-------------|-------|
| Average rating | `apps.averageRating` | current rating |
| Review count | `apps.ratingCount` | current total reviews |
| Rating history | `appSnapshots.averageRating` | per scrape |
| Review count history | `appSnapshots.ratingCount` | per scrape |
| Review volume 7d/30d/90d | `appReviewMetrics.v7d/v30d/v90d` | computed |
| Momentum | `appReviewMetrics.momentum` | spike/accelerating/slowing/stable/flat |
| Acceleration | `appReviewMetrics.accMicro/accMacro` | trend change rate |
| Category rank | `appCategoryRankings.position` | position over time |
| Total apps in category | `categorySnapshots.appCount` | for percentile |
| isBuiltForShopify | `apps.isBuiltForShopify` | quality badge |
| Feature count | `appSnapshots.features` | JSONB array |
| Category count | `appSnapshots.categories` | JSONB array |
| Integration count | `appSnapshots.integrations` | JSONB array |
| Keyword ranking count | `appKeywordRankings` | how many keywords ranked |
| Developer info | `appSnapshots.developer` | developer reputation |
| Pricing plans | `appSnapshots.pricingPlans` | monetization strategy |
| Launch date | `apps.launchedDate` | app maturity |
| Similarity scores | `appSimilarityScores` | competitive density |
| Featured appearances | `featuredAppSightings` | editorial recognition |

---

## 7. App Visibility Score Design

**Definition:** Measures how discoverable an app is across Shopify's search and browsing surfaces.

### 7.1 Page Boundary Model

Shopify displays **24 apps per page** in both keyword search results and category listings. A user must click "next page" to see results beyond rank 24. This creates a **massive visibility cliff** at page boundaries:

- Rank 24 vs Rank 25 is a far bigger gap than Rank 23 vs Rank 24
- Rank 48 vs 49 is another cliff (page 2 -> page 3)
- Each successive page gets exponentially less traffic

The rank weight formula must account for this page-boundary decay.

### 7.2 Formula

#### Step 1 - Page Penalty Factor
```
PAGE_SIZE = 24

page = floor((rank - 1) / PAGE_SIZE)        // 0-indexed page number
page_penalty = PAGE_DECAY ^ page             // PAGE_DECAY = 0.3

// page 0 (ranks 1-24):  penalty = 1.0
// page 1 (ranks 25-48): penalty = 0.3
// page 2 (ranks 49-72): penalty = 0.09
// page 3+:              penalty ≈ 0 (negligible)
```

#### Step 2 - Within-Page Rank Weight
```
rank_weight = (1 / log2(rank + 1)) * page_penalty
```

| Rank | Page | log2 Weight | Page Penalty | Final Weight |
|------|------|-------------|--------------|--------------|
| 1 | 0 | 1.000 | 1.00 | **1.000** |
| 3 | 0 | 0.500 | 1.00 | **0.500** |
| 10 | 0 | 0.289 | 1.00 | **0.289** |
| 20 | 0 | 0.228 | 1.00 | **0.228** |
| 24 | 0 | 0.214 | 1.00 | **0.214** |
| 25 | 1 | 0.211 | 0.30 | **0.063** ← cliff |
| 30 | 1 | 0.197 | 0.30 | **0.059** |
| 48 | 1 | 0.172 | 0.30 | **0.052** |
| 49 | 2 | 0.171 | 0.09 | **0.015** ← cliff |
| 72 | 2 | 0.152 | 0.09 | **0.014** |

The drop from rank 24 (0.214) to rank 25 (0.063) is a **3.4x decrease** -- correctly reflecting the page turn friction.

#### Step 3 - Keyword Score (per keyword)
```
keyword_score = totalResults * rank_weight
```
`totalResults` is used as a proxy for search volume (we don't have real search volume data).

#### Step 4 - Total Visibility (Raw)
```
visibility_raw = SUM(keyword_score for all keywords the app ranks for)
```

#### Step 5 - Normalize (0-100)
```
visibility_score = 100 * (app_visibility_raw / max_visibility_raw_in_category)
```
Normalization is per-category so apps are compared within their competitive context.

### 7.3 Data Sources Required

| Input | Source | Query Pattern |
|-------|--------|---------------|
| All keywords an app ranks for | `appKeywordRankings` | WHERE appSlug = ? AND position IS NOT NULL, latest scrape |
| Rank position per keyword | `appKeywordRankings.position` | latest non-null position |
| totalResults per keyword | `keywordSnapshots.totalResults` | latest snapshot for each keywordId |
| Category membership | `appSnapshots.categories` OR `appCategoryRankings` | for normalization grouping |
| Max visibility in category | computed | aggregate across all apps in category |

### 7.4 Considerations

- **No real search volume**: `totalResults` is the best proxy we have. A keyword with 500 total results has more demand than one with 50.
- **Multi-category apps**: An app can be in max 2 categories. Score should be computed per each category separately.
- **Scrape frequency**: Use the most recent scrape data for each keyword.
- **Dropped rankings**: `position = NULL` means app no longer ranks -- these should be excluded.
- **PAGE_DECAY tuning**: 0.3 means page 2 gets 30% of page 1's weight. This can be adjusted based on real click-through data if available.

---

## 8. App Power Score Design

**Definition:** Measures overall market authority and competitive strength.

### 8.1 Components

#### Component 1 - Rating Score (weight: 0.35)
```
rating_score = averageRating / 5
```
| Source | `apps.averageRating` or latest `appSnapshots.averageRating` |
|--------|-----|

#### Component 2 - Review Authority (weight: 0.25, log scale)
```
review_score = log10(ratingCount + 1)
```
| Source | `apps.ratingCount` or latest `appSnapshots.ratingCount` |
|--------|-----|

Needs normalization: divide by `log10(max_reviews_in_category + 1)` to get 0-1 range.

#### Component 3 - Category Rank Score (weight: 0.25)

An app can be in **max 2 categories** (primary + secondary). The category score must account for two factors:

**A) Page-boundary decay applies here too** (24 apps per page in category listings):
```
PAGE_SIZE = 24
page = floor((rank - 1) / PAGE_SIZE)
page_penalty = PAGE_DECAY ^ page              // PAGE_DECAY = 0.3
```

**B) Category size weighting** -- being ranked #10 in a 1000-app category is much harder than #10 in a 100-app category:
```
size_weight = log10(total_apps_in_category + 1)
```

| Category Size | size_weight |
|---------------|-------------|
| 50 apps | 1.71 |
| 100 apps | 2.00 |
| 500 apps | 2.70 |
| 1000 apps | 3.00 |
| 5000 apps | 3.70 |

**C) Combined category rank score:**
```
percentile = 1 - (category_rank / total_apps_in_category)
category_rank_score = percentile * page_penalty * size_weight
```

**D) Multi-category aggregation** (max 2 categories):
```
// If app is in 2 categories, take weighted best:
category_score = max(cat1_score, cat2_score)

// Or weighted average favoring the stronger one:
category_score = 0.7 * max(cat1_score, cat2_score) + 0.3 * min(cat1_score, cat2_score)
```

| Source | `appCategoryRankings.position` + `categorySnapshots.appCount` |
|--------|-----|

**Example comparison:**
| App | Category | Rank | Total Apps | Percentile | Page Penalty | Size Weight | Score |
|-----|----------|------|------------|------------|-------------|-------------|-------|
| A | Forms | 10 | 100 | 0.90 | 1.0 | 2.00 | **1.80** |
| B | Marketing | 10 | 1000 | 0.99 | 1.0 | 3.00 | **2.97** |
| C | Forms | 25 | 100 | 0.75 | 0.3 | 2.00 | **0.45** ← page 2 penalty |
| D | Marketing | 25 | 1000 | 0.975 | 0.3 | 3.00 | **0.88** ← page 2 but big category |

#### Component 4 - Momentum (weight: 0.15)
```
momentum_score = rank_change_30d / max_rank_change
```
| Source | Compare `appCategoryRankings.position` 30 days apart, or use `appReviewMetrics.accMacro` |
|--------|-----|

**Alternative momentum sources:**
- `appReviewMetrics.momentum` (spike/accelerating/slowing/stable/flat)
- `appReviewMetrics.accMicro` / `accMacro` (numeric acceleration values)
- Rating count growth over 30 days from `appSnapshots`

### 8.2 Final Power Score
```
power_raw = 0.35 * rating_score
          + 0.25 * review_score_normalized
          + 0.25 * category_score
          + 0.15 * momentum_score

power_score = 100 * (power_raw / max_power_raw_in_category)
```

### 8.3 Data Sources Required

| Input | Source | Query Pattern |
|-------|--------|---------------|
| averageRating | `apps` | current rating |
| ratingCount | `apps` | current review count |
| Category rank | `appCategoryRankings` | latest position per category |
| Total apps in category | `categorySnapshots.appCount` | latest snapshot |
| 30d rank change | `appCategoryRankings` | compare latest vs 30 days ago |
| Review acceleration | `appReviewMetrics` | latest accMacro/momentum |
| Max reviews in category | computed | max ratingCount among apps in same category |
| Max power in category | computed | for final normalization |

---

## 9. Implementation Plan

### Phase 1: Schema & Shared Logic

1. **Create `appVisibilityScores` table** in `packages/db/src/schema/`

   Historical time-series table -- one row per app per category per computation day.

   | Field | Type | Notes |
   |-------|------|-------|
   | `id` | serial | PRIMARY KEY |
   | `appSlug` | varchar(255) | FK -> apps.slug |
   | `categorySlug` | varchar(255) | which category this score is relative to |
   | `computedAt` | date | computation date (daily granularity) |
   | `scrapeRunId` | uuid | FK -> scrapeRuns.id |
   | `keywordCount` | smallint | number of keywords the app ranks for |
   | `visibilityRaw` | decimal(12,4) | raw sum before normalization |
   | `visibilityScore` | smallint | normalized 0-100 |

   **Indexes:**
   - `UNIQUE (appSlug, categorySlug, computedAt)` -- one score per day per category
   - `(appSlug, computedAt)` -- app history queries
   - `(categorySlug, computedAt, visibilityScore DESC)` -- category leaderboard

2. **Create `appPowerScores` table** in `packages/db/src/schema/`

   Historical time-series table -- one row per app per category per computation day.

   | Field | Type | Notes |
   |-------|------|-------|
   | `id` | serial | PRIMARY KEY |
   | `appSlug` | varchar(255) | FK -> apps.slug |
   | `categorySlug` | varchar(255) | which category this score is relative to |
   | `computedAt` | date | computation date (daily granularity) |
   | `scrapeRunId` | uuid | FK -> scrapeRuns.id |
   | `ratingScore` | decimal(5,4) | component: rating / 5 |
   | `reviewScore` | decimal(5,4) | component: log10 review authority |
   | `categoryScore` | decimal(5,4) | component: rank percentile * page penalty * size weight |
   | `momentumScore` | decimal(5,4) | component: 30d trend |
   | `powerRaw` | decimal(8,4) | weighted sum before normalization |
   | `powerScore` | smallint | normalized 0-100 |

   **Indexes:**
   - `UNIQUE (appSlug, categorySlug, computedAt)` -- one score per day per category
   - `(appSlug, computedAt)` -- app history queries
   - `(categorySlug, computedAt, powerScore DESC)` -- category leaderboard

   **Historical data enables:**
   - Trend charts (visibility/power over 7d / 30d / 90d)
   - Score deltas (e.g., "visibility +12 in last 7 days")
   - Momentum detection from score trajectory itself
   - Category leaderboard snapshots over time

3. **Drizzle schema file** `packages/db/src/schema/app-scores.ts`:

   ```typescript
   import {
     pgTable, serial, varchar, date, smallint,
     decimal, timestamp, index, uniqueIndex, uuid,
   } from "drizzle-orm/pg-core";
   import { apps } from "./apps.js";
   import { scrapeRuns } from "./scrape-runs.js";

   export const appVisibilityScores = pgTable(
     "app_visibility_scores",
     {
       id: serial("id").primaryKey(),
       appSlug: varchar("app_slug", { length: 255 })
         .notNull()
         .references(() => apps.slug),
       categorySlug: varchar("category_slug", { length: 255 }).notNull(),
       computedAt: date("computed_at").notNull(),
       scrapeRunId: uuid("scrape_run_id")
         .notNull()
         .references(() => scrapeRuns.id),
       keywordCount: smallint("keyword_count").notNull(),
       visibilityRaw: decimal("visibility_raw", { precision: 12, scale: 4 }).notNull(),
       visibilityScore: smallint("visibility_score").notNull(),
       createdAt: timestamp("created_at").notNull().defaultNow(),
     },
     (table) => [
       uniqueIndex("idx_app_visibility_unique").on(
         table.appSlug, table.categorySlug, table.computedAt,
       ),
       index("idx_app_visibility_app_date").on(table.appSlug, table.computedAt),
       index("idx_app_visibility_cat_date_score").on(
         table.categorySlug, table.computedAt, table.visibilityScore,
       ),
     ]
   );

   export const appPowerScores = pgTable(
     "app_power_scores",
     {
       id: serial("id").primaryKey(),
       appSlug: varchar("app_slug", { length: 255 })
         .notNull()
         .references(() => apps.slug),
       categorySlug: varchar("category_slug", { length: 255 }).notNull(),
       computedAt: date("computed_at").notNull(),
       scrapeRunId: uuid("scrape_run_id")
         .notNull()
         .references(() => scrapeRuns.id),
       ratingScore: decimal("rating_score", { precision: 5, scale: 4 }).notNull(),
       reviewScore: decimal("review_score", { precision: 5, scale: 4 }).notNull(),
       categoryScore: decimal("category_score", { precision: 5, scale: 4 }).notNull(),
       momentumScore: decimal("momentum_score", { precision: 5, scale: 4 }).notNull(),
       powerRaw: decimal("power_raw", { precision: 8, scale: 4 }).notNull(),
       powerScore: smallint("power_score").notNull(),
       createdAt: timestamp("created_at").notNull().defaultNow(),
     },
     (table) => [
       uniqueIndex("idx_app_power_unique").on(
         table.appSlug, table.categorySlug, table.computedAt,
       ),
       index("idx_app_power_app_date").on(table.appSlug, table.computedAt),
       index("idx_app_power_cat_date_score").on(
         table.categorySlug, table.computedAt, table.powerScore,
       ),
     ]
   );
   ```

4. **Create shared scoring functions** in `packages/shared/src/`
   - `app-visibility.ts`: `computeAppVisibility()` - pure function, takes ranking data + totalResults
   - `app-power.ts`: `computeAppPower()` - pure function, takes rating/review/rank data

### Phase 2: Cron Job & Computation

4. **Register cron schedule** in `apps/scraper/src/scheduler.ts`

   ```
   { name: "compute_app_scores", cron: "0 9 * * *", type: "compute_app_scores" }
   ```

   **Current schedule context** (for reference):
   | Time (UTC) | Job |
   |------------|-----|
   | 00:00 | keyword_search |
   | 01:00 | app_details |
   | 03:00 | category |
   | 05:00 | daily_digest |
   | 06:00 | reviews |
   | **09:00** | **compute_app_scores** (new) |
   | 12:00 | keyword_search (2nd run) |
   | 13:00 | app_details (2nd run) |

   09:00 UTC gives ~3 hours buffer after the last data job (reviews at 06:00).

5. **Add `compute_app_scores` to infrastructure**
   - `scraperTypeEnum` in `packages/db/src/schema/scrape-runs.ts`
   - `ScraperJobType` union in `apps/scraper/src/queue.ts`
   - `case "compute_app_scores"` in `apps/scraper/src/process-job.ts`
   - Migration: `ALTER TYPE scraper_type ADD VALUE 'compute_app_scores'`

6. **Create job file** `apps/scraper/src/jobs/compute-app-scores.ts`

   #### 6a. Prerequisite Check (before any computation)

   The job must verify that **all 4 prerequisite jobs** have completed at least once **today** before proceeding:

   ```
   Required: app_details, keyword_search, reviews, category
   ```

   **Check query:**
   ```sql
   SELECT DISTINCT scraper_type
   FROM scrape_runs
   WHERE status = 'completed'
     AND started_at >= CURRENT_DATE
     AND scraper_type IN ('app_details', 'keyword_search', 'reviews', 'category')
   ```

   **If prerequisites NOT met:**
   - Check current time against cutoff (18:00 UTC)
   - If before cutoff: log missing jobs, re-enqueue self with 30-minute delay, return (no scrapeRun record created)
   - If past cutoff: create a failed scrapeRun record with `error: "Prerequisites not met: [missing jobs]"`, do not retry

   **If prerequisites met:**
   - Create scrapeRun record with `status: "running"`
   - Proceed with computation

   **Flow diagram:**
   ```
   09:00 UTC - Scheduler enqueues compute_app_scores
          │
          ▼
   Check scrape_runs for today's completed:
   app_details, keyword_search, reviews, category
          │
          ├── All 4 present? → Proceed with computation
          │
          └── Missing some?
                │
                ├── Before 18:00 UTC? → Re-enqueue with 30min delay
                │                        (09:30, 10:00, 10:30, ...)
                │
                └── After 18:00 UTC? → Fail with "prerequisites not met"
   ```

   #### 6b. Computation Logic

   Once prerequisites pass:

   **Step 1 - Fetch all source data** (batch SQL queries):
   - Latest keyword rankings per (app, keyword) from `appKeywordRankings`
   - Latest totalResults per keyword from `keywordSnapshots`
   - Latest category rank per (app, category) from `appCategoryRankings`
   - App category membership (which categories each app appears in)
   - Category sizes from latest `categorySnapshots`
   - App rating + review count from `apps` table
   - Latest momentum data from `appReviewMetrics`

   **Step 2 - Compute visibility** per (app, category):
   - For each app: sum keyword_scores using rank_weight with page boundary decay
   - Group by category membership
   - Normalize within each category (0-100)

   **Step 3 - Compute power** per (app, category):
   - For each app: compute 4 components (rating, review, categoryRank, momentum)
   - Normalize within each category (0-100)

   **Step 4 - Upsert results**:
   - Insert into `appVisibilityScores` and `appPowerScores`
   - ON CONFLICT (appSlug, categorySlug, computedAt) DO UPDATE (idempotent re-runs)

   **Step 5 - Update scrapeRun**:
   - Set `status: "completed"`
   - Store metadata: `{ apps_computed, categories_processed, duration_ms }`

### Phase 3: API Endpoints

5. **Add API routes** in `apps/api/src/routes/`
   - `GET /apps/:slug/scores` - latest visibility + power scores for an app
   - `GET /apps/:slug/scores/history?days=30` - historical score data for trend charts
   - `GET /categories/:slug/scores` - leaderboard by visibility or power (latest day)
   - `GET /categories/:slug/scores/history?days=30` - category-level score trends

### Phase 4: Dashboard UI

6. **Add score displays** in `apps/dashboard/`
   - App detail page: visibility + power badges with trend sparklines
   - App detail page: score history chart (line chart, 30d/90d toggle)
   - Category page: ranked table with both scores + delta indicators (arrows)
   - Keyword page: show visibility contribution per keyword

---

## Resolved Decisions

1. **Page Boundary Decay**: Shopify uses 24 apps per page. A `PAGE_DECAY = 0.3` multiplier applies at each page boundary for both keyword rank weight and category rank score. Rank 25 is worth ~3.4x less than rank 24.

2. **Multi-Category Apps**: An app can have max 2 categories. Category score is computed separately for each category and aggregated (weighted best or 70/30 split).

3. **Category Size Matters**: `log10(total_apps + 1)` weights larger categories higher. Ranking #10 in a 1000-app category is worth more than #10 in a 100-app category.

4. **Historical Tracking**: Both scores are stored daily as append-only time-series rows. One row per app per category per day. Previous days' data is never overwritten. This enables trend charts, deltas, and momentum detection.

5. **Cron Schedule**: Runs daily at 09:00 UTC. Before computing, checks that `app_details`, `keyword_search`, `reviews`, and `category` jobs have each completed at least once today. If not, retries every 30 minutes until 18:00 UTC cutoff.

---

## Open Questions for Discussion

1. **Search Volume Proxy**: `totalResults` is our only proxy for keyword demand. Should we weight some keywords differently (e.g., tracked vs discovered)?

2. **Category Normalization**: Should the final visibility/power normalization be per-category or global? Per-category gives relative strength within a niche; global gives absolute market position.

3. **Momentum Source**: Should momentum use category rank change, review acceleration (`accMacro`), or review velocity (`v30d`)? Each tells a different story.

4. **Featured/Ad Visibility**: Should `featuredAppSightings` and ad sightings contribute to visibility score as bonus components?

5. **Minimum Data Threshold**: Should apps with very few keyword rankings or no category rankings get a score at all, or be marked as "insufficient data"?

6. **PAGE_DECAY Value**: 0.3 is the proposed default. Should this be configurable? Real click-through drop-off might be even steeper (e.g., 0.2).

7. **Multi-Category Aggregation**: For apps in 2 categories, should we use `max()` (simpler) or `0.7 * max + 0.3 * min` (rewards being strong in both)?

---

## Database Migration

Migration file: `packages/db/src/migrations/0039_app_scores.sql`

All statements use `IF NOT EXISTS` / `IF EXISTS` guards so re-running the migration is safe (idempotent).

```sql
-- =============================================
-- 0039_app_scores.sql
-- Adds compute_app_scores scraper type and
-- app_visibility_scores / app_power_scores tables
-- =============================================

-- 1. Extend scraper_type enum
ALTER TYPE "scraper_type" ADD VALUE IF NOT EXISTS 'compute_app_scores';

-- 2. App Visibility Scores (historical, daily per app per category)
CREATE TABLE IF NOT EXISTS "app_visibility_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "category_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "scrape_run_id" uuid NOT NULL,
  "keyword_count" smallint NOT NULL,
  "visibility_raw" decimal(12, 4) NOT NULL,
  "visibility_score" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_app_slug_apps_slug_fk"
    FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_visibility_scores"
    ADD CONSTRAINT "app_visibility_scores_scrape_run_id_scrape_runs_id_fk"
    FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_visibility_unique"
  ON "app_visibility_scores" USING btree ("app_slug", "category_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_visibility_app_date"
  ON "app_visibility_scores" USING btree ("app_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_visibility_cat_date_score"
  ON "app_visibility_scores" USING btree ("category_slug", "computed_at", "visibility_score");

-- 3. App Power Scores (historical, daily per app per category)
CREATE TABLE IF NOT EXISTS "app_power_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "app_slug" varchar(255) NOT NULL,
  "category_slug" varchar(255) NOT NULL,
  "computed_at" date NOT NULL,
  "scrape_run_id" uuid NOT NULL,
  "rating_score" decimal(5, 4) NOT NULL,
  "review_score" decimal(5, 4) NOT NULL,
  "category_score" decimal(5, 4) NOT NULL,
  "momentum_score" decimal(5, 4) NOT NULL,
  "power_raw" decimal(8, 4) NOT NULL,
  "power_score" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_power_scores"
    ADD CONSTRAINT "app_power_scores_app_slug_apps_slug_fk"
    FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_power_scores"
    ADD CONSTRAINT "app_power_scores_scrape_run_id_scrape_runs_id_fk"
    FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_power_unique"
  ON "app_power_scores" USING btree ("app_slug", "category_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_power_app_date"
  ON "app_power_scores" USING btree ("app_slug", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_app_power_cat_date_score"
  ON "app_power_scores" USING btree ("category_slug", "computed_at", "power_score");
```

### Migration Notes

- **Enum extension**: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is safe to re-run. Runs outside a transaction block automatically in PostgreSQL (Drizzle migrator handles this).
- **Table creation**: `CREATE TABLE IF NOT EXISTS` ensures no error if table already exists.
- **Foreign keys**: Wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object` blocks (same pattern as existing migrations like `0033`, `0035`).
- **Indexes**: All use `IF NOT EXISTS` for idempotent re-runs.
- **No data migration needed**: Tables start empty, scores computed from existing data by the new job.

### Drizzle Journal Entry

Add to `packages/db/src/migrations/meta/_journal.json`:

```json
{
  "idx": 39,
  "version": "7",
  "when": 1772323200000,
  "tag": "0039_app_scores",
  "breakpoints": true
}
```

### Deploy Checklist

1. Migration runs automatically on worker startup via `runMigrations()` in `process-job.ts`
2. `ALTER TYPE ADD VALUE` cannot run inside a transaction -- Drizzle's migrator handles each file as a separate statement, so this works correctly
3. The new tables are created **before** the first `compute_app_scores` job fires
4. Worker restart order doesn't matter -- migration runs on both background and interactive workers, first one wins
5. If the enum value already exists (partial deploy / rollback + redeploy), `IF NOT EXISTS` prevents errors

---

## System Admin Integration

The new job must be visible and triggerable from the System Admin scraper dashboard.

### 1. Dashboard UI (`apps/dashboard/src/app/(dashboard)/system-admin/scraper/page.tsx`)

Add to the `SCRAPER_TYPES` array (line ~49):

```typescript
{
  type: "compute_app_scores",
  label: "App Scores",
  description: "Compute App Visibility & App Power scores for all tracked apps",
  cronHours: [9],
},
```

### 2. System Admin API - Trigger endpoint (`apps/api/src/routes/system-admin.ts`)

Add `"compute_app_scores"` to the `validTypes` array (line ~832):

```typescript
const validTypes = [
  "category",
  "app_details",
  "keyword_search",
  "reviews",
  "daily_digest",
  "compute_review_metrics",
  "compute_similarity_scores",
  "backfill_categories",
  "compute_app_scores",        // <-- add
];
```

### 3. System Admin API - Scrape runs filter (`apps/api/src/routes/system-admin.ts`)

The filter on line ~552 currently only accepts 4 types. Expand it to support all types:

```typescript
// BEFORE (only 4 types):
if (type && ["category", "app_details", "keyword_search", "reviews"].includes(type)) {

// AFTER (all valid types):
if (type) {
```

Since `scraperType` is a PostgreSQL enum, any invalid value will be rejected at the DB level. No need for an allowlist here.

---

## Job Type Registration Checklist

Adding a new scraper job type requires changes across **multiple files**. Missing any one of these causes the "unknown job type" error or silent failures.

### MUST update (job will crash without these):

| # | File | What to change | Line ref |
|---|------|----------------|----------|
| 1 | `packages/db/src/schema/scrape-runs.ts` | Add to `scraperTypeEnum` array | L3-14 |
| 2 | `packages/db/src/migrations/0039_*.sql` | `ALTER TYPE scraper_type ADD VALUE` | migration |
| 3 | `packages/db/src/migrations/meta/_journal.json` | Add journal entry | bottom |
| 4 | `apps/scraper/src/queue.ts` | Add to `ScraperJobType` union type | L8 |
| 5 | `apps/scraper/src/process-job.ts` | Add `case` in switch statement | L54-398 |

### MUST update (admin won't see/trigger the job):

| # | File | What to change | Line ref |
|---|------|----------------|----------|
| 6 | `apps/api/src/routes/system-admin.ts` | Add to `validTypes` array | L832-841 |
| 7 | `apps/api/src/routes/system-admin.ts` | Expand runs filter (or verify type is accepted) | L551-554 |
| 8 | `apps/dashboard/.../scraper/page.tsx` | Add to `SCRAPER_TYPES` array | L49-101 |

### Update if applicable:

| # | File | What to change | When |
|---|------|----------------|------|
| 9 | `apps/scraper/src/scheduler.ts` | Add cron schedule entry | If auto-scheduled |
| 10 | `apps/api/src/routes/admin.ts` | Add to `validTypes` | If account-level trigger needed |
| 11 | `apps/scraper/src/cli.ts` | Add CLI command | If CLI trigger needed |
| 12 | `packages/db/src/index.ts` | Import + re-export new schema tables | If new tables added |

### Safeguard: TypeScript exhaustiveness check

To prevent future "unknown job type" errors at compile time, the switch in `process-job.ts` should use an exhaustiveness check:

```typescript
// At the end of the switch, replace:
default:
  throw new Error(`Unknown scraper type: ${type}`);

// With exhaustive never check:
default: {
  const _exhaustive: never = type;
  throw new Error(`Unknown scraper type: ${_exhaustive}`);
}
```

This way, if a new value is added to `ScraperJobType` but no case is added in the switch, **TypeScript will emit a compile-time error** instead of a runtime crash.

> **Note:** This requires `ScraperJobType` in `queue.ts` to stay in sync with the DB enum. Both must be updated together.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `packages/db/src/schema/app-scores.ts` | CREATE | `appVisibilityScores` + `appPowerScores` tables |
| `packages/db/src/schema/scrape-runs.ts` | MODIFY | Add `compute_app_scores` to `scraperTypeEnum` |
| `packages/db/src/index.ts` | MODIFY | Import + re-export new schema |
| `packages/db/src/migrations/0039_app_scores.sql` | CREATE | Full migration SQL (see above) |
| `packages/db/src/migrations/meta/_journal.json` | MODIFY | Add entry idx 39 |
| `apps/scraper/src/queue.ts` | MODIFY | Add `compute_app_scores` to `ScraperJobType` union |
| `apps/scraper/src/scheduler.ts` | MODIFY | Add `{ name: "compute_app_scores", cron: "0 9 * * *" }` |
| `apps/scraper/src/process-job.ts` | MODIFY | Add `case "compute_app_scores"` + exhaustive never check |
| `apps/scraper/src/jobs/compute-app-scores.ts` | CREATE | Prerequisite check + scoring logic |
| `apps/api/src/routes/system-admin.ts` | MODIFY | Add to `validTypes` + expand runs filter |
| `apps/dashboard/.../scraper/page.tsx` | MODIFY | Add to `SCRAPER_TYPES` array |
| `packages/shared/src/app-visibility.ts` | CREATE | Pure scoring functions (optional, can inline) |
| `packages/shared/src/app-power.ts` | CREATE | Pure scoring functions (optional, can inline) |
