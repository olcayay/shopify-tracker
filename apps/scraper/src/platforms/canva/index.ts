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

  async fetchAppPage(_slug: string): Promise<string> {
    return this.fetchAppsPage();
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
    const match = url.match(/\/apps\/(AA[FG][A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?/);
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

      // Wait for search results — Canva auto-paginates all pages
      // The search typically completes in 5-10 seconds (4 pages)
      await page.waitForTimeout(12000);

      log.info("search responses captured", {
        keyword,
        responseCount: searchResponses.length,
        totalResults,
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

    // Use real Chrome binary with anti-detection flags for Cloudflare bypass
    this.browser = await chromium.launch({
      headless: true,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

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

    // Navigate to /apps to pass Cloudflare and load the search UI
    await this.browserPage.goto("https://www.canva.com/apps", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await this.browserPage.waitForTimeout(8000);

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
