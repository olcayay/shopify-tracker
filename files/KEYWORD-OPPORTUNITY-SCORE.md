# Keyword Opportunity Score

## Overview

The Keyword Opportunity Score is a composite metric (0–100) that evaluates how viable a Shopify App Store keyword is for a new or lesser-known app to rank well. A higher score means the keyword represents a better opportunity.

The score is computed entirely from a single keyword search snapshot — the list of apps returned by Shopify's search API for that keyword, plus the total result count.

**Source code:** `packages/shared/src/keyword-opportunity.ts`
**API endpoint:** `POST /api/keywords/opportunity` (bulk, accepts `{ slugs: string[] }`)

---

## Data Pipeline

```
Keyword Search Scraper
    → saves results[] + totalResults into keywordSnapshots table (JSONB)
    → API reads latest snapshot per keyword slug
    → computeKeywordOpportunity(results, totalResults)
    → returns { opportunityScore, scores, stats, topApps }
```

No separate database table — everything is computed on-demand from the existing `keywordSnapshots.results` JSONB column.

---

## Input Data

Each keyword search result (`KeywordSearchApp`) contains:

| Field                | Type    | Description                                   |
|----------------------|---------|-----------------------------------------------|
| `position`           | number  | Rank position in search results               |
| `app_slug`           | string  | Unique app identifier                         |
| `app_name`           | string  | App display name                              |
| `average_rating`     | number  | App's average star rating (0–5)               |
| `rating_count`       | number  | Total number of reviews                       |
| `is_sponsored`       | boolean | Whether the listing is a paid ad              |
| `is_built_in`        | boolean | Whether it's a Shopify built-in app           |
| `is_built_for_shopify` | boolean | Whether it has BFS certification            |
| `logo_url`           | string  | App icon URL                                  |
| `pricing_hint`       | string  | Pricing summary text                          |

Additionally, `totalResults` (number | null) is the total count Shopify reports for the search.

---

## Pre-Processing

Before scoring, the results are partitioned:

```
organic = results where NOT is_sponsored AND NOT is_built_in
```

Sponsored and built-in apps are excluded from all analysis. Then:

```
firstPage = organic[0..23]     (first 24 organic apps)
top4      = organic[0..3]      (first 4 organic apps)
top1      = organic[0]         (the #1 organic app)
```

The page size constant is **24**, matching Shopify's actual first page result count.

---

## Raw Statistics

These intermediate values are computed from the filtered organic results and exposed in the `stats` object:

| Stat                    | Formula                                                    | Description                                          |
|-------------------------|------------------------------------------------------------|------------------------------------------------------|
| `totalResults`          | From Shopify API (or 0 if null)                            | Total apps Shopify says match this keyword            |
| `bfsCount`              | Count of `firstPage` where `is_built_for_shopify = true`   | How many BFS-certified apps are on page 1             |
| `count1000`             | Count of `firstPage` where `rating_count >= 1000`          | Apps on page 1 with 1000+ reviews                     |
| `count100`              | Count of `firstPage` where `rating_count >= 100`           | Apps on page 1 with 100+ reviews                      |
| `top1Reviews`           | `top1.rating_count` (or 0)                                 | Review count of the #1 app                            |
| `top4TotalReviews`      | Sum of `rating_count` for top 4                            | Combined reviews of top 4 apps                        |
| `top4AvgRating`         | Average of `average_rating` for top 4 (where > 0), or null | Mean rating of top 4 apps                             |
| `firstPageTotalReviews` | Sum of `rating_count` for all 24 first page apps           | Combined reviews across entire first page             |
| `firstPageAvgRating`    | Average of `average_rating` for first page (where > 0), or null | Mean rating across entire first page            |
| `top1ReviewShare`       | `top1Reviews / firstPageTotalReviews` (or 0)               | What fraction of page 1 reviews the #1 app holds      |
| `top4ReviewShare`       | `top4TotalReviews / firstPageTotalReviews` (or 0)          | What fraction of page 1 reviews the top 4 hold        |

