# Canva Detail Page Scraping - Investigation Report

**Date:** 2026-03-15
**Status:** RESOLVED

## Solution (Final — Attempt 7: appListing API Intercept)

**Root cause:** 6 of 14 tracked apps are NOT server-side rendered by Canva. When navigating to their detail page URLs, the server returns the generic `/apps` bulk page (~1.88MB, title "Apps Marketplace | Canva") instead of an SSR detail page. The Canva SPA then handles routing client-side and fetches app data via an internal API: `/_ajax/appsearch/appListing/{appId}`.

**Fix:** In `fetchAppPage()`, set up a Playwright response interceptor before navigation. When the bulk page is detected (by title), wait up to 15 seconds for the SPA's `appListing` API call. Inject the intercepted API response into the HTML as a comment marker (`<!-- CANVA_APP_LISTING_API:...-->`). The parser extracts this data with the correct field mapping.

**API field mapping (different from SSR detail page):**
| API key | SSR key | Field |
|---------|---------|-------|
| D | E | name |
| E | F | short description |
| F | H | full description |
| G | G | tagline |
| H.A | K | icon URL |
| K | L | terms URL |
| L | M | privacy URL |
| M | N | developer website |
| S | V | permissions (abbreviated in API) |
| Y | X | developer info |
| e | Y | languages |
| T | C | developer name |

**Commits:** `7e792da`, `cd8e848`
**Result:** All 14/14 apps now return complete data (fullDescription, languages, permissions, developer info).

---

## Problem Statement

When scraping Canva app detail pages, 6 out of 14 tracked apps consistently return empty data for:
- `fullDescription` (Description)
- `languages`
- `permissions`

These fields are **only available on individual app detail pages** (`/apps/{id}/{slug}`), not on the bulk `/apps` page. The bulk page provides `shortDescription` and `tagline` but has `fullDescription` as empty string.

---

## App Classification

### Apps That ALWAYS Work (8/14)
| App | ID | In-page fetch size | Detail JSON |
|-----|----|-------------------|-------------|
| Jotform | AAGX23MX5S8 | ~111 KB | YES |
| Jotform AI Chatbot | AAG2DuhVPdI | ~111 KB | YES |
| Klaviyo | AAGJE-oMX8s | ~110 KB | YES |
| FluidForms | AAGFFkmnRaw | ~109 KB | YES |
| CanSign | AAF3ICQUDC8 | ~110 KB | YES |
| Invotally | AAGKOFZYCe8 | ~110 KB | YES |
| Celero | AAGSUgB9YNo | ~112 KB | YES |
| ChatGPT | tc_chatgpt | ~108 KB | YES |

### Apps That ALWAYS Fail (6/14)
| App | ID | In-page fetch size | Detail JSON |
|-----|----|-------------------|-------------|
| Formester | AAGcdGANsjs | ~116 KB (fetch) / ~1.88 MB (goto) | NO |
| Easy RSVP | AAGN0i9muPI | ~1.78 MB | NO |
| Form AI | AAG1eD5_fE8 | ~1.78 MB | NO |
| OurSVP | AAG9NCkVMgc | ~1.78 MB | NO |
| RSVP Form | AAG34K01ARI | ~1.78 MB | NO |
| Typeform | AAGgTUWUnSk | ~1.78 MB | NO |

**Key observation:** The division is 100% consistent. Same apps always fail, same apps always succeed. This is NOT a timing or cookie expiration issue.

---

## Attempts & Results

### Attempt 1: Direct `page.goto()` (Original)
**Commit:** (original code)
**Approach:** Navigate directly to `https://www.canva.com/apps/{id}/{slug}` using Playwright `page.goto()`
**Result:** 8 apps work (~145 KB HTML with detail JSON), 6 apps get Cloudflare challenge (~1.88 MB "Just a moment..." page)
**Conclusion:** Cloudflare blocks some detail pages but not others

### Attempt 2: Retry with Longer Wait
**Commit:** `6b012a39`
**Approach:** If detail JSON not found after first attempt, navigate to /apps, wait 3s, then retry with 6s wait instead of 3s
**Result:** Retry produces identical result — same 6 apps fail on both attempts
**Conclusion:** Longer wait doesn't help; Cloudflare challenge is not a timing issue

### Attempt 3: SPA Click Navigation
**Commit:** `7b02adb3`
**Approach:** Instead of `page.goto()`, find the app's `<a>` link on the `/apps` page and click it to trigger React Router SPA navigation (no full page load = no Cloudflare)
**Result:** Link selector `a[href*="/apps/{id}/"]` found zero matches for ALL apps. Every app fell back to direct navigation.
**Root cause:** Canva uses a **virtualized/lazy list** — only visible apps have `<a>` tags in the DOM. The 1096 apps are not all rendered.
**Conclusion:** SPA click approach is not viable

