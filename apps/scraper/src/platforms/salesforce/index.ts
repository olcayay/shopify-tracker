import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import type { BrowserClient } from "../../browser-client.js";
import { salesforceUrls } from "./urls.js";
import { SALESFORCE_CONSTANTS, SALESFORCE_SCORING } from "./constants.js";
import { parseSalesforceSearchPage } from "./parsers/search-parser.js";
import { parseSalesforceCategoryPage } from "./parsers/category-parser.js";
import { parseSalesforceAppPage } from "./parsers/app-parser.js";

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
  };

  private httpClient: HttpClient;
  private browserClient?: BrowserClient;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient) {
    this.httpClient = httpClient || new HttpClient();
    this.browserClient = browserClient;
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
    if (this.browserClient) {
      return this.browserClient.fetchPage(salesforceUrls.app(slug));
    }
    // Fallback to HTTP (will likely return empty SPA shell)
    return this.httpClient.fetchPage(salesforceUrls.app(slug));
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const p = page ?? 1;
    const sponsoredCount = p === 1 ? 4 : undefined;
    return this.httpClient.fetchPage(
      salesforceUrls.categoryApi(slug, p, sponsoredCount),
      { Accept: "application/json" }
    );
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    const p = page ?? 1;
    const sponsoredCount = p === 1 ? 4 : undefined;
    return this.httpClient.fetchPage(
      salesforceUrls.searchApi(keyword, p, sponsoredCount),
      { Accept: "application/json" }
    );
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseSalesforceAppPage(html, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    // Extract category slug from URL or use the url as-is
    const categorySlug = this.extractCategorySlugFromUrl(url);
    return parseSalesforceCategoryPage(json, categorySlug, 1, 0);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    offset: number
  ): NormalizedSearchPage {
    return parseSalesforceSearchPage(json, keyword, page, offset);
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
