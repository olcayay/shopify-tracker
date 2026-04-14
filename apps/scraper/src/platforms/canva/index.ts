import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedFeaturedSection,
  NormalizedSearchPage,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import type { FallbackTracker } from "../../utils/fallback-tracker.js";
import type { Browser, BrowserContext, Page, Response } from "playwright";
import { canvaUrls } from "./urls.js";
import { CANVA_CONSTANTS, CANVA_SCORING } from "./constants.js";
import { parseCanvaAppPage, extractCanvaApps, normalizeCanvaApp } from "./parsers/app-parser.js";
import { parseCanvaCategoryPage } from "./parsers/category-parser.js";
import { parseCanvaFeaturedSections } from "./parsers/featured-parser.js";
import { parseCanvaSearchPage } from "./parsers/search-parser.js";
import { parseCanvaSuggestions } from "./parsers/suggest-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("canva-module");

/**
 * Canva Apps Marketplace platform module.
 *
 * Key architectural notes:
 * - Canva embeds ALL app data (~1000+ apps) as JSON in the main /apps page
 * - Search uses Canva's real search API (POST /_ajax/appsearch/search)
 *   backed by Elasticsearch — returns exact rankings as shown to users
 * - Auto-suggestions use POST /_ajax/appsearch/suggest
 * - Both APIs are behind Cloudflare; we trigger them via the page's
 *   own JavaScript (type into search box) and intercept responses
 * - Categories are filter tabs on the main page, mapped to marketplace_topic.* tags
 */
export class CanvaModule implements PlatformModule {
  readonly platformId = "canva" as const;
  readonly constants: PlatformConstants = CANVA_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = CANVA_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: false,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: false,
    hasFlatCategories: false,
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;
  tracker?: FallbackTracker;

  /** Cached HTML of the /apps page to avoid re-fetching */
  private cachedAppsPageHtml: string | null = null;

  /** Persistent browser for search API calls */
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private browserPage: Page | null = null;

  /** Page pool for concurrent app scrapes (prevents navigation race conditions) */
  private pagePool: Page[] = [];
  private pagesInUse = new Set<Page>();
  /**
   * PLA-1083: reduced from 5 → 3. Real Chrome renderer processes run
   * ~200-400 MB RSS each; at 5 pages + main page + Chromium overhead we
   * came within OOM risk on the 3 GiB worker container, and in practice
   * ~80% of failures in run `1447` (2026-04-14) were `Page crashed` errors
   * even when container memory wasn't saturated — likely renderer churn
   * from Canva's heavy client-side JS under contention. 3 keeps throughput
   * close to 5 while halving renderer count at peak.
   */
  private static readonly MAX_POOL_SIZE = 3;
  /**
   * Pages that emitted the Playwright `crash` event. Removed from the pool
   * on next acquire and replaced with a fresh page. See PLA-1083.
   */
  private crashedPages = new WeakSet<Page>();