### Attempt 4: In-page `fetch()` via `page.evaluate()`
**Commit:** `7b02adb3` (updated)
**Approach:** Stay on the `/apps` page and use `page.evaluate(async () => fetch(url).then(r => r.text()))` to fetch detail page HTML. The browser's JS context should inherit Cloudflare cookies.
**Result (from scraper run):**
- 8 working apps: `fetch()` returns ~110 KB HTML with valid detail JSON ✅
- Formester: `fetch()` returns ~116 KB HTML, no detail JSON ❌ (different size from Cloudflare challenge)
- Other 5 failing apps: `fetch()` returns ~1.78 MB HTML ❌ (Cloudflare challenge)

**Result (from manual test after cookies expired):**
- ALL apps return ~377 KB Cloudflare challenge ❌

**Key insight:** `fetch()` DOES work for the 8 apps that `page.goto()` also works for. It does NOT bypass Cloudflare for the 6 failing apps. The issue is **not about navigation method**.

**Conclusion:** In-page fetch is faster (no page navigation overhead) but doesn't solve the core problem

---

## Deep Analysis

### Response Size Patterns
| Scenario | Size | Meaning |
|----------|------|---------|
| ~108-116 KB | Actual app detail page HTML | SUCCESS |
| ~377 KB | Cloudflare JS challenge (interactive) | FAIL (fetch) |
| ~1.78-1.88 MB | Cloudflare Turnstile/full challenge page | FAIL (page.goto or fetch) |