---

## Score Components

The opportunity score is composed of 4 sub-scores, each normalized to the 0–1 range using a `clamp01` function: `max(0, min(1, value))`.

### 1. Room (Weight: 40%)

**Question:** Is there space for a new app to compete, or is the market dominated by high-review incumbents?

**Formula:**
```
room = clamp01(1 - top4TotalReviews / 20,000)
```

**Inputs:**
- `top4TotalReviews` — sum of review counts for the top 4 organic apps

**Normalization cap:** 20,000 reviews

**Interpretation:**
- If top 4 apps collectively have 0 reviews → room = 1.0 (100%, wide open)
- If top 4 apps collectively have 10,000 reviews → room = 0.5 (50%)
- If top 4 apps collectively have 20,000+ reviews → room = 0.0 (0%, very crowded)

**Rationale:** Review count is the strongest signal of market entrenchment. Users trust apps with more reviews, making it harder for newcomers. The top 4 apps are the most visible positions and represent the core competition a new app must overcome.

---

### 2. Demand (Weight: 25%)

**Question:** Is anyone actually searching for this keyword?

**Formula:**
```
demand = clamp01(totalResults / 1,000)
```

**Inputs:**
- `totalResults` — the total number of apps Shopify reports for this keyword search

**Normalization cap:** 1,000 results

**Interpretation:**
- 0 total results → demand = 0.0 (no market)
- 500 total results → demand = 0.5
- 1,000+ total results → demand = 1.0 (strong market)

**Rationale:** More total results indicate that developers have built apps targeting this keyword, which is a proxy for user demand. A keyword with very few results may not be worth targeting even if competition is low.

---

### 3. Maturity (Weight: 10%)

**Question:** How established are the players in this market?

**Formula:**
```
maturity = 1 - clamp01(count1000 / 12)
```

**Inputs:**
- `count1000` — number of first-page apps with 1,000+ reviews

**Normalization cap:** 12 apps

**Interpretation:**
- 0 apps with 1000+ reviews → maturity = 1.0 (immature market, great opportunity)
- 6 apps with 1000+ reviews → maturity = 0.5
- 12+ apps with 1000+ reviews → maturity = 0.0 (very mature, hard to break in)

**Rationale:** The count of high-review apps is a proxy for how long the market has existed and how hard it would be to catch up. This is distinct from Room — Room looks at total review volume of the top 4, Maturity looks at how many individual apps across the full first page have crossed the "established" threshold.

---

### 4. Quality (Weight: 25%)

**Question:** Is there a quality gap that a new app could exploit?

**Formula:**
```
bfsFactor   = clamp01(1 - bfsCount / 24)
ratingFactor = top4AvgRating is null
                 ? 0.5
                 : clamp01(1 - (top4AvgRating - 3.5) / (5.0 - 3.5))

quality = clamp01(bfsFactor * ratingFactor)
```

**Inputs:**
- `bfsCount` — number of "Built for Shopify" certified apps on page 1
- `top4AvgRating` — average rating of the top 4 organic apps

**Constants:**
- Page size: 24
- Rating floor: 3.5
- Rating ceiling: 5.0

**Sub-component breakdown:**

#### bfsFactor
- 0 BFS apps → bfsFactor = 1.0 (no high-quality certified competition)
- 12 BFS apps → bfsFactor = 0.5
- 24 BFS apps → bfsFactor = 0.0 (entire first page is BFS)

#### ratingFactor
- No ratings available → ratingFactor = 0.5 (neutral)
- Top 4 avg rating = 3.5 → ratingFactor = 1.0 (low quality, opportunity to do better)
- Top 4 avg rating = 4.25 → ratingFactor = 0.5
- Top 4 avg rating = 5.0 → ratingFactor = 0.0 (already excellent quality)

**Rationale:** BFS certification is Shopify's quality stamp — more BFS apps means higher quality standards to compete with. Low average ratings in the top 4 suggest that users aren't fully satisfied, creating an opening for a better app. These two factors multiply: you need BOTH a quality gap AND an absence of certified apps for the opportunity to be high.

