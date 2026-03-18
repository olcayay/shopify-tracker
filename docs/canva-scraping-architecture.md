# Canva Scraping Architecture

## Overview

Canva's app marketplace (`canva.com/apps`) is a Single Page Application that embeds ~1000+ apps as minified JSON in the page source. This fundamentally differs from Shopify's HTML-driven approach and requires a persistent browser with Cloudflare bypass for all operations.

---

## High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRIGGER (Dashboard / Scheduler / CLI)           │
│   system-admin/scraper → POST /api/system-admin/scraper/trigger       │
│   { type: "category"|"app_details"|"keyword_search", platform:"canva"}│
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BullMQ Queue                                  │
│   queue.add("scrape:{type}", { type, platform:"canva", ... })         │
│   Queues: "background" (scheduled) | "interactive" (manual)           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Worker: process-job.ts                             │
│                                                                       │
│  1. Detect platform → "canva"                                         │
│  2. Create BrowserClient (Chromium with anti-detection)                │
│  3. Load CanvaModule via getModule("canva", httpClient, browserClient) │
│  4. Route to scraper by type (category/app_details/keyword_search)    │
│  5. Close browser on completion                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              CategoryScraper  AppDetails  KeywordScraper
              (10 L1 → 35 L2) Scraper     (+ suggestions)
```

---

## Browser & Cloudflare Strategy

```
┌────────────────────────────────────────────────────────┐
│                  CanvaModule                           │
│                                                       │
│  ensureBrowserPage()                                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Chromium (Persistent)                           │ │
│  │  ├─ --disable-blink-features=AutomationControlled│ │
│  │  ├─ ignoreDefaultArgs: ["--enable-automation"]   │ │
│  │  └─ canva-auth-state.json (cf_clearance cookies) │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  Single page instance reused across all operations.   │
│  closeBrowser() called at end of job.                 │
└────────────────────────────────────────────────────────┘
```

The `canva-auth-state.json` file stores Cloudflare cookies (`cf_clearance`). If expired, the scraper will fail and cookies must be refreshed manually.

---

## Data Source: Embedded JSON

Unlike Shopify (HTML parsing), Canva embeds all app data as minified JSON objects in the `/apps` page.

### JSON Schema (Listing Page — minified keys)

```
Key  │ Meaning               │ Example
─────┼───────────────────────┼──────────────────────────
 A   │ App ID                │ "AAF_8lkU9VE"
 B   │ Type                  │ "SDK_APP" | "EXTENSION"
 C   │ Display Name          │ "Jotform"
 D   │ Short Description     │ "Build forms easily"
 E   │ Tagline (H1)          │ "Smart form builder"
 F   │ Developer Name        │ "Jotform Inc."
 G   │ Icon {A:url, B:w, C:h}│ {A:"https://...", B:128, C:128}
 H   │ Full Description      │ "..." (may be empty)
 I   │ Topic Tags            │ ["marketplace_topic.forms", ...]
```

### JSON Schema (Detail Page — different key mapping)

```
Key  │ Meaning               │ Example
─────┼───────────────────────┼──────────────────────────
 A   │ App ID                │ "AAF_8lkU9VE"
 C   │ Display Name          │ "Jotform"
 E   │ Developer Name        │ "Jotform Inc."
 F   │ Short Description     │ "Build forms easily"
 G   │ Tagline               │ "Smart form builder"
 H   │ Full Description      │ "..." (rich text)
 I/J │ Promo Card URL        │ "https://..."
 K   │ Icon URL              │ "https://..."
 O   │ Screenshots           │ ["url1", "url2", ...]
 V   │ Permissions           │ [{A:"scope", B:"MANDATORY"}]
 X   │ Developer Info        │ {A:"name", B:"email", ...}
 Y   │ Languages             │ ["en", "es", ...]
```

### Extraction Logic

```
HTML Source → Regex: {"A":"AA...","B":"SDK_APP"|"EXTENSION"...}
           → Track brace depth to find JSON boundaries
           → Fix hex escapes (\x3c → \u003c)
           → JSON.parse each object
           → Deduplicate by App ID
           → Map to NormalizedAppDetails