### Formester Anomaly
Formester is interesting — via in-page `fetch()`, it returns ~116 KB (close to working apps' ~110 KB) but without the detail JSON. The direct `page.goto()` returns only ~139 KB (not the typical ~1.88 MB challenge). This suggests Canva might be returning the page **without the embedded app data** rather than a Cloudflare challenge.

### Cloudflare Cookie Analysis
```
Cookies after loading /apps:
- __cf_bm (bot management)
- _cfuvid (unique visitor ID)
- cf_clearance (Cloudflare clearance token)
```
Even with `cf_clearance` present, detail page requests for failing apps still get challenged. The `cf_clearance` from `/apps` does NOT transfer to `/apps/{id}/{slug}` for these specific apps. Cloudflare may be applying **per-path or per-resource protection rules**.

### What Distinguishes Failing Apps?
Possible hypotheses:
1. **App popularity/traffic:** Failing apps may have lower traffic, making Cloudflare more suspicious of requests
2. **Canva-side bot protection:** Canva may have additional protection on certain apps beyond Cloudflare
3. **App type/category:** The failing apps include 3 RSVP-related apps, Typeform, Form AI, Formester — could be category-related?
4. **Server-side rendering:** Some apps may not have their detail JSON server-side rendered, only loading it via client-side JS after hydration
5. **Geographic CDN caching:** The server (Hetzner Germany) may get different Cloudflare treatment than US/other regions

### Hypothesis 4 Investigation Needed
The most likely hypothesis is #4 — some apps may load their detail data via **client-side API calls** rather than embedding it in the HTML. The 116 KB Formester response (vs 110 KB working apps) supports this — the page loads but the data is fetched separately via XHR/API after JavaScript execution.

If this is the case:
- `page.goto()` + longer wait should eventually get the data (but we waited 5-6s and it didn't)
- The data might be loaded via a different API endpoint that we're not intercepting

---

## Architecture Context

### Data Flow
```
ensureBrowserPage()           # Launch Chrome, load /apps, wait for search input
  ↓
fetchAppPage(slug)            # Fetch detail page HTML
  ↓
parseCanvaAppPage(html, slug) # Try extractCanvaDetailApp() first
  ↓                             # If fails: fall back to extractCanvaApps() (bulk)
app-details-scraper.ts        # Save to DB as app_snapshot with platformData
```

### Bulk Page Data (Available for ALL apps)
- `A`: App ID
- `B`: App type (SDK_APP / EXTENSION)
- `C`: Name
- `D`: Short description
- `E`: Tagline
- `F`: Developer
- `G`: Icon URL
- `H`: Full description (**EMPTY for most apps**)
- `I`: Topics

### Detail Page Data (Available only when detail JSON is present)
- All of the above PLUS:
- `K`: Icon URL (higher res)
- `L`: Terms URL
- `M`: Privacy URL
- `N`: Developer website
- `O`: Screenshots
- `V`: Permissions array
- `X`: Developer info (email, phone, address)
- `Y`: Languages array

---

## Server Environment
- **Server:** Hetzner Cloud, 75GB disk
- **Location:** Germany (EU)
- **Docker containers:** Postgres 16, Redis 7.2, API (Fastify), Dashboard (Next.js), 2 Workers (BullMQ)
- **Browser:** Playwright Chromium (headless), falls back to installed Chrome
- **Disk issue:** Server ran out of disk space on 2026-03-14, causing Postgres crash loops, Redis write errors, and stuck API deployments. Cleaned up ~60GB of Docker images/cache.

---

## Potential Next Steps (Not Yet Tried)

### 1. Wait for Client-side Data Load
Instead of getting HTML immediately after `page.goto()`, wait for a specific element or network request that indicates the app detail data has loaded via client-side JS:
```typescript
await page.goto(url, { waitUntil: 'networkidle' }); // Wait for ALL network activity to stop
// Or wait for a specific selector that only appears on fully loaded detail pages
await page.waitForSelector('[data-testid="app-description"]', { timeout: 15000 });
```

### 2. Intercept XHR/API Responses
Some apps might load their data via API calls (like the search API uses `/_ajax/appsearch/search`). We could:
```typescript
page.on('response', async (response) => {
  if (response.url().includes('/apps/') && response.headers()['content-type']?.includes('json')) {
    const data = await response.json();
    // Extract detail data from API response
  }
});
await page.goto(url);
```

### 3. Use Canva's Internal API Directly
Canva's search uses `/_ajax/appsearch/search` (Elasticsearch). There might be an app detail API like `/_ajax/apps/{id}` that we could call from the browser context. Investigate network requests when manually loading a detail page in a real browser.

### 4. Headful Browser
Run Chrome in non-headless mode on the server. Cloudflare may fingerprint headless browsers differently. This requires a virtual display (Xvfb) on the server.

### 5. Residential Proxy / Different Server Location
Cloudflare's bot detection is influenced by IP reputation. A residential proxy or a server in a different location (US) might get different treatment.

### 6. Browser Stealth Plugins
Use `playwright-extra` with `stealth` plugin for better anti-detection:
```bash
npm install playwright-extra puppeteer-extra-plugin-stealth
```

### 7. Pre-warm with Manual Cloudflare Solve
Manually solve Cloudflare once in a real browser, export cookies, and use them. Current `canva-auth-state.json` approach does this but cookies expire quickly.

### 8. Check if Apps are Actually Published/Public
Some failing apps might have restricted access, causing Canva itself (not Cloudflare) to return different HTML. Verify by manually visiting the URLs in a regular browser.

---

## Files Modified During Investigation

| File | Changes |
|------|---------|
| `apps/scraper/src/platforms/canva/index.ts` | `fetchAppPage()` — 4 iterations of approach changes |
| `apps/scraper/src/platforms/canva/parsers/app-parser.ts` | `normalizeCanvaApp()` key fix, `extractCanvaDetailApp()` regex broadening |
| `apps/scraper/src/scrapers/app-details-scraper.ts` | Added `force` parameter to skip 12h cache |
| `apps/scraper/src/process-job.ts` | Manual trigger detection for force scraping |

---

## Raw Log Evidence

### Successful App (Jotform, in-page fetch)
```
{"msg":"fetching app detail page","slug":"AAGX23MX5S8--jotform","detailUrl":"https://www.canva.com/apps/AAGX23MX5S8/jotform"}
{"msg":"app detail via in-page fetch","slug":"AAGX23MX5S8--jotform","htmlLength":111331,"hasDetailJson":true}
{"msg":"parsed app from detail page","appId":"AAGX23MX5S8","name":"Jotform"}
```

### Failing App (OurSVP, in-page fetch + fallback)
```
{"msg":"fetching app detail page","slug":"AAG9NCkVMgc--oursvp","detailUrl":"https://www.canva.com/apps/AAG9NCkVMgc/oursvp"}
{"msg":"app detail via in-page fetch","slug":"AAG9NCkVMgc--oursvp","htmlLength":1783287,"hasDetailJson":false}
{"msg":"falling back to direct navigation","slug":"AAG9NCkVMgc--oursvp"}
{"msg":"app detail via direct nav","slug":"AAG9NCkVMgc--oursvp","htmlLength":1882780,"hasDetailJson":false}
{"msg":"detail JSON not found in page","appId":"AAG9NCkVMgc"}
```

### Anomalous App (Formester, in-page fetch — small response but no JSON)
```
{"msg":"fetching app detail page","slug":"AAGcdGANsjs--formester","detailUrl":"https://www.canva.com/apps/AAGcdGANsjs/formester"}
{"msg":"app detail via in-page fetch","slug":"AAGcdGANsjs--formester","htmlLength":116316,"hasDetailJson":false}
{"msg":"falling back to direct navigation","slug":"AAGcdGANsjs--formester"}
{"msg":"app detail via direct nav","slug":"AAGcdGANsjs--formester","htmlLength":139002,"hasDetailJson":false}
{"msg":"detail JSON not found in page","appId":"AAGcdGANsjs"}
```
