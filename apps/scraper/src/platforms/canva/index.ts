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
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
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
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;

  /** Cached HTML of the /apps page to avoid re-fetching */
  private cachedAppsPageHtml: string | null = null;

  /** Persistent browser for search API calls */
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private browserPage: Page | null = null;

  /** Cache search results per keyword (all pages fetched at once) */
  private searchCache = new Map<string, string>();

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
    this.httpClient = httpClient || new HttpClient();
    this.browserClient = browserClient;
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
    const page = await this.ensureBrowserPage();
    const appId = slug.split("--")[0];
    const urlSlug = slug.split("--")[1] || "";
    const detailUrl = `https://www.canva.com/apps/${appId}/${urlSlug}`;
    log.info("fetching app detail page", { slug, detailUrl });

    await page.goto(detailUrl, { waitUntil: "load", timeout: 30_000 });

    const title = await page.title();
    const isBulkPage = title === "Apps Marketplace | Canva";
    log.info("detail page loaded", { slug, title, isBulkPage });

    if (isBulkPage) {
      // Server returned the bulk /apps page instead of the SSR detail page.
      // Wait for SPA to hydrate, route to the detail view, and render data.
      log.info("waiting for SPA to render detail view", { slug });
      try {
        // Wait until the title changes to "AppName - Canva Apps" (detail page title)
        await page.waitForFunction(
          () => document.title !== "Apps Marketplace | Canva",
          { timeout: 15_000 },
        );
        // Extra time for the detail data to be fetched and rendered
        await page.waitForTimeout(3000);
        log.info("SPA rendered detail view", { slug, newTitle: await page.title() });
      } catch {
        log.warn("SPA did not render detail view in time", { slug });
        // Try waiting for networkidle as last resort
        await page.waitForTimeout(5000);
      }
    } else {
      // SSR detail page loaded directly — just wait for hydration
      await page.waitForTimeout(2000);
    }

    const html = await page.content();
    const hasDetailJson = html.includes(`"A":"${appId}"`) && !html.includes(`"A":"${appId}","B":"SDK_APP"`);
    log.info("app detail page fetched", { slug, htmlLength: html.length, hasDetailJson });

    return html;
  }

  async fetchCategoryPage(_slug: string, _page?: number): Promise<string> {
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
      const suggestPromise = new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve("{}"), 10000);
        const handler = async (response: Response) => {
          if (response.url().includes("/_ajax/appsearch/suggest")) {
            try {
              const body = await response.text();
              clearTimeout(timeout);
              page.off("response", handler);
              resolve(body);
            } catch {}
          }
        };
        page.on("response", handler);
      });

      // Type keyword in search box to trigger suggest API
      await this.typeInSearchBox(page, keyword, false);

      const json = await suggestPromise;
      return parseCanvaSuggestions(json);
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
            } catch {}
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
        } catch {}
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
      log.info("closing persistent browser");
      await this.browser.close();
      this.browser = null;
      this.browserContext = null;
      this.browserPage = null;
    }
    this.searchCache.clear();
  }

  // --- Private helpers ---

  /**
   * Fetch all search results by triggering Canva's search in the browser
   * and intercepting the API responses.
   */
  private async fetchAllSearchResults(keyword: string): Promise<{ A: number; C: any[] }> {
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
          } catch {}
        } catch {}
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
        } catch {}
      }

      log.info("search results merged", {
        keyword,
        totalResults,
        uniqueApps: allApps.length,
      });

      return { A: totalResults, C: allApps };
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

    log.info("launching Chrome for Canva API access");

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
    } catch {}

    this.browserContext = await this.browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ...(storageState && { storageState }),
    });
    this.browserPage = await this.browserContext.newPage();

    // Navigate to /apps — use "load" to wait for full page load including Cloudflare JS
    await this.browserPage.goto("https://www.canva.com/apps", {
      waitUntil: "load",
      timeout: 30_000,
    });

    // Wait for Cloudflare challenge to auto-resolve if present
    const initTitle = await this.browserPage.title();
    if (initTitle === "Just a moment...") {
      log.info("Cloudflare challenge on /apps, waiting for auto-resolve");
      try {
        await this.browserPage.waitForFunction(
          () => document.title !== "Just a moment...",
          { timeout: 15_000 },
        );
        log.info("Cloudflare challenge resolved on /apps", { newTitle: await this.browserPage.title() });
        // Wait for SPA hydration after challenge resolves
        await this.browserPage.waitForTimeout(3000);
      } catch {
        log.warn("Cloudflare challenge on /apps did not resolve in time");
      }
    }

    // Wait for search input to appear (SPA hydration)
    try {
      await this.browserPage.waitForSelector(
        'input[type="search"], input[aria-label*="search" i]',
        { timeout: 20_000 },
      );
      log.info("search input found, page hydrated");
    } catch {
      log.warn("search input not found after 20s, continuing anyway");
    }

    // Extra settle time for Cloudflare background JS
    await this.browserPage.waitForTimeout(2000);

    // Cache the page HTML while we're here
    if (!this.cachedAppsPageHtml) {
      this.cachedAppsPageHtml = await this.browserPage.content();
      const appCount = (this.cachedAppsPageHtml.match(/"B":"SDK_APP"/g) || []).length;
      log.info("cached /apps page", { htmlLength: this.cachedAppsPageHtml.length, embeddedApps: appCount });
    }

    return this.browserPage;
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
