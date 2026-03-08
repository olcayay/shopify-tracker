import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedFeaturedSection,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { chromium, type Browser } from "playwright";
import { canvaUrls } from "./urls.js";
import { CANVA_CONSTANTS, CANVA_SCORING } from "./constants.js";
import { parseCanvaAppPage, extractCanvaApps, normalizeCanvaApp } from "./parsers/app-parser.js";
import { parseCanvaCategoryPage } from "./parsers/category-parser.js";
import { parseCanvaFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("canva-module");

/**
 * Canva Apps Marketplace platform module.
 *
 * Key architectural notes:
 * - Canva embeds ALL app data (~1000+ apps) as JSON in the main /apps page
 * - No separate API endpoints — everything from browser-rendered HTML
 * - No reviews, ratings, keyword search, or ad system
 * - Categories are filter tabs on the main page, mapped to marketplace_topic.* tags
 * - BrowserClient required (Cloudflare protection blocks HTTP requests)
 * - App detail pages are blocked by Cloudflare, but not needed since
 *   the main page contains all app metadata
 */
export class CanvaModule implements PlatformModule {
  readonly platformId = "canva" as const;
  readonly constants: PlatformConstants = CANVA_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = CANVA_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: false,
    hasReviews: false,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;

  /** Cached HTML of the /apps page to avoid re-fetching */
  private cachedAppsPageHtml: string | null = null;

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

  /**
   * Fetch the main /apps page. All app data is embedded here.
   *
   * For app detail fetching, we return the main page HTML since
   * individual app pages are blocked by Cloudflare but all data
   * is available in the main page embedded JSON.
   */
  async fetchAppPage(_slug: string): Promise<string> {
    return this.fetchAppsPage();
  }

  /**
   * Fetch category data. All categories come from the same /apps page.
   */
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
    // URL format: /apps/AAF_8lkU9VE/ai-music
    const match = url.match(/\/apps\/(AA[FG][A-Za-z0-9_-]+(?:\/[a-z0-9-]+)?)/);
    if (match) return match[1];
    return url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const topics = platformData.topics as string[] | undefined;
    if (!topics) return [];
    // Strip "marketplace_topic." prefix and convert to slug format
    return topics
      .filter((t) => t.startsWith("marketplace_topic."))
      .map((t) => t.replace("marketplace_topic.", "").replace(/_/g, "-"));
  }

  // --- Private helpers ---

  /**
   * Fetch the /apps page HTML, with caching to avoid redundant requests.
   * Uses domcontentloaded + wait instead of networkidle because Canva's
   * long-polling connections prevent networkidle from ever resolving.
   */
  private async fetchAppsPage(): Promise<string> {
    if (this.cachedAppsPageHtml) {
      log.info("using cached /apps page HTML");
      return this.cachedAppsPageHtml;
    }

    const url = canvaUrls.apps();
    log.info("fetching /apps page via browser", { url });

    // Use our own browser context with domcontentloaded instead of networkidle
    // to avoid Canva's long-polling timeout issues
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      // Wait for SPA hydration and embedded JSON to be present
      await page.waitForTimeout(8000);
      this.cachedAppsPageHtml = await page.content();
      await context.close();
    } finally {
      if (browser) await browser.close();
    }

    // Verify we got actual app data
    const appCount = (this.cachedAppsPageHtml.match(/"B":"SDK_APP"/g) || []).length;
    log.info("fetched /apps page", { htmlLength: this.cachedAppsPageHtml.length, embeddedApps: appCount });

    if (appCount === 0) {
      log.warn("no embedded app data found — page may be blocked or structure changed");
    }

    return this.cachedAppsPageHtml;
  }

  private extractCategorySlugFromUrl(url: string): string {
    // From URL like: .../apps?category=ai-generation
    const match = url.match(/[?&]category=([^&]+)/);
    if (match) return match[1];
    // Fallback
    return url.split("/").pop()?.split("?")[0] || url;
  }
}
