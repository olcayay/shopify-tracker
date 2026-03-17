import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  PlatformConstants,
  PlatformScoringConfig,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedReviewPage,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import { wordpressUrls } from "./urls.js";
import { WORDPRESS_CONSTANTS, WORDPRESS_SCORING, BROWSE_PREFIX } from "./constants.js";
import { parsePluginInfo, parseSearchResults, parseTagResults } from "./parsers/api-parser.js";
import { parseWordPressReviewPage } from "./parsers/review-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("wordpress");

export class WordPressModule implements PlatformModule {
  readonly platformId = "wordpress" as const;
  readonly constants: PlatformConstants = WORDPRESS_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = WORDPRESS_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: true,
  };

  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient();
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return wordpressUrls.plugin(slug);
  }

  buildCategoryUrl(slug: string, page?: number): string {
    return wordpressUrls.categoryPage(slug);
  }

  buildSearchUrl(keyword: string, page?: number): string {
    return wordpressUrls.search(keyword);
  }

  buildReviewUrl(slug: string, page?: number): string {
    return wordpressUrls.reviews(slug, page);
  }

  // --- Fetch (API-first approach: returns JSON strings for app/category/search) ---

  async fetchAppPage(slug: string): Promise<string> {
    const url = wordpressUrls.apiPlugin(slug);
    log.info("fetching plugin info via API", { slug, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const url = wordpressUrls.apiCategory(slug, page ?? 1);
    const isBrowse = slug.startsWith(BROWSE_PREFIX);
    log.info(isBrowse ? "fetching browse page via API" : "fetching tag page via API", { slug, page, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    const url = wordpressUrls.apiSearch(keyword, page ?? 1);
    log.info("fetching search results via API", { keyword, page, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchReviewPage(slug: string, page?: number): Promise<string | null> {
    const url = wordpressUrls.reviews(slug, page ?? 1);
    log.info("fetching review page (HTML)", { slug, page, url });
    return this.httpClient.fetchPage(url);
  }

  // --- Parse ---

  parseAppDetails(json: string, slug: string): NormalizedAppDetails {
    const data = JSON.parse(json);
    return parsePluginInfo(data);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const data = JSON.parse(json);
    // Extract slug: browse URLs have /browse/<type>/ or browse=<type>
    const browseMatch = url.match(/\/browse\/([^/?]+)/) || url.match(/[?&]browse=([^&]+)/);
    const tagSlug = browseMatch
      ? `${BROWSE_PREFIX}${browseMatch[1]}`
      : this.extractTagSlugFromUrl(url);
    return parseTagResults(data, tagSlug);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    _offset: number,
  ): NormalizedSearchPage {
    const data = JSON.parse(json);
    return parseSearchResults(data, keyword, page);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseWordPressReviewPage(html, page);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/plugins\/([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const tags = platformData.tags as Record<string, string> | undefined;
    if (!tags || typeof tags !== "object") return [];
    return Object.keys(tags);
  }

  // --- Private helpers ---

  private extractTagSlugFromUrl(url: string): string {
    const match = url.match(/\/tags\/([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }
}
