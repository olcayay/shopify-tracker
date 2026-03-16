import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedFeaturedSection,
  NormalizedSearchPage,
  NormalizedReviewPage,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import { wixUrls } from "./urls.js";
import { WIX_CONSTANTS, WIX_SCORING } from "./constants.js";
import { parseWixAppPage, parseWixReviewPage } from "./parsers/app-parser.js";
import { parseWixCategoryPage } from "./parsers/category-parser.js";
import { parseWixSearchPage } from "./parsers/search-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("wix-module");

/**
 * Wix App Market platform module.
 *
 * Key architectural notes:
 * - HTTP-only (no browser needed) — no Cloudflare protection
 * - App data is embedded as base64-encoded JSON in __REACT_QUERY_STATE__
 * - Autocomplete API is anonymous and requires no auth
 * - All apps per category/search are loaded on a single page
 */
export class WixModule implements PlatformModule {
  readonly platformId = "wix" as const;
  readonly constants: PlatformConstants = WIX_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = WIX_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
  };

  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient();
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return wixUrls.app(slug);
  }

  buildCategoryUrl(slug: string, _page?: number): string {
    return wixUrls.category(slug);
  }

  buildSearchUrl(keyword: string, _page?: number): string {
    return wixUrls.search(keyword);
  }

  buildReviewUrl(slug: string, _page?: number): string {
    // Reviews are embedded in the app detail page
    return wixUrls.app(slug);
  }

  buildAutoSuggestUrl(keyword: string): string {
    return wixUrls.autocomplete(keyword);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    const url = wixUrls.app(slug);
    log.info("fetching app detail page", { slug, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchCategoryPage(slug: string, _page?: number): Promise<string> {
    const url = wixUrls.category(slug);
    log.info("fetching category page", { slug, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchSearchPage(keyword: string, _page?: number): Promise<string | null> {
    const url = wixUrls.search(keyword);
    log.info("fetching search page", { keyword, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchReviewPage(slug: string, _page?: number): Promise<string | null> {
    // Reviews are embedded in the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    return parseWixAppPage(html, slug);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const categorySlug = this.extractCategorySlugFromUrl(url);
    return parseWixCategoryPage(html, categorySlug, 1, 0);
  }

  parseSearchPage(
    html: string,
    keyword: string,
    page: number,
    offset: number,
  ): NormalizedSearchPage {
    return parseWixSearchPage(html, keyword, page, offset);
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    return parseWixReviewPage(html, page);
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    const match = url.match(/\/web-solution\/([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Auto-suggest (anonymous API) ---

  async generateSuggestions(keyword: string): Promise<string[]> {
    const url = wixUrls.autocomplete(keyword);
    log.info("fetching autocomplete suggestions", { keyword });

    try {
      const response = await this.httpClient.fetchPage(url);
      const data = JSON.parse(response);

      // The autocomplete API returns { autocomplete: ["form", "forms", ...], suggestions: [...apps...] }
      const suggestions: string[] = [];
      if (data.autocomplete && Array.isArray(data.autocomplete)) {
        for (const kw of data.autocomplete) {
          if (typeof kw === "string") {
            suggestions.push(kw);
          }
        }
      }

      log.info("autocomplete suggestions", { keyword, count: suggestions.length });
      return suggestions;
    } catch (e) {
      log.error("autocomplete failed", { keyword, error: String(e) });
      return [];
    }
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const categories = platformData.categories as
      | Array<{ slug?: string; parentSlug?: string }>
      | undefined;
    if (!categories) return [];
    return categories
      .map((c) => c.slug || "")
      .filter(Boolean);
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    // Match /category/{parent}/{child} or /category/{slug}
    const match = url.match(/\/category\/([^/?]+)(?:\/([^/?]+))?/);
    if (match) {
      return match[2] ? `${match[1]}--${match[2]}` : match[1];
    }
    return url.split("/").pop()?.split("?")[0] || url;
  }
}
