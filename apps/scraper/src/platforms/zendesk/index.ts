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
import type { BrowserClient } from "../../browser-client.js";
import { zendeskUrls } from "./urls.js";
import { ZENDESK_CONSTANTS, ZENDESK_SCORING } from "./constants.js";
import { parseZendeskAppDetails } from "./parsers/app-parser.js";
import { parseZendeskCategoryPage } from "./parsers/category-parser.js";
import { parseZendeskSearchPage } from "./parsers/search-parser.js";
import { parseZendeskReviewPage } from "./parsers/review-parser.js";
import { parseZendeskFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("zendesk");

/**
 * Zendesk Marketplace platform module.
 *
 * Key architectural notes:
 * - ALL pages use BrowserClient (Cloudflare blocks HTTP requests)
 * - App URL: /marketplace/apps/{product}/{numericId}/{text-slug}/
 * - Slug format: {numericId}--{text-slug}
 * - Product type (support/sell/chat) stored in externalId for URL reconstruction
 * - 15 flat categories, no hierarchy
 * - Reviews are on the app detail page
 * - Featured sections on homepage
 */
export class ZendeskModule implements PlatformModule {
  readonly platformId = "zendesk" as const;
  readonly constants: PlatformConstants = ZENDESK_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = ZENDESK_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: true,
  };

  private browserClient?: BrowserClient;

  constructor(_httpClient?: unknown, browserClient?: BrowserClient) {
    this.browserClient = browserClient;
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return zendeskUrls.app(slug);
  }

  buildCategoryUrl(slug: string): string {
    return zendeskUrls.category(slug);
  }

  buildSearchUrl(keyword: string): string {
    return zendeskUrls.search(keyword);
  }

  buildReviewUrl(slug: string): string {
    return zendeskUrls.reviews(slug);
  }

  // --- Fetch (all via BrowserClient due to Cloudflare) ---

  async fetchAppPage(slug: string): Promise<string> {
    const url = zendeskUrls.app(slug);
    log.info("fetching app page via browser", { slug, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk (Cloudflare protection)");
    }
    return this.browserClient.fetchPage(url);
  }

  async fetchCategoryPage(slug: string): Promise<string> {
    const url = zendeskUrls.category(slug);
    log.info("fetching category page via browser", { slug, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk (Cloudflare protection)");
    }
    return this.browserClient.fetchPage(url);
  }

  async fetchSearchPage(keyword: string): Promise<string | null> {
    const url = zendeskUrls.search(keyword);
    log.info("fetching search page via browser", { keyword, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk (Cloudflare protection)");
    }
    return this.browserClient.fetchPage(url);
  }

  async fetchReviewPage(slug: string): Promise<string | null> {
    // Reviews are on the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseZendeskAppDetails(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseZendeskCategoryPage(html, slug, url);
  }

  parseSearchPage(
    html: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    return parseZendeskSearchPage(html, keyword, page);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseZendeskReviewPage(html, page);
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const url = zendeskUrls.homepage();
    log.info("fetching featured sections from homepage", { url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk (Cloudflare protection)");
    }
    const html = await this.browserClient.fetchPage(url);
    return parseZendeskFeaturedSections(html);
  }

  // --- Slug extraction ---

  /**
   * Extract app slug from a Zendesk Marketplace URL.
   * URL: /marketplace/apps/{product}/{numericId}/{text-slug}/
   * Slug: {numericId}--{text-slug}
   */
  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/marketplace\/apps\/[^/]+\/(\d+)\/([^/?#]+)/);
    if (match) {
      return `${match[1]}--${match[2]}`;
    }
    // Fallback: last path segment
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
    const match = url.match(/[?&]category=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return url;
  }
}
