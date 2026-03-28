import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  PlatformConstants,
  PlatformScoringConfig,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { withFallback } from "../../utils/with-fallback.js";
import type { FallbackTracker } from "../../utils/fallback-tracker.js";
import { zohoUrls } from "./urls.js";
import { ZOHO_CONSTANTS, ZOHO_SCORING } from "./constants.js";
import { parseZohoAppDetails } from "./parsers/app-parser.js";
import { parseZohoCategoryPage } from "./parsers/category-parser.js";
import { parseZohoSearchPage } from "./parsers/search-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("zoho");

/**
 * Zoho Marketplace platform module.
 *
 * Key architectural notes:
 * - App detail pages embed data in `var detailsObject = {...}` → HttpClient + Cheerio
 * - Category pages and search pages are SPAs → BrowserClient (Playwright)
 * - Each Zoho product (CRM, Desk, Books, etc.) is a category
 * - Slug format: {service}--{namespace} (e.g., crm--jotform)
 * - hasReviews: false (reviews not publicly accessible in a scrapeable format)
 * - hasFeaturedSections: false
 */
export class ZohoModule implements PlatformModule {
  readonly platformId = "zoho" as const;
  readonly constants: PlatformConstants = ZOHO_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = ZOHO_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: false,
    hasFeaturedSections: false,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: true,
    hasFlatCategories: true,
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;
  tracker?: FallbackTracker;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker) {
    this.httpClient = httpClient || new HttpClient();
    this.browserClient = browserClient;
    this.tracker = tracker;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return zohoUrls.app(slug);
  }

  buildCategoryUrl(slug: string): string {
    return zohoUrls.category(slug);
  }

  buildSearchUrl(keyword: string, _page?: number): string {
    return zohoUrls.search(keyword);
  }

  // --- Fetch ---

  /**
   * Fetch app detail page via HttpClient (data is embedded in script tags).
   * Fallback: browser rendering.
   */
  async fetchAppPage(slug: string): Promise<string> {
    const url = zohoUrls.app(slug);
    log.info("fetching app page", { slug, url });
    return withFallback(
      () => this.httpClient.fetchPage(url),
      () => this.browserClient!.fetchPage(url, { waitUntil: "domcontentloaded", extraWaitMs: 3000 }),
      `zoho/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  /**
   * Fetch category page via BrowserClient (SPA rendering required).
   * Fallback: HTTP (partial data).
   */
  async fetchCategoryPage(slug: string, _page?: number): Promise<string> {
    const url = zohoUrls.category(slug);
    log.info("fetching category page", { slug, url });
    return withFallback(
      () => this.browserClient!.fetchPage(url, { waitUntil: "domcontentloaded", extraWaitMs: 3000 }),
      () => this.httpClient.fetchPage(url),
      `zoho/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  /**
   * Fetch search page via BrowserClient (SPA rendering required).
   * Fallback: HTTP (partial data).
   */
  async fetchSearchPage(keyword: string, _page?: number): Promise<string | null> {
    const url = zohoUrls.search(keyword);
    log.info("fetching search page", { keyword, url });
    return withFallback(
      () => this.browserClient!.fetchPage(url, { waitUntil: "domcontentloaded", extraWaitMs: 3000 }),
      () => this.httpClient.fetchPage(url),
      `zoho/fetchSearchPage/${keyword}`,
      this.tracker,
    );
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseZohoAppDetails(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseZohoCategoryPage(html, slug, url);
  }

  parseSearchPage(
    html: string,
    keyword: string,
    page: number,
    _offset: number,
  ): NormalizedSearchPage {
    return parseZohoSearchPage(html, keyword, page);
  }

  // --- Slug extraction ---

  /**
   * Extract app slug from a Zoho Marketplace URL.
   * URL: /app/{service}/{namespace} → slug: {service}--{namespace}
   */
  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/app\/([^/]+)\/([^/?#]+)/);
    if (match) {
      return `${match[1]}--${match[2]}`;
    }
    // Fallback: last path segment
    return url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const cats = platformData.categories as Array<{ slug?: string }> | undefined;
    if (!Array.isArray(cats)) return [];
    return cats.map((c) => c.slug).filter((s): s is string => !!s);
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    // Match /app/{service} (but not /app/{service}/{namespace})
    const match = url.match(/\/app\/([^/?#]+)(?:\/|$)/);
    if (match) {
      // If the URL has a second segment, it's an app, not a category
      const fullMatch = url.match(/\/app\/([^/]+)\/([^/?#]+)/);
      if (fullMatch) return fullMatch[1]; // Return just the service (category slug)
      return match[1];
    }
    return url;
  }
}
