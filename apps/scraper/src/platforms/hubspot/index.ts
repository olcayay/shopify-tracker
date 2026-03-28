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
import { hubspotUrls, CHIRP_HEADERS } from "./urls.js";
import { HUBSPOT_CONSTANTS, HUBSPOT_SCORING, HUBSPOT_PAGE_SIZE } from "./constants.js";
import { parseHubSpotAppDetails, extractOfferingId } from "./parsers/app-parser.js";
import { parseHubSpotCategoryPage } from "./parsers/category-parser.js";
import { parseHubSpotSearchPage } from "./parsers/search-parser.js";
import { parseHubSpotReviewPage } from "./parsers/review-parser.js";
import { parseHubSpotFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("hubspot");

/**
 * HubSpot App Marketplace platform module.
 *
 * Uses CHIRP RPC API (HubSpot's internal gateway) for all data fetching.
 * The marketplace is a pure SPA that doesn't render in headless browsers
 * (CDN blocks JS bundles), so we bypass the frontend entirely.
 *
 * CHIRP API endpoints:
 * - PersonalizationPublicRpc/search → paginated app listing
 * - MarketplaceListingDetailsRpc/getListingDetailsV3 → app details
 * - CollectionsPublicRpc/getCollections → featured collections
 * - PersonalizationPublicRpc/getSuggestionSections → homepage sections
 *
 * Limitations:
 * - No server-side keyword/category filtering (client-side text matching)
 *
 * Reviews use the Ecosystem public API (not CHIRP):
 * - POST /api/ecosystem/public/v1/reviews/search (individual reviews)
 * - Requires offeringId (resolved from CHIRP appDetail, cached per slug)
 */
export class HubSpotModule implements PlatformModule {
  readonly platformId = "hubspot" as const;
  readonly constants: PlatformConstants = HUBSPOT_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = HUBSPOT_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true, // Via Ecosystem public API
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: true, // Available via firstPublishedAt in listing details
    hasFlatCategories: false,
  };

  private httpClient?: HttpClient;
  private browserClient?: BrowserClient;
  tracker?: FallbackTracker;
  private offeringIdCache = new Map<string, number>();

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker) {
    this.httpClient = httpClient;
    this.browserClient = browserClient;
    this.tracker = tracker;
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

  // --- CHIRP API helper ---

  private async chirpPost(url: string, body: Record<string, unknown>): Promise<string> {
    if (!this.httpClient) {
      throw new Error("HttpClient required for HubSpot CHIRP API calls");
    }
    return this.httpClient.fetchRaw(url, {
      method: "POST",
      headers: CHIRP_HEADERS,
      body: JSON.stringify(body),
    });
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    log.info("fetching app via CHIRP API", { slug });
    const url = hubspotUrls.chirp.appDetail();
    const body = { language: "EN", slug };
    return withFallback(
      () => this.chirpPost(url, body),
      () => this.chirpViaBrowser(url, body),
      `hubspot/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const pageNum = page ?? 1;
    const offset = (pageNum - 1) * HUBSPOT_PAGE_SIZE;
    log.info("fetching category via CHIRP search API", { slug, page: pageNum, offset });
    const url = hubspotUrls.chirp.search();
    const body = { language: "EN", offset, limit: HUBSPOT_PAGE_SIZE };
    return withFallback(
      () => this.chirpPost(url, body),
      () => this.chirpViaBrowser(url, body),
      `hubspot/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  async fetchSearchPage(keyword: string): Promise<string | null> {
    log.info("fetching search via CHIRP search API", { keyword });
    const url = hubspotUrls.chirp.search();
    const body = { language: "EN", offset: 0, limit: 500 };
    return withFallback(
      () => this.chirpPost(url, body),
      () => this.chirpViaBrowser(url, body),
      `hubspot/fetchSearchPage/${keyword}`,
      this.tracker,
    );
  }

  async fetchReviewPage(slug: string, page?: number): Promise<string | null> {
    const pageNum = page ?? 1;
    const offeringId = await this.resolveOfferingId(slug);
    if (offeringId === null) {
      log.warn("could not resolve offeringId, returning empty reviews", { slug });
      return JSON.stringify({ reviews: [], total: 0 });
    }

    const offset = (pageNum - 1) * HUBSPOT_PAGE_SIZE;
    log.info("fetching reviews via ecosystem API", { slug, offeringId, page: pageNum, offset });

    const url = hubspotUrls.ecosystem.reviewSearch();
    const body = {
      entityId: offeringId,
      reviewTypes: ["APP"],
      limit: HUBSPOT_PAGE_SIZE,
      offset,
      sortFields: ["NEWEST"],
    };
    return withFallback(
      () => this.ecosystemPost(url, body),
      () => this.chirpViaBrowser(url, body),
      `hubspot/fetchReviewPage/${slug}`,
      this.tracker,
    );
  }

  // --- Ecosystem API helper ---

  private async ecosystemPost(url: string, body: Record<string, unknown>): Promise<string> {
    if (!this.httpClient) {
      throw new Error("HttpClient required for HubSpot ecosystem API calls");
    }
    return this.httpClient.fetchRaw(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: "https://ecosystem.hubspot.com/",
      },
      body: JSON.stringify(body),
    });
  }

  // --- Offering ID resolution ---

  private async resolveOfferingId(slug: string): Promise<number | null> {
    const cached = this.offeringIdCache.get(slug);
    if (cached !== undefined) return cached;

    log.info("resolving offeringId via CHIRP appDetail", { slug });
    const json = await this.chirpPost(hubspotUrls.chirp.appDetail(), {
      language: "EN",
      slug,
    });

    const offeringId = extractOfferingId(json);
    if (offeringId !== null) {
      this.offeringIdCache.set(slug, offeringId);
    }
    return offeringId;
  }

  // --- Parse ---

  parseAppDetails(json: string, slug: string): NormalizedAppDetails {
    return parseHubSpotAppDetails(json, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseHubSpotCategoryPage(json, slug, url);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    return parseHubSpotSearchPage(json, keyword, page);
  }

  parseReviewPage(json: string, page: number): NormalizedReviewPage {
    return parseHubSpotReviewPage(json, page);
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    log.info("fetching featured sections via CHIRP API");

    // Fetch collections and suggestions in parallel
    const [collectionsJson, suggestionsJson] = await Promise.all([
      this.chirpPost(hubspotUrls.chirp.collections(), {
        productType: "APP",
        locale: "EN",
        published: true,
      }),
      this.chirpPost(hubspotUrls.chirp.suggestions(), {
        language: "EN",
        productTypes: ["APP"],
        maximumSections: 10,
        maximumSectionCardCount: 20,
        minimumSectionCardCount: 3,
      }),
    ]);

    // Combine into a single JSON envelope for the parser
    const collections = JSON.parse(collectionsJson)?.data?.collections ?? [];
    const suggestions = JSON.parse(suggestionsJson)?.data?.sections ?? [];

    return parseHubSpotFeaturedSections(JSON.stringify({ collections, suggestions }));
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

  // --- Browser fallback ---

  /**
   * Call CHIRP API from browser context via page.evaluate().
   * Bypasses IP/UA blocks since the request originates from a real browser.
   */
  private async chirpViaBrowser(url: string, body: Record<string, unknown>): Promise<string> {
    if (!this.browserClient) {
      throw new Error("BrowserClient required for HubSpot CHIRP browser fallback");
    }
    log.info("calling CHIRP via browser context (fallback)", { url });
    return this.browserClient.withPage(
      "https://app.hubspot.com/marketplace",
      async (page) => {
        const result = await page.evaluate(
          async ({ url, body, headers }) => {
            const res = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
            });
            return res.text();
          },
          { url, body, headers: CHIRP_HEADERS },
        );
        return result;
      },
      { waitUntil: "domcontentloaded", extraWaitMs: 3000 },
    );
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