```

---

## Scraper Types

### 1. Category Scraper

```
                    10 Seed Categories (L1)
                    ┌──────────────────┐
                    │  AI generation   │
                    │  Audio           │
                    │  Communication   │
                    │  File mgmt       │
                    │  Graphic design  │
                    │  Marketing       │
                    │  Photo editing   │
                    │  Project mgmt    │
                    │  Text styling    │
                    │  Video/animation │
                    └────────┬─────────┘
                             │
               ┌─────────────┼──────────────┐
               ▼             ▼              ▼
         Hub Pages      Hub Pages       Hub Pages
    (return subcats)  (return subcats) (return subcats)
               │             │              │
         ┌─────┴───┐   ┌────┴────┐    ┌────┴────┐
         ▼         ▼   ▼        ▼    ▼         ▼
    Topic Pages  Topic  Topic  Topic  Topic   Topic
    (apps list)  Pages  Pages  Pages  Pages   Pages
```

**Slug Convention:**
- L1 (hub): `project-management`
- L2 (topic): `project-management--forms` (compound with `--`)

**How topic pages work:**
1. Load cached `/apps` page (all ~1000 apps)
2. Filter by exact topic tag: `marketplace_topic.forms`
3. Return filtered apps with position rankings
4. Store in `appCategoryRankings`

### 2. App Details Scraper

```
  Input: slug "AAF_8lkU9VE--jotform"
         │
         ▼
  Build URL: canva.com/apps/AAF_8lkU9VE/jotform
         │                  (-- → /)
         ▼
  Browser: page.goto(url)
         │
         ▼
  Extract JSON from page source
  (detail schema — keys A,C,E,F,G,H,K,O,V,X,Y)
         │
         ▼
  Normalize to common format
         │
         ├─► apps table (name, slug, platform, iconUrl, badges)
         └─► app_snapshots table
              ├─ appIntroduction (tagline)
              ├─ appDetails (fullDescription)
              ├─ developer (JSON)
              ├─ languages (from detail Y field)
              └─ platformData (JSONB)
                  ├─ canvaAppId
                  ├─ canvaAppType (SDK_APP | EXTENSION)
                  ├─ shortDescription
                  ├─ tagline
                  ├─ topics[]
                  ├─ screenshots[]
                  ├─ permissions[]
                  ├─ developerEmail
                  ├─ developerAddress
                  └─ termsUrl, privacyUrl
```

### 3. Keyword Search Scraper

```
  Input: keyword "form builder"
         │
         ▼
  Browser: Navigate to /apps
         │
         ▼
  Type keyword into search input
         │
         ▼
  Press Enter
         │
         ▼
  Intercept API responses via page.on("response")
  ┌──────────────────────────────────────────┐
  │  POST /_ajax/appsearch/search            │
  │                                          │
  │  Response: {                             │
  │    "A": totalResultCount,                │
  │    "C": [                                │
  │      { "A": appId, "B": name,            │
  │        "C": description, "D": icon },    │
  │      ...                                 │
  │    ]                                     │
  │  }                                       │
  └──────────────────────────────────────────┘
         │
         ▼
  Merge all paginated responses
  (deduplicate by App ID)
         │
         ▼
  Paginate locally (100 per page)
         │
         ▼
  Store in keyword_snapshots + app_keyword_rankings
```

**Smart Polling:**
- Max wait: 20 seconds
- Idle timeout: 2 seconds after last response
- All results arrive in first search (no manual pagination needed)

### 4. Keyword Suggestion Scraper

```
  Input: seed keyword "form"
         │
         ▼
  Browser: Type keyword in search box (no Enter)
         │
         ▼
  Intercept: POST /_ajax/appsearch/suggest
         │
         ▼
  Response: { "B": [{ "A": appId, "B": appName }, ...] }
         │
         ▼
  Extract appNames → lowercase → store as suggestions
