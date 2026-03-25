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
import { hubspotUrls } from "./urls.js";
import { HUBSPOT_CONSTANTS, HUBSPOT_SCORING } from "./constants.js";
import { parseHubSpotAppDetails } from "./parsers/app-parser.js";
import { parseHubSpotCategoryPage } from "./parsers/category-parser.js";
import { parseHubSpotSearchPage } from "./parsers/search-parser.js";
import { parseHubSpotReviewPage } from "./parsers/review-parser.js";
import { parseHubSpotFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("hubspot");

/**
 * HubSpot App Marketplace platform module.
 *
 * Key architectural notes:
 * - Pure SPA (no SSR, no embedded JSON) — requires BrowserClient for all scraping
 * - App URL: /marketplace/listing/{slug}
 * - Category URL: /marketplace/apps/{slug} or /marketplace/apps/{parent}/{child}
 * - Search URL: /marketplace/explore?query={keyword}
 * - 6 top-level categories (hierarchical with subcategories)
 * - Reviews are on the app detail page
 * - Featured sections/collections on homepage
 */
export class HubSpotModule implements PlatformModule {
  readonly platformId = "hubspot" as const;
  readonly constants: PlatformConstants = HUBSPOT_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = HUBSPOT_SCORING;

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

  private httpClient?: HttpClient;
  private browserClient?: BrowserClient;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
    this.httpClient = httpClient;
    this.browserClient = browserClient;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return hubspotUrls.app(slug);
  }

  buildCategoryUrl(slug: string): string {
    return hubspotUrls.category(slug);
  }

  buildSearchUrl(keyword: string): string {
    return hubspotUrls.search(keyword);
  }

  buildReviewUrl(slug: string): string {
    return hubspotUrls.reviews(slug);
  }

  // --- Fetch ---

  /** All pages require BrowserClient (pure SPA). */
  async fetchAppPage(slug: string): Promise<string> {
    const url = hubspotUrls.app(slug);
    log.info("fetching app page via browser", { slug, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for HubSpot app pages (pure SPA)");
    }
    return this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 3000,
    });
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const url = hubspotUrls.category(slug, page);
    log.info("fetching category page via browser", { slug, page: page ?? 1, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for HubSpot category pages (pure SPA)");
    }
    return this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 3000,
    });
  }

  async fetchSearchPage(keyword: string): Promise<string | null> {
    const url = hubspotUrls.search(keyword);
    log.info("fetching search page via browser", { keyword, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for HubSpot search pages (pure SPA)");
    }
    return this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 3000,
    });
  }

  async fetchReviewPage(slug: string): Promise<string | null> {
    // Reviews are on the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseHubSpotAppDetails(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseHubSpotCategoryPage(html, slug, url);
  }

  parseSearchPage(
    html: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    return parseHubSpotSearchPage(html, keyword, page);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseHubSpotReviewPage(html, page);
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const url = hubspotUrls.homepage();
    log.info("fetching featured sections from homepage", { url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for HubSpot featured sections (pure SPA)");
    }
    const html = await this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 5000,
    });
    return parseHubSpotFeaturedSections(html);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // URL format: /marketplace/listing/{slug}
    const match = url.match(/\/marketplace\/listing\/([^/?#]+)/);
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

  private extractCategorySlugFromUrl(url: string): string {
    // URL format: /marketplace/apps/{slug} or /marketplace/apps/{parent}/{child}?page=N
    const match = url.match(/\/marketplace\/apps\/([^?#]+)/);
    if (match) {
      // Replace "/" with "--" for compound slugs
      return match[1].replace(/\/$/, "").replace("/", "--");
    }
    return url;
  }
}
