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
import { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { withFallback } from "../../utils/with-fallback.js";
import type { FallbackTracker } from "../../utils/fallback-tracker.js";
import { salesforceUrls } from "./urls.js";
import { SALESFORCE_CONSTANTS, SALESFORCE_SCORING, SALESFORCE_API_HEADERS, SALESFORCE_CATEGORY_CHILDREN } from "./constants.js";
import { parseSalesforceSearchPage } from "./parsers/search-parser.js";
import { parseSalesforceCategoryPage } from "./parsers/category-parser.js";
import { parseSalesforceAppPage } from "./parsers/app-parser.js";
import { parseSalesforceReviewPage } from "./parsers/review-parser.js";
import { parseAppFromSearchResult } from "./parsers/search-app-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("salesforce");

export class SalesforceModule implements PlatformModule {
  readonly platformId = "salesforce" as const;
  readonly constants: PlatformConstants = SALESFORCE_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = SALESFORCE_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: true,
    hasSimilarApps: true,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: false,
    hasFlatCategories: false,
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
    return salesforceUrls.app(slug);
  }

  buildCategoryUrl(slug: string, page?: number): string {
    return salesforceUrls.category(slug);
  }

  buildSearchUrl(keyword: string, page?: number): string {
    // sponsoredCount=4 only on first page
    const sponsoredCount = (!page || page === 1) ? 4 : undefined;
    return salesforceUrls.searchApi(keyword, page, sponsoredCount);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    return withFallback(
      async () => {
        if (!this.browserClient) throw new Error("BrowserClient required for Salesforce app pages (SPA)");
        log.info("fetching app page via browser", { slug });
        return this.browserClient.fetchPage(salesforceUrls.app(slug));
      },
      async () => {
        // Fallback: search API with the slug as keyword to find the card
        log.info("fetching app via search API (fallback)", { slug });
        const json = await this.httpClient.fetchPage(
          salesforceUrls.searchApi(slug, 1),
          { ...SALESFORCE_API_HEADERS },
        );
        const data = JSON.parse(json);
        const items = data.items || data.results || [];
        const card = items.find((item: any) => item.oafId === slug) || items[0];
        if (!card) throw new Error(`Salesforce app not found via search API: ${slug}`);
        const parsed = parseAppFromSearchResult(card, slug);
        return JSON.stringify({ _fromSearch: true, _parsed: parsed });
      },
      `salesforce/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    return withFallback(
      () => {
        const p = page ?? 1;
        const sponsoredCount = p === 1 ? 4 : undefined;
        log.info("fetching category page via API", { slug, page: p });
        return this.httpClient.fetchPage(
          salesforceUrls.categoryApi(slug, p, sponsoredCount),
          { ...SALESFORCE_API_HEADERS },
        );
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for salesforce fallback");
        const url = salesforceUrls.category(slug);
        log.info("fetching category page via browser (fallback)", { slug, url });
        return this.browserClient.fetchPage(url);
      },
      `salesforce/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    return withFallback(
      () => {
        const p = page ?? 1;
        const sponsoredCount = p === 1 ? 4 : undefined;
        log.info("fetching search results via API", { keyword, page: p });
        return this.httpClient.fetchPage(
          salesforceUrls.searchApi(keyword, p, sponsoredCount),
          { ...SALESFORCE_API_HEADERS },
        );
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for salesforce fallback");
        const url = `${salesforceUrls.base}/results?keywords=${encodeURIComponent(keyword)}`;
        log.info("fetching search page via browser (fallback)", { keyword, url });
        return this.browserClient!.fetchPage(url);
      },
      `salesforce/fetchSearchPage/${keyword}`,
      this.tracker,
    );
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    // Check if this is a pre-parsed search API fallback envelope
    try {
      const envelope = JSON.parse(html);
      if (envelope._fromSearch && envelope._parsed) return envelope._parsed;
    } catch {
      // Not JSON — it's HTML, proceed with normal parsing
    }
    return parseSalesforceAppPage(html, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    // Extract category slug from URL or use the url as-is
    const categorySlug = this.extractCategorySlugFromUrl(url);
    const result = parseSalesforceCategoryPage(json, categorySlug, 1, 0);

    // Inject known children as subcategoryLinks so the crawler recurses into them
    const children = SALESFORCE_CATEGORY_CHILDREN[categorySlug];
    if (children) {
      result.subcategoryLinks = children.map((slug) => ({
        slug,
        url: salesforceUrls.category(slug),
        title: slug.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim(),
      }));
    }

    return result;
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    offset: number
  ): NormalizedSearchPage {
    return parseSalesforceSearchPage(json, keyword, page, offset);
  }

  // --- Reviews (API-based) ---

  buildReviewUrl(slug: string, page?: number): string {
    return salesforceUrls.reviewApi(slug, page);
  }

  async fetchReviewPage(slug: string, page?: number): Promise<string | null> {
    return withFallback(
      () => {
        log.info("fetching reviews via API", { slug, page });
        return this.httpClient.fetchPage(
          salesforceUrls.reviewApi(slug, page ?? 1),
          { Accept: "application/json" },
        );
      },
      async () => {
        // Fallback: fetch app page via browser (reviews are embedded in SPA)
        if (!this.browserClient) throw new Error("no browserClient for salesforce review fallback");
        log.info("fetching app page for reviews via browser (fallback)", { slug });
        return this.browserClient.fetchPage(salesforceUrls.app(slug));
      },
      `salesforce/fetchReviewPage/${slug}`,
      this.tracker,
    );
  }

  parseReviewPage(json: string, page: number): NormalizedReviewPage {
    return parseSalesforceReviewPage(json, page);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // Extract listingId from URL like: ...?listingId=a0N3A00000EOBliUAH
    const match = url.match(/[?&]listingId=([^&]+)/);
    if (match) return match[1];
    // Fallback: try to use the last path segment
    return url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const categories = platformData.listingCategories as string[] | undefined;
    return categories || [];
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    // From API URL: ...&category=marketing
    const match = url.match(/[?&]category=([^&]+)/);
    if (match) return match[1];
    // From display URL: ...?category=marketing
    return url.split("/").pop()?.split("?")[0] || url;
  }
}
