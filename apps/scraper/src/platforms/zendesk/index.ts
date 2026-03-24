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
import { zendeskUrls } from "./urls.js";
import { ZENDESK_CONSTANTS, ZENDESK_SCORING, ZENDESK_CATEGORY_NAMES, ZENDESK_ALGOLIA } from "./constants.js";
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
 * - Categories & search use Algolia API directly (no browser needed)
 * - App detail pages still use BrowserClient (Cloudflare blocks HTTP)
 * - App URL: /marketplace/apps/{product}/{numericId}/{text-slug}/
 * - Slug format: {numericId}--{text-slug}
 * - Product type (support/sell/chat) stored in externalId for URL reconstruction
 * - 16 flat categories, no hierarchy
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

  private httpClient?: HttpClient;
  private browserClient?: BrowserClient;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
    this.httpClient = httpClient;
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

  // --- Fetch ---

  /** App detail pages still need BrowserClient (Cloudflare blocks HTTP). */
  async fetchAppPage(slug: string): Promise<string> {
    const url = zendeskUrls.app(slug);
    log.info("fetching app page via browser", { slug, url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk app pages (Cloudflare protection)");
    }
    return this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 3000,
    });
  }

  /**
   * Fetch category listing via Algolia API — no browser needed.
   * Returns raw Algolia JSON response string.
   * Page is 1-indexed (converted to 0-indexed for Algolia).
   */
  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const displayName = ZENDESK_CATEGORY_NAMES[slug] || slug;
    const algoliaPage = (page ?? 1) - 1; // Algolia uses 0-indexed pages
    log.info("fetching category via Algolia", { slug, displayName, page: page ?? 1, algoliaPage });

    return this.algoliaQuery({
      facetFilters: [[`categories.name:${displayName}`]],
      hitsPerPage: 24,
      page: algoliaPage,
    });
  }

  /**
   * Fetch keyword search via Algolia API — no browser needed.
   * Returns raw Algolia JSON response string.
   */
  async fetchSearchPage(keyword: string): Promise<string | null> {
    log.info("fetching search via Algolia", { keyword });
    return this.algoliaQuery({
      query: keyword,
      hitsPerPage: 24,
      page: 0,
    });
  }

  async fetchReviewPage(slug: string): Promise<string | null> {
    // Reviews are on the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseZendeskAppDetails(html, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseZendeskCategoryPage(json, slug, url);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    return parseZendeskSearchPage(json, keyword, page);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseZendeskReviewPage(html, page);
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const url = zendeskUrls.homepage();
    log.info("fetching featured sections from homepage", { url });
    if (!this.browserClient) {
      throw new Error("BrowserClient required for Zendesk featured sections");
    }
    const html = await this.browserClient.fetchPage(url, {
      waitUntil: "domcontentloaded",
      extraWaitMs: 5000,
    });
    return parseZendeskFeaturedSections(html);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/marketplace\/apps\/[^/]+\/(\d+)\/([^/?#]+)/);
    if (match) {
      return `${match[1]}--${match[2]}`;
    }
    return url.split("/").filter(Boolean).pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const cats = platformData.categories as Array<{ slug?: string }> | undefined;
    if (!Array.isArray(cats)) return [];
    return cats.map((c) => c.slug).filter((s): s is string => !!s);
  }

  // --- Private helpers ---

  /**
   * Make a direct Algolia API query (no browser, no Cloudflare issues).
   * Returns the raw JSON string.
   */
  private async algoliaQuery(params: {
    query?: string;
    facetFilters?: string[][];
    hitsPerPage?: number;
    page?: number;
  }): Promise<string> {
    const urlParams = new URLSearchParams();
    if (params.query) urlParams.set("query", params.query);
    if (params.facetFilters) urlParams.set("facetFilters", JSON.stringify(params.facetFilters));
    if (params.hitsPerPage) urlParams.set("hitsPerPage", String(params.hitsPerPage));
    if (params.page != null) urlParams.set("page", String(params.page));
    urlParams.set("clickAnalytics", "true");
    urlParams.set("facets", JSON.stringify(["categories.name", "collections.name", "products", "searchable_plan_pricings", "searchable_rating"]));

    const body = JSON.stringify({
      requests: [{
        indexName: ZENDESK_ALGOLIA.indexName,
        params: urlParams.toString(),
      }],
    });

    const url = `${ZENDESK_ALGOLIA.baseUrl}?x-algolia-api-key=${ZENDESK_ALGOLIA.apiKey}&x-algolia-application-id=${ZENDESK_ALGOLIA.appId}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://www.zendesk.com/",
      },
      body,
    });

    if (!resp.ok) {
      throw new Error(`Algolia API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.text();
  }

  private extractCategorySlugFromUrl(url: string): string {
    // URL format: ?categories.name=AI+and+Bots → reverse-map to slug
    const match = url.match(/[?&]categories\.name=([^&]+)/);
    if (match) {
      const displayName = decodeURIComponent(match[1].replace(/\+/g, " "));
      const reverseMap = Object.entries(ZENDESK_CATEGORY_NAMES);
      const entry = reverseMap.find(([, name]) => name === displayName);
      if (entry) return entry[0];
      return displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    const legacyMatch = url.match(/[?&]category=([^&]+)/);
    if (legacyMatch) return decodeURIComponent(legacyMatch[1]);
    return url;
  }
}
