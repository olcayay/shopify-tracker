import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  PlatformConstants,
  PlatformScoringConfig,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedReviewPage,
  NormalizedFeaturedSection,
} from "../platform-module.js";
import type { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { withFallback } from "../../utils/with-fallback.js";
import type { FallbackTracker } from "../../utils/fallback-tracker.js";
import { woocommerceUrls } from "./urls.js";
import { WOOCOMMERCE_CONSTANTS, WOOCOMMERCE_SCORING, WOOCOMMERCE_PAGE_SIZE } from "./constants.js";
import { parseWooCommerceAppDetails } from "./parsers/app-parser.js";
import { parseWooCommerceCategoryPage } from "./parsers/category-parser.js";
import { parseWooCommerceSearchPage } from "./parsers/search-parser.js";
import { parseWooCommerceReviewPage } from "./parsers/review-parser.js";
import { parseWooCommerceFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("woocommerce");

/**
 * WooCommerce Marketplace platform module.
 *
 * Uses the WooCommerce.com REST API at /wp-json/wccom-extensions/1.0/:
 * - GET /search — paginated listing with category/keyword filtering
 * - GET /categories — flat list of all categories
 * - GET /featured — curated featured sections
 *
 * All endpoints are public and return JSON. No browser/Playwright needed.
 * ~1305 total extensions across 8 categories.
 */
export class WooCommerceModule implements PlatformModule {
  readonly platformId = "woocommerce" as const;
  readonly constants: PlatformConstants = WOOCOMMERCE_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = WOOCOMMERCE_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true, // Aggregate rating + count from search API
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: true,
  };

  private httpClient?: HttpClient;
  private browserClient?: BrowserClient;
  tracker?: FallbackTracker;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker) {
    this.httpClient = httpClient;
    this.browserClient = browserClient;
    this.tracker = tracker;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return woocommerceUrls.app(slug);
  }

  buildCategoryUrl(slug: string, page?: number): string {
    return woocommerceUrls.category(slug, page);
  }

  buildSearchUrl(keyword: string, page?: number): string {
    return woocommerceUrls.search(keyword, page);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    log.info("fetching app via search API", { slug });
    const url = woocommerceUrls.search(slug);
    return withFallback(
      () => this.fetchJson(url),
      () => this.fetchViaBrowser(woocommerceUrls.app(slug)),
      `woocommerce/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const pageNum = page ?? 1;
    log.info("fetching category via search API", { slug, page: pageNum });
    const url = woocommerceUrls.category(slug, pageNum);
    return withFallback(
      () => this.fetchJson(url),
      () => this.fetchViaBrowser(url),
      `woocommerce/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    const pageNum = page ?? 1;
    log.info("fetching search via search API", { keyword, page: pageNum });
    const url = woocommerceUrls.search(keyword, pageNum);
    return withFallback(
      () => this.fetchJson(url),
      () => this.fetchViaBrowser(url),
      `woocommerce/fetchSearchPage/${keyword}`,
      this.tracker,
    );
  }

  async fetchReviewPage(_slug: string, page?: number): Promise<string | null> {
    // Individual reviews not available via API; aggregate stats in app details
    return JSON.stringify({ reviews: [], total: 0, page: page ?? 1 });
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    log.info("fetching featured sections");
    const url = woocommerceUrls.featured();
    const json = await withFallback(
      () => this.fetchJson(url),
      () => this.fetchViaBrowser(url),
      "woocommerce/fetchFeaturedSections",
      this.tracker,
    );
    return parseWooCommerceFeaturedSections(json);
  }

  // --- Parse ---

  parseAppDetails(json: string, slug: string): NormalizedAppDetails {
    return parseWooCommerceAppDetails(json, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    const page = this.extractPageFromUrl(url);
    return parseWooCommerceCategoryPage(json, slug, url, page);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    return parseWooCommerceSearchPage(json, keyword, page);
  }

  parseReviewPage(json: string, page: number): NormalizedReviewPage {
    return parseWooCommerceReviewPage(json, page);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // URL format: /products/{slug}/ or /products/{slug}
    const match = url.match(/\/products\/([^/?#]+)/);
    if (match) return match[1];
    return url.split("/").filter(Boolean).pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const cats = platformData.categories as Array<{ slug?: string }> | undefined;
    if (!Array.isArray(cats)) return [];
    return cats.map((c) => c.slug).filter((s): s is string => !!s);
  }

  // --- Private helpers ---

  private async fetchJson(url: string): Promise<string> {
    if (!this.httpClient) {
      throw new Error("HttpClient required for WooCommerce API calls");
    }
    return this.httpClient.fetchPage(url);
  }

  private async fetchViaBrowser(url: string): Promise<string> {
    if (!this.browserClient) {
      throw new Error("BrowserClient required for WooCommerce browser fallback");
    }
    return this.browserClient.withPage(
      url,
      async (page) => {
        return page.content();
      },
      { waitUntil: "domcontentloaded", extraWaitMs: 2000 },
    );
  }

  private extractCategorySlugFromUrl(url: string): string {
    // URL format: /search?category={slug}&...
    const match = url.match(/[?&]category=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    return url;
  }

  private extractPageFromUrl(url: string): number {
    const match = url.match(/[?&]page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }
}