---

## Final Score Calculation

```
raw = (0.40 × room) + (0.25 × demand) + (0.10 × maturity) + (0.25 × quality)

opportunityScore = clamp(0, 100, round(100 × raw))
```

The raw value is always between 0.0 and 1.0 (since each component is clamped to 0–1), so the final score is always 0–100.

---

## Score Interpretation

| Range  | Color  | Meaning                                                       |
|--------|--------|---------------------------------------------------------------|
| 60–100 | Green  | Strong opportunity — low competition, good demand, quality gap |
| 30–59  | Amber  | Moderate opportunity — some competition or mixed signals       |
| 0–29   | Red    | Weak opportunity — crowded market, high quality, or low demand |

---

## Example Scenarios

### High Opportunity (Score ~85)
- Top 4 apps have ~500 total reviews → room = 0.975
- 800 total results → demand = 0.8
- 0 apps with 1000+ reviews → maturity = 1.0
- 0 BFS apps, top 4 avg rating 3.8 → quality ≈ 0.8

```
raw = 0.40(0.975) + 0.25(0.8) + 0.10(1.0) + 0.25(0.8)
    = 0.39 + 0.20 + 0.10 + 0.20 = 0.89
score = 89
```

### Low Opportunity (Score ~10)
- Top 4 apps have 25,000 total reviews → room = 0.0
- 50 total results → demand = 0.05
- 10 apps with 1000+ reviews → maturity ≈ 0.17
- 20 BFS apps, top 4 avg rating 4.8 → quality ≈ 0.01

```
raw = 0.40(0.0) + 0.25(0.05) + 0.10(0.17) + 0.25(0.01)
    = 0.0 + 0.0125 + 0.017 + 0.0025 = 0.032
score = 3
```

---

## UI Display

### Keywords Table
- **Score column**: Color-coded badge (green/amber/red). Always clickable to open detail popover.
- **Expandable detail columns** (toggle via Columns3 icon in Score header):
  - **Scores group** (4 cols): Room, Demand, Maturity, Quality — shown as percentage, color-coded
  - **First Page group** (5 cols): Results, Rating, BFS, 1000+, 100+ — raw stat values
  - **Concentration group** (2 cols): Top 1, Top 4 — review share percentages
  - **Top Apps group** (4 cols): #1, #2, #3, #4 — icon, name (10 chars), rating, review count
- All columns are sortable (ascending/descending toggle)
- Hover tooltips explain each metric's meaning and formula

### Score Detail Popover
- 4 score bars with percentage and weight labels
- First Page Analysis stats section
- Review Concentration bars (Top 1 and Top 4 share)
- Top 4 Apps list with icons, ratings, review counts, and BFS badges

---

## Weight Rationale

| Component | Weight | Why                                                                       |
|-----------|--------|---------------------------------------------------------------------------|
| Room      | 40%    | The strongest predictor — review moats are the hardest barrier to overcome |
| Demand    | 25%    | No point competing in a keyword nobody searches for                        |
| Quality   | 25%    | Quality gaps are actionable — you can build a better app                   |
| Maturity  | 10%    | Supplements Room with count-based signal, but less impactful alone          |

---

## Constants Reference

| Constant           | Value  | Used In  | Purpose                                    |
|--------------------|--------|----------|--------------------------------------------|
| `ROOM_CAP`         | 20,000 | Room     | Max reviews before room = 0                |
| `DEMAND_CAP`       | 1,000  | Demand   | Max results before demand = 1              |
| `MATURITY_APP_CAP` | 12     | Maturity | Max 1000+ review apps before maturity = 0  |
| `PAGE_SIZE`        | 24     | Quality  | Shopify's first page result count           |
| `RATING_FLOOR`     | 3.5    | Quality  | Rating where ratingFactor = 1 (low quality) |
| `RATING_CEIL`      | 5.0    | Quality  | Rating where ratingFactor = 0 (high quality)|