  /** Cache search results per keyword (all pages fetched at once) */
  private searchCache = new Map<string, string>();

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker) {
    this.httpClient = httpClient || new HttpClient();
    this.browserClient = browserClient;
    this.tracker = tracker;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return canvaUrls.app(slug);
  }

  buildCategoryUrl(slug: string, _page?: number): string {
    return canvaUrls.category(slug);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    // PLA-1085: HTTP fallback removed — canva.com/apps returns HTTP 403 to any
    // non-browser TLS fingerprint (verified from multiple origins), so the
    // fallback always threw the same error as the primary. Dead code.
    // If per-app resilience is needed later, replace with an LRU cache keyed
    // on appId that serves last-known-good HTML.
    return this.fetchAppPageViaBrowser(slug);
  }

  private async fetchAppPageViaBrowser(slug: string): Promise<string> {
    const page = await this.acquirePoolPage();
    try {
      return await this.fetchAppPageWithPage(page, slug);
    } finally {
      this.releasePoolPage(page);
    }
  }

  private async fetchAppPageWithPage(page: Page, slug: string): Promise<string> {
    const appId = slug.split("--")[0];
    const urlSlug = slug.split("--")[1] || "";
    const detailUrl = `https://www.canva.com/apps/${appId}/${urlSlug}`;
    log.info("fetching app detail page", { slug, detailUrl });

    // Intercept the appListing API response (used by SPA for non-SSR detail pages)
    let appListingJson: string | null = null;
    const responseHandler = async (response: Response) => {
      if (response.url().includes(`/_ajax/appsearch/appListing/${appId}`) && response.status() === 200) {
        try {
          appListingJson = await response.text();
          log.info("intercepted appListing API", { slug, size: appListingJson.length });
        } catch (err) { log.warn("failed to read appListing response", { slug, error: String(err) }); }
      }
    };
    page.on("response", responseHandler);

    try {
      await page.goto(detailUrl, { waitUntil: "load", timeout: 30_000 });

      // Handle Cloudflare challenge if present
      let title = await page.title();
      let cfResolved = true;
      if (title === "Just a moment...") {
        log.info("Cloudflare challenge on detail page, waiting for auto-resolve", { slug });
        try {
          await page.waitForFunction(
            () => document.title !== "Just a moment...",
            { timeout: 45_000 },
          );
          await page.waitForTimeout(3000);
          title = await page.title();
          log.info("Cloudflare challenge resolved", { slug, newTitle: title });
        } catch {
          cfResolved = false;
          log.warn("Cloudflare challenge did not resolve in time", { slug });
        }
      }

      if (!cfResolved) {
        // CF challenge still up — the page body is the challenge, not Canva content.
        // Throw so withFallback fires (even if HTTP fallback also fails,
        // the error is counted honestly instead of silently returning empty HTML).
        throw new Error(`canva: Cloudflare challenge unresolved for ${slug}`);
      }

      const isBulkPage = title === "Apps Marketplace | Canva";

      if (isBulkPage) {
        // Server returned the bulk /apps page. SPA will fetch detail via API.
        // Wait for the appListing API call to complete.
        log.info("bulk page detected, waiting for appListing API", { slug });
        const start = Date.now();
        while (!appListingJson && Date.now() - start < 15_000) {
          await page.waitForTimeout(500);
        }
      } else {
        // SSR detail page loaded directly
        await page.waitForTimeout(2000);
      }

      // If we got the appListing API response, inject it as a marker for the parser
      let html = await page.content();
      if (appListingJson && isBulkPage) {
        log.info("injecting appListing data into HTML", { slug });
        html = `<!-- CANVA_APP_LISTING_API:${appListingJson}:END_CANVA_APP_LISTING_API -->\n${html}`;
      }

      const hasDetailJson = html.includes(`"A":"${appId}"`) && !html.includes(`"A":"${appId}","B":"SDK_APP"`);
      log.info("app detail page fetched", { slug, htmlLength: html.length, hasDetailJson, hasAppListingApi: !!appListingJson });

      if (!hasDetailJson && !appListingJson) {
        // Page loaded (CF passed) but neither SSR detail JSON nor the appListing
        // API response is present. Likely means the app id is stale/removed, or
        // Canva served a degraded HTML. Throw so withFallback fires and the
        // failure is counted — don't return empty HTML to let the parser
        // silently emit a stub record.
        throw new Error(`canva: detail page missing both SSR JSON and appListing API for ${slug}`);
      }

      return html;
    } finally {
      page.off("response", responseHandler);
    }
  }

  async fetchCategoryPage(_slug: string, _page?: number): Promise<string> {
    // PLA-1085: HTTP fallback removed. fetchAppsPage already returns the
    // cached /apps HTML from the persistent browser page, so the browser
    // path is itself a cached fallback on subsequent calls. Raw-HTTP
    // fallback hits Cloudflare 403 on every request — dead code.
    return this.fetchAppsPage();
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseCanvaAppPage(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const categorySlug = this.extractCategorySlugFromUrl(url);
    return parseCanvaCategoryPage(html, categorySlug, 1, 0);
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const html = await this.fetchAppsPage();
    return this.parseFeaturedSections(html);
  }

  parseFeaturedSections(html: string): NormalizedFeaturedSection[] {
    return parseCanvaFeaturedSections(html);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/apps\/(AA[A-Za-z][A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?/);
    if (match) return match[2] ? `${match[1]}--${match[2]}` : match[1];
    return url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Search (via Canva's Elasticsearch-backed API) ---

  buildSearchUrl(keyword: string, _page?: number): string {
    return `${canvaUrls.base}/your-apps?q=${encodeURIComponent(keyword)}`;
  }

  /**
   * Fetch ALL search results for a keyword from Canva's search API.
   *
   * Strategy: Navigate to /apps, type the keyword in the search box,
   * which triggers Canva's own JS to call POST /_ajax/appsearch/search.
   * We intercept all search API responses and merge them into one
   * combined JSON array. This avoids Cloudflare blocking.
   *
   * Results are cached per keyword since all pages are fetched at once.
   * The return value is a JSON string with combined results.
   */
  async fetchSearchPage(keyword: string, page?: number): Promise<string> {
    const pageNum = page || 1;

    // On page > 1, return slice of cached results
    if (pageNum > 1 && this.searchCache.has(keyword)) {
      return this.searchCache.get(keyword)!;
    }

    // Only fetch on page 1 — we get all results at once
    if (pageNum > 1) {
      log.warn("no cached search results for page > 1", { keyword, page: pageNum });
      return JSON.stringify({ A: 0, C: [] });
    }

    // PLA-1085: HTTP bulk-search fallback removed. canva.com/apps returns
    // Cloudflare 403 to non-browser TLS, so the fallback path always threw.
    // Search freshness is time-sensitive — stale cached results are worse
    // than an explicit failure, so no cache-based fallback either.
    const allResults = await this.fetchAllSearchResults(keyword);
    const combinedJson = JSON.stringify(allResults);
    this.searchCache.set(keyword, combinedJson);
    return combinedJson;
  }

  /**
   * Parse search API JSON response (combined results).
   */
  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    offset: number,
  ): NormalizedSearchPage {
    return parseCanvaSearchPage(json, keyword, page, offset);
  }

  // --- Auto-suggest (via Canva's suggest API) ---

  buildAutoSuggestUrl(keyword: string): string {
    return `${canvaUrls.base}/your-apps?q=${encodeURIComponent(keyword)}`;
  }

  /**
   * Generate auto-suggestions using Canva's real suggest API.
   * Called by KeywordSuggestionScraper for Canva platform.
   */
  async generateSuggestions(keyword: string): Promise<string[]> {
    log.info("fetching suggestions via search trigger", { keyword });

    try {
      const page = await this.ensureBrowserPage();

      // Set up response interceptor for suggest API
      let handler: ((response: Response) => Promise<void>) | null = null;
      const suggestPromise = new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve("{}"), 10000);
        handler = async (response: Response) => {
          if (response.url().includes("/_ajax/appsearch/suggest")) {
            try {
              const body = await response.text();
              clearTimeout(timeout);
              resolve(body);
            } catch (err) { log.warn("failed to read suggest response", { error: String(err) }); }
          }
        };
        page.on("response", handler);
      });

      try {
        // Type keyword in search box to trigger suggest API
        await this.typeInSearchBox(page, keyword, false);

        const json = await suggestPromise;
        return parseCanvaSuggestions(json);
      } finally {
        if (handler) page.off("response", handler);
      }
    } catch (e) {
      log.error("suggest failed", { keyword, error: String(e) });
      return [];
    }
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const topics = platformData.topics as string[] | undefined;
    if (!topics) return [];
    return topics
      .filter((t) => t.startsWith("marketplace_topic."))
      .map((t) => t.replace("marketplace_topic.", "").replace(/_/g, "-"));
  }

  // --- Live search (fast, for search micro-server) ---

  /**
   * Fast live search — waits for first search API response + 1.5s buffer
   * instead of waiting for all auto-paginated pages.
   * Typically completes in 3-5 sec (warm browser) or 8-10 sec (cold).
   */
  async liveSearch(keyword: string): Promise<{ A: number; C: any[] }> {
    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const page = await this.ensureBrowserPage();
      const result = await this.doSingleSearch(page, keyword, attempt);

      if (result.gotBlocked && attempt < MAX_ATTEMPTS) {
        log.warn("search got 403, reloading page for retry", { keyword, attempt });
        // Full page reload with extra wait for Cloudflare challenge to settle
        await page.goto("https://www.canva.com/apps", {
          waitUntil: "load",
          timeout: 30_000,
        });
        await page.waitForTimeout(5000);
        continue;
      }

      // Navigate back to /apps to reset page state for next search call
      await page.goto("https://www.canva.com/apps", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      }).catch(() => {});
      try {
        await page.waitForSelector(
          'input[type="search"], input[aria-label*="search" i]',
          { timeout: 15_000 },
        );
      } catch {
        log.warn("search input not found after reset navigation");
      }

      return { A: result.totalResults, C: result.apps };
    }

    return { A: 0, C: [] };
  }

  /**
   * Execute a single search attempt. Returns results + whether Cloudflare blocked us.
   */
  private async doSingleSearch(
    page: Page,
    keyword: string,
    attempt: number,
  ): Promise<{ totalResults: number; apps: any[]; gotBlocked: boolean }> {
    const searchResponses: string[] = [];
    let totalResults = 0;
    let gotBlocked = false;

    const responseHandler = async (response: Response) => {
      const url = response.url();
      if (url.includes("/_ajax/appsearch/")) {
        try {
          const body = await response.text();
          const isSearch = url.includes("/search");
          const status = response.status();
          if (status !== 200) {
            log.warn("API response blocked", { endpoint: isSearch ? "search" : "suggest", status, attempt });
          }
          if (status === 403) gotBlocked = true;
          if (isSearch && status === 200) {
            searchResponses.push(body);
            try {
              const data = JSON.parse(body);
              if (data.A) totalResults = data.A;
            } catch (err) { log.warn("failed to parse search response JSON", { error: String(err) }); }
          }
        } catch (e) {
          log.warn("failed to read intercepted response", { url, error: String(e) });
        }
      }
    };

    page.on("response", responseHandler);

    try {
      await this.typeInSearchBox(page, keyword, true);

      // Wait for first 200 response, then 1.5s buffer for follow-ups
      const MAX_WAIT_MS = 15_000;
      const BUFFER_AFTER_FIRST_MS = 1_500;
      const POLL_MS = 300;
      const start = Date.now();
      let firstResponseAt = 0;

      while (Date.now() - start < MAX_WAIT_MS) {
        await page.waitForTimeout(POLL_MS);
        // If blocked, abort early — no point waiting
        if (gotBlocked) break;
        if (searchResponses.length > 0 && firstResponseAt === 0) {
          firstResponseAt = Date.now();
        }
        if (firstResponseAt > 0 && Date.now() - firstResponseAt >= BUFFER_AFTER_FIRST_MS) {
          break;
        }
      }

      // Merge results
      const allApps: any[] = [];
      const seenIds = new Set<string>();

      for (const respJson of searchResponses) {
        try {
          const data = JSON.parse(respJson);
          for (const app of (data.C || [])) {
            if (!seenIds.has(app.A)) {
              seenIds.add(app.A);
              allApps.push(app);
            }
          }
        } catch (err) { log.warn("failed to parse doSingleSearch response JSON", { keyword, error: String(err) }); }
      }

      log.info("doSingleSearch done", {
        keyword,
        attempt,
        totalResults,
        uniqueApps: allApps.length,
        responses: searchResponses.length,
        gotBlocked,
        ms: Date.now() - start,
      });

      return { totalResults, apps: allApps, gotBlocked };
    } finally {
      page.off("response", responseHandler);
    }
  }

  // --- Browser lifecycle ---

  /**
   * Close the persistent browser. Call this after scraping is complete.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      log.info("closing persistent browser", { poolSize: this.pagePool.length, inUse: this.pagesInUse.size });
      await this.browser.close();
      this.browser = null;
      this.browserContext = null;
      this.browserPage = null;
      this.pagePool = [];
      this.pagesInUse.clear();
    }
    this.searchCache.clear();
  }

  /**
   * Acquire a page from the pool for concurrent use (app detail scraping).
   * Creates a new page if the pool is empty and under the max limit.
   */
  private async acquirePoolPage(): Promise<Page> {
    await this.ensureBrowserPage(); // ensure browser + context are initialized

    // PLA-1083: evict crashed pages from the pool before picking one
    this.pagePool = this.pagePool.filter((p) => {
      if (this.crashedPages.has(p)) {
        this.pagesInUse.delete(p);
        try { p.close().catch(() => {}); } catch { /* ignore */ }
        log.info("pool:evicted_crashed", { poolSize: this.pagePool.length - 1 });
        return false;
      }
      return true;
    });

    // Return an available page from the pool
    for (const page of this.pagePool) {
      if (!this.pagesInUse.has(page)) {
        this.pagesInUse.add(page);
        log.info("pool:acquired_existing", { poolSize: this.pagePool.length, inUse: this.pagesInUse.size });
        return page;
      }
    }

    // Create a new page if under the max
    if (this.pagePool.length < CanvaModule.MAX_POOL_SIZE && this.browserContext) {
      const page = await this.browserContext.newPage();
      this.attachCrashHandler(page);
      this.pagePool.push(page);
      this.pagesInUse.add(page);
      log.info("pool:created_new", { poolSize: this.pagePool.length, inUse: this.pagesInUse.size });
      return page;
    }

    // All pages in use — wait for one to be released
    log.info("pool:waiting", { poolSize: this.pagePool.length, inUse: this.pagesInUse.size });
    while (true) {
      await new Promise((r) => setTimeout(r, 200));
      for (const page of this.pagePool) {
        if (!this.pagesInUse.has(page) && !this.crashedPages.has(page)) {
          this.pagesInUse.add(page);
          return page;
        }
      }
    }
  }

  /**
   * Attach a `crash` listener so we can mark the page as dead and let
   * `acquirePoolPage` evict it before serving another navigation.
   * Also releases it from `pagesInUse` so waiters don't deadlock.
   * PLA-1083.
   */
  private attachCrashHandler(page: Page): void {
    page.on("crash", () => {
      log.error("pool:page_crashed", {
        poolSize: this.pagePool.length,
        inUse: this.pagesInUse.size,
      });
      this.crashedPages.add(page);
      this.pagesInUse.delete(page);
    });
  }

  /**
   * Release a page back to the pool.
   */
  private releasePoolPage(page: Page): void {
    this.pagesInUse.delete(page);
  }

  // --- Private helpers ---

  /**
   * Fetch all search results by triggering Canva's search in the browser
   * and intercepting the API responses.
   */
  private async fetchAllSearchResults(keyword: string): Promise<{ A: number; C: any[] }> {
    const SEARCH_TIMEOUT_MS = 60_000; // 60s per-search timeout
    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result: { A: number; C: any[]; capturedResponses: number } = await Promise.race([
          this.doFetchAllSearchResults(keyword, attempt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`search timed out after ${SEARCH_TIMEOUT_MS / 1000}s`)), SEARCH_TIMEOUT_MS)
          ),
        ]);

        if (result.C.length === 0 && attempt < MAX_ATTEMPTS) {
          log.warn("search returned 0 results, retrying with fresh page", { keyword, attempt });
          await this.resetBrowserPage();
          continue;
        }

        // On the final attempt, if we still captured zero search responses AND
        // got zero results, Canva's search JS never fired — usually because the
        // search input wasn't hydrated (Cloudflare blocked /apps). Throw so
        // withFallback triggers and the failure is accounted for.
        if (result.capturedResponses === 0 && result.C.length === 0) {
          throw new Error(`canva: search captured 0 responses for keyword "${keyword}" after ${attempt} attempts — page likely not hydrated`);
        }

        return { A: result.A, C: result.C };
      } catch (err) {
        log.error("fetchAllSearchResults attempt failed", { keyword, attempt, error: String(err) });
        if (attempt < MAX_ATTEMPTS) {
          log.info("resetting browser page for retry", { keyword, attempt });
          await this.resetBrowserPage();
        } else {
          throw err;
        }
      }
    }

    // Unreachable under normal flow — MAX_ATTEMPTS loop either returns or throws.
    throw new Error(`canva: exhausted ${MAX_ATTEMPTS} attempts for keyword "${keyword}"`);
  }

  /**
   * Reset the shared browser page — close and re-create it.
   * Used to recover from Cloudflare blocks, hangs, or stale page state.
   */
  private async resetBrowserPage(): Promise<void> {
    if (this.browserPage) {
      try { await this.browserPage.close(); } catch { /* ignore */ }
      this.browserPage = null;
    }
    // ensureBrowserPage will create a fresh page + navigate to /apps
    await this.ensureBrowserPage();
  }

  private async doFetchAllSearchResults(keyword: string, attempt: number): Promise<{ A: number; C: any[]; capturedResponses: number }> {
    const page = await this.ensureBrowserPage();

    // Collect all search API responses
    const searchResponses: string[] = [];
    let totalResults = 0;

    const responseHandler = async (response: Response) => {
      if (response.url().includes("/_ajax/appsearch/search")) {
        try {
          const body = await response.text();
          searchResponses.push(body);
          try {
            const data = JSON.parse(body);
            if (data.A) totalResults = data.A;
          } catch (err) { log.warn("failed to parse bulk search response JSON", { error: String(err) }); }
        } catch (err) { log.warn("failed to read bulk search response body", { error: String(err) }); }
      }
    };

    page.on("response", responseHandler);

    try {
      // Type keyword and press Enter to trigger search
      await this.typeInSearchBox(page, keyword, true);

      // Wait for search results with early exit — poll every 1s, stop after 2s of no new responses
      // Canva auto-paginates all pages; typically completes in 3-8 seconds
      const MAX_WAIT_MS = 20_000;
      const IDLE_THRESHOLD_MS = 2_000;
      const POLL_INTERVAL_MS = 1_000;
      let lastResponseCount = 0;
      let idleStart = Date.now();
      const waitStart = Date.now();

      while (Date.now() - waitStart < MAX_WAIT_MS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
        if (searchResponses.length > lastResponseCount) {
          lastResponseCount = searchResponses.length;
          idleStart = Date.now();
        } else if (searchResponses.length > 0 && Date.now() - idleStart >= IDLE_THRESHOLD_MS) {
          // Got responses and no new ones for 2 seconds — done
          break;
        }
      }

      log.info("search responses captured", {
        keyword,
        attempt,
        responseCount: searchResponses.length,
        totalResults,
        waitMs: Date.now() - waitStart,
      });

      // Merge all pages into a single result
      const allApps: any[] = [];
      const seenIds = new Set<string>();

      for (const respJson of searchResponses) {
        try {
          const data = JSON.parse(respJson);
          for (const app of (data.C || [])) {
            if (!seenIds.has(app.A)) {
              seenIds.add(app.A);
              allApps.push(app);
            }
          }
        } catch (err) { log.warn("failed to parse search merge response JSON", { keyword, error: String(err) }); }
      }

      log.info("search results merged", {
        keyword,
        attempt,
        totalResults,
        uniqueApps: allApps.length,
      });

      return { A: totalResults, C: allApps, capturedResponses: searchResponses.length };
    } finally {
      page.off("response", responseHandler);
    }
  }

  /**
   * Type a keyword into the search box on the /apps page.
   * Clears any previous search first.
   */
  private async typeInSearchBox(page: Page, keyword: string, pressEnter: boolean): Promise<void> {
    // Find search input
    const searchInput = await page.$(
      'input[type="search"], input[placeholder*="Search"], input[aria-label*="Search"], input[aria-label*="search"]'
    );

    if (!searchInput) {
      log.warn("search input not found on page");
      return;
    }

    // Clear and type
    await searchInput.click();
    await searchInput.fill("");
    await page.waitForTimeout(200);
    await searchInput.fill(keyword);
    await page.waitForTimeout(500);

    if (pressEnter) {
      await page.keyboard.press("Enter");
    }
  }

  /**
   * Ensure a browser page is available.
   * Launches Chrome with anti-detection flags and saved auth state to pass Cloudflare.
   */
  private async ensureBrowserPage(): Promise<Page> {
    if (this.browserPage) return this.browserPage;

    const t0 = Date.now();
    const isSmokeTest = process.env.SMOKE_TEST === "1";

    // If browser+context exist but page was closed (e.g., after resetBrowserPage),
    // create a new page without relaunching the whole browser.
    if (this.browser?.isConnected() && this.browserContext) {
      log.info("creating fresh page on existing browser", { smokeTest: isSmokeTest });
      this.browserPage = await this.browserContext.newPage();
      this.attachCrashHandler(this.browserPage);
      await this.navigateToAppsPage(this.browserPage, isSmokeTest);
      log.info("fresh page ready", { ms: Date.now() - t0 });
      return this.browserPage;
    }

    log.info("launching Chrome for Canva API access", { smokeTest: isSmokeTest });

    // Prefer installed Chrome for proper TLS fingerprint (Cloudflare bypass),
    // fall back to Playwright's bundled Chromium if Chrome is not available
    const launchOptions = {
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    };
    const { chromium } = await import("playwright");
    try {
      this.browser = await chromium.launch({ ...launchOptions, channel: "chrome" });
      log.info("launched real Chrome");
    } catch {
      log.warn("Chrome not found, falling back to Playwright Chromium");
      this.browser = await chromium.launch(launchOptions);
    }

    // Load saved auth state if available (contains cf_clearance cookies)
    let storageState: any;
    try {
      const fs = await import("fs");
      const path = await import("path");
      // Look for auth state relative to the scraper package root
      const candidates = [
        path.resolve(import.meta.dirname, "../../../canva-auth-state.json"),
        path.resolve(process.cwd(), "canva-auth-state.json"),
        path.resolve(process.cwd(), "apps/scraper/canva-auth-state.json"),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          storageState = JSON.parse(fs.readFileSync(p, "utf-8"));
          log.info("loaded saved auth state", { path: p, cookies: storageState.cookies?.length });
          break;
        }
      }
    } catch (err) { log.warn("failed to load canva auth state", { error: String(err) }); }

    this.browserContext = await this.browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ...(storageState && { storageState }),
    });
    this.browserPage = await this.browserContext.newPage();
    this.attachCrashHandler(this.browserPage);
    await this.navigateToAppsPage(this.browserPage, isSmokeTest);
    log.info("canva:browser_ready", { totalMs: Date.now() - t0 });

    // Cache the page HTML while we're here
    if (!this.cachedAppsPageHtml) {
      this.cachedAppsPageHtml = await this.browserPage.content();
      const appCount = (this.cachedAppsPageHtml.match(/"B":"SDK_APP"/g) || []).length;
      log.info("cached /apps page", { htmlLength: this.cachedAppsPageHtml.length, embeddedApps: appCount });
    }

    return this.browserPage;
  }

  /**
   * Navigate a page to /apps and wait for Cloudflare + SPA hydration.
   * Extracted so it can be reused when resetting pages after timeouts.
   */
  private async navigateToAppsPage(page: Page, isSmokeTest: boolean): Promise<void> {
    const gotoWait = isSmokeTest ? "domcontentloaded" as const : "load" as const;
    const gotoTimeout = isSmokeTest ? 15_000 : 30_000;
    await page.goto("https://www.canva.com/apps", {
      waitUntil: gotoWait,
      timeout: gotoTimeout,
    });

    // Wait for Cloudflare challenge to auto-resolve if present.
    // Production CF passes take 20-35s in logs with real Chrome + valid
    // clearance cookies, so 45s gives headroom; keep 8s for smoke tests.
    const initTitle = await page.title();
    if (initTitle === "Just a moment...") {
      log.info("Cloudflare challenge on /apps, waiting for auto-resolve");
      const cfTimeout = isSmokeTest ? 8_000 : 45_000;
      try {
        await page.waitForFunction(
          () => document.title !== "Just a moment...",
          { timeout: cfTimeout },
        );
        log.info("Cloudflare challenge resolved on /apps", { newTitle: await page.title() });
        await page.waitForTimeout(isSmokeTest ? 1000 : 3000);
      } catch {
        log.warn("Cloudflare challenge on /apps did not resolve in time");
      }
    }

    // Wait for search input to appear (SPA hydration)
    const selectorTimeout = isSmokeTest ? 8_000 : 20_000;
    try {
      await page.waitForSelector(
        'input[type="search"], input[aria-label*="search" i]',
        { timeout: selectorTimeout },
      );
      log.info("search input found, page hydrated");
    } catch {
      log.warn(`search input not found after ${selectorTimeout / 1000}s, continuing anyway`);
    }

    // Extra settle time for Cloudflare background JS
    await page.waitForTimeout(isSmokeTest ? 500 : 2000);
  }

  /**
   * Fetch the /apps page HTML, with caching.
   */
  private async fetchAppsPage(): Promise<string> {
    if (this.cachedAppsPageHtml) {
      log.info("using cached /apps page HTML");
      return this.cachedAppsPageHtml;
    }

    await this.ensureBrowserPage();
    return this.cachedAppsPageHtml!;
  }

  private extractCategorySlugFromUrl(url: string): string {
    const match = url.match(/[?&]category=([^&]+)/);
    if (match) return match[1];
    return url.split("/").pop()?.split("?")[0] || url;
  }
}
