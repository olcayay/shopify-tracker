import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedReviewPage,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import type { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { googleWorkspaceUrls } from "./urls.js";
import { GOOGLE_WORKSPACE_CONSTANTS, GOOGLE_WORKSPACE_SCORING } from "./constants.js";
import { parseGoogleWorkspaceAppPage } from "./parsers/app-parser.js";
import { parseGoogleWorkspaceCategoryPage } from "./parsers/category-parser.js";
import { parseGoogleWorkspaceSearchPage } from "./parsers/search-parser.js";
import { parseGoogleWorkspaceReviewPage } from "./parsers/review-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("google-workspace-module");

/**
 * Google Workspace Marketplace platform module.
 *
 * Key architectural notes:
 * - Angular SPA ("AdditnowStoreUi") — fully JS-rendered, no server-side HTML
 * - All pages require Playwright for rendered content
 * - URL patterns: /app/{name}/{id}, /category/{parent}/{child}, /search/{query}
 * - Slug format: {name}--{id} (same -- separator as Canva)
 * - Conservative rate limiting (3-5s) to avoid Google bot detection
 */
export class GoogleWorkspaceModule implements PlatformModule {
  readonly platformId = "google_workspace" as const;
  readonly constants: PlatformConstants = GOOGLE_WORKSPACE_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = GOOGLE_WORKSPACE_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;

  /** Persistent browser for scraping */
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private browserPage: Page | null = null;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
    this.httpClient = httpClient || ({} as HttpClient);
    this.browserClient = browserClient;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return googleWorkspaceUrls.app(slug);
  }

  buildCategoryUrl(slug: string, _page?: number): string {
    return googleWorkspaceUrls.category(slug);
  }

  buildSearchUrl(keyword: string, _page?: number): string {
    return googleWorkspaceUrls.search(keyword);
  }

  buildReviewUrl(slug: string, _page?: number): string {
    // Reviews are on the app detail page
    return googleWorkspaceUrls.app(slug);
  }

  // --- Fetch (all via browser) ---

  async fetchAppPage(slug: string): Promise<string> {
    const page = await this.ensureBrowserPage();
    const url = this.buildAppUrl(slug);
    log.info("fetching app detail page", { slug, url });

    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await this.waitForAngularRender(page);
    await page.waitForTimeout(2000);

    const html = await page.content();
    log.info("app detail page fetched", { slug, htmlLength: html.length });
    return html;
  }

  async fetchCategoryPage(slug: string, _page?: number): Promise<string> {
    const page = await this.ensureBrowserPage();
    const url = this.buildCategoryUrl(slug);
    log.info("fetching category page", { slug, url });

    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await this.waitForAngularRender(page);

    // Wait for app cards to load
    try {
      await page.waitForSelector('a[href*="/marketplace/app/"]', { timeout: 15_000 });
    } catch {
      log.warn("no app cards found on category page", { slug });
    }
    await page.waitForTimeout(2000);

    // Scroll to bottom repeatedly to trigger lazy loading of more apps
    await this.scrollToLoadAll(page);

    const html = await page.content();
    log.info("category page fetched", { slug, htmlLength: html.length });
    return html;
  }

  async fetchSearchPage(keyword: string, _page?: number): Promise<string | null> {
    const page = await this.ensureBrowserPage();
    const url = this.buildSearchUrl(keyword);
    log.info("fetching search page", { keyword, url });

    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await this.waitForAngularRender(page);

    // Wait for search results
    try {
      await page.waitForSelector('a[href*="/marketplace/app/"]', { timeout: 15_000 });
    } catch {
      log.warn("no search results found", { keyword });
    }
    await page.waitForTimeout(2000);

    // Scroll to bottom repeatedly to trigger lazy loading of more results
    await this.scrollToLoadAll(page);

    const html = await page.content();
    log.info("search page fetched", { keyword, htmlLength: html.length });
    return html;
  }

  async fetchReviewPage(slug: string, _page?: number): Promise<string | null> {
    // Reviews are on the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseGoogleWorkspaceAppPage(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const categorySlug = this.extractCategorySlugFromUrl(url);
    return parseGoogleWorkspaceCategoryPage(html, categorySlug, 1, 0);
  }

  parseSearchPage(html: string, keyword: string, page: number, offset: number): NormalizedSearchPage {
    return parseGoogleWorkspaceSearchPage(html, keyword, page, offset);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseGoogleWorkspaceReviewPage(html, page);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // Match /marketplace/app/{name}/{id}
    const match = url.match(/\/marketplace\/app\/([^/?]+)\/([^/?]+)/);
    if (match) return `${match[1]}--${match[2]}`;
    return url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const category = platformData.category as string | undefined;
    if (!category) return [];
    return [category];
  }

  // --- Browser lifecycle ---

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      log.info("closing persistent browser");
      await this.browser.close();
      this.browser = null;
      this.browserContext = null;
      this.browserPage = null;
    }
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    const match = url.match(/\/marketplace\/category\/([^/?]+)(?:\/([^/?]+))?/);
    if (match) return match[2] ? `${match[1]}--${match[2]}` : match[1];
    return url.split("/").pop()?.split("?")[0] || url;
  }

  /**
   * Scroll page to bottom repeatedly to trigger lazy loading.
   * Google Workspace Marketplace loads ~100 apps initially and may load more on scroll.
   * Stops when no new app cards appear after scrolling.
   */
  private async scrollToLoadAll(page: Page): Promise<void> {
    let previousCount = 0;
    let stableRounds = 0;
    const maxScrolls = 20;

    for (let i = 0; i < maxScrolls; i++) {
      const currentCount = await page.evaluate(() =>
        document.querySelectorAll('a[href*="/marketplace/app/"]').length
      );

      if (currentCount === previousCount) {
        stableRounds++;
        if (stableRounds >= 2) {
          log.info("scroll complete, no more apps loading", { totalApps: currentCount, scrolls: i });
          break;
        }
      } else {
        stableRounds = 0;
        log.info("scroll loaded more apps", { before: previousCount, after: currentCount, scroll: i });
      }
      previousCount = currentCount;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
  }

  /**
   * Wait for the Google Workspace Marketplace SPA to finish rendering.
   * The marketplace uses Google's own framework ("AdditnowStoreUi"), not standard Angular.
   * We wait for actual content elements instead of framework-specific roots.
   */
  private async waitForAngularRender(page: Page): Promise<void> {
    try {
      await page.waitForFunction(
        () => {
          // Check for app detail container or card links — either means content rendered
          const appDetail = document.querySelector("div.oPwrAb, div[data-card-index]");
          if (appDetail) return true;
          // Also check for any marketplace app links as a fallback
          const appLinks = document.querySelectorAll('a[href*="/marketplace/app/"]');
          return appLinks.length > 0;
        },
        { timeout: 15_000 },
      );
    } catch {
      log.warn("content render wait timed out, continuing anyway");
    }
  }

  /**
   * Ensure a browser page is available.
   * Launches Chrome with anti-detection flags for Google.
   */
  private async ensureBrowserPage(): Promise<Page> {
    if (this.browserPage) return this.browserPage;

    log.info("launching Chrome for Google Workspace scraping");

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

    // Load saved auth state if available
    let storageState: any;
    try {
      const fs = await import("fs");
      const path = await import("path");
      const candidates = [
        path.resolve(import.meta.dirname, "../../../google-workspace-auth-state.json"),
        path.resolve(process.cwd(), "google-workspace-auth-state.json"),
        path.resolve(process.cwd(), "apps/scraper/google-workspace-auth-state.json"),
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

    // Navigate to marketplace home first to establish cookies
    await this.browserPage.goto("https://workspace.google.com/marketplace", {
      waitUntil: "load",
      timeout: 30_000,
    });

    // Wait for page to render
    await this.browserPage.waitForTimeout(3000);

    log.info("browser page ready");
    return this.browserPage;
  }
}