```

---

## Database Storage

All Canva data shares the same tables as Shopify, differentiated by `platform = 'canva'`:

```
┌─────────────────────┐    ┌──────────────────────┐
│       apps           │    │    app_snapshots      │
├─────────────────────┤    ├──────────────────────┤
│ id                   │◄───│ app_id               │
│ platform = "canva"   │    │ scrape_run_id        │
│ slug                 │    │ scraped_at           │
│ name                 │    │ app_introduction     │
│ icon_url             │    │ app_details          │
│ average_rating: null │    │ features: []         │
│ rating_count: null   │    │ developer: {}        │
│ badges: []           │    │ languages: []        │
│ is_tracked           │    │ integrations: []     │
│ pricing_hint: null   │    │ categories: []       │
└─────────────────────┘    │ platform_data: {     │
                           │   canvaAppId,         │
                           │   canvaAppType,       │
                           │   topics,             │
                           │   screenshots,        │
                           │   permissions,        │
                           │   ...                 │
                           │ }                     │
                           └──────────────────────┘
```

**Fields always null/empty for Canva:** `averageRating`, `ratingCount`, `pricingPlans`, `features` (no taxonomy)

---

## Canva vs Shopify Comparison

```
┌──────────────────┬─────────────────────┬─────────────────────┐
│ Aspect           │ Shopify             │ Canva               │
├──────────────────┼─────────────────────┼─────────────────────┤
│ Data source      │ HTML rendering      │ Embedded JSON       │
│ Search           │ HTTP API            │ Elasticsearch via   │
│                  │                     │ browser interception│
│ Browser          │ Not needed          │ Persistent Chromium │
│                  │                     │ + Cloudflare bypass │
│ Categories       │ 6 L1 → variable L2  │ 10 L1 → ~35 L2     │
│ Reviews          │ Yes                 │ No                  │
│ Ratings          │ Yes                 │ No                  │
│ Pricing          │ Full plans data     │ None                │
│ Features         │ Feature taxonomy    │ No taxonomy         │
│ App types        │ Single type         │ SDK_APP | EXTENSION │
│ Cloudflare       │ No                  │ Yes (cf_clearance)  │
│ Total apps       │ ~15,000+            │ ~1,000+             │
│ Rate limiting    │ Standard HTTP       │ 2-4s delay between  │
│                  │                     │ browser requests    │
│ Similarity       │ cat 30% + feat 30%  │ cat 40% + text 40% │
│ weights          │ + kw 20% + text 20% │ + kw 20% + feat 0% │
└──────────────────┴─────────────────────┴─────────────────────┘
```

---

## Scoring & Similarity

```typescript
CANVA_SCORING = {
  pageSize: 30,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.40,   // Strong signal (topic tags)
    feature:  0.00,   // No feature taxonomy
    keyword:  0.20,   // Search overlap
    text:     0.40    // Name + description similarity
  }
}
```

---

## Rate Limiting & Resilience

| Mechanism | Value | Purpose |
|-----------|-------|---------|
| Request delay | 2-4s random | Avoid Cloudflare detection |
| Search timeout | 20s max | Give Elasticsearch time |
| Idle polling | 2s after last response | Detect search completion |
| App page cache | Per-job lifetime | Single fetch for ~1000 apps |
| Retry on empty | 5s + 5s waits | Handle incomplete hydration |
| Auth state file | `canva-auth-state.json` | Persist cf_clearance cookies |

---

## Key Files

```
apps/scraper/src/
├── process-job.ts                         # Job router (creates BrowserClient for Canva)
├── browser-client.ts                      # Generic browser wrapper
├── platforms/
│   ├── platform-module.ts                 # Interface definition
│   └── canva/
│       ├── index.ts                       # CanvaModule (browser mgmt, search, caching)
│       ├── constants.ts                   # Categories, scoring, rate limits
│       └── parsers/
│           ├── app-parser.ts              # Listing + detail page JSON extraction
│           ├── search-parser.ts           # Search API response parsing
│           ├── category-parser.ts         # Category → topic filtering
│           ├── featured-parser.ts         # Featured section extraction
│           └── suggest-parser.ts          # Autocomplete API parsing
├── scrapers/
│   ├── category-scraper.ts                # Crawls category tree
│   ├── app-details-scraper.ts             # Single app detail pages
│   ├── keyword-scraper.ts                 # Keyword search + rankings
│   └── keyword-suggestion-scraper.ts      # Autocomplete suggestions
```
