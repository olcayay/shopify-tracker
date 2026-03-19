import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  PlatformConstants,
  PlatformScoringConfig,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedFeaturedSection,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import { zoomUrls } from "./urls.js";
import { ZOOM_CONSTANTS, ZOOM_SCORING } from "./constants.js";
import { parseZoomApp } from "./parsers/app-parser.js";
import { parseZoomCategoryPage } from "./parsers/category-parser.js";
import { parseZoomSearchPage } from "./parsers/search-parser.js";
import { parseZoomFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("zoom");

/** Zoom API requires Accept: application/json, otherwise returns HTML */
const JSON_HEADERS = { Accept: "application/json" };

/**
 * Zoom App Marketplace platform module.
 *
 * Key architectural notes:
 * - Public JSON API for categories, search, and featured sections
 * - App detail API (/api/v1/apps/{id}) requires auth — use filter/search data instead
 * - Individual reviews require auth — hasReviews: false
 * - Pricing requires auth — hasPricing: false
 * - No browser/Playwright needed — HttpClient only
 * - App identifier: base64-like string (e.g. VG_p3Bb_TwWe_bgZmPUaXw)
 */
export class ZoomModule implements PlatformModule {
  readonly platformId = "zoom" as const;
  readonly constants: PlatformConstants = ZOOM_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = ZOOM_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: false,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: false,
  };

  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient();
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return zoomUrls.app(slug);
  }

  buildCategoryUrl(slug: string): string {
    return zoomUrls.category(slug);
  }

  buildSearchUrl(keyword: string, _page?: number): string {
    return zoomUrls.search(keyword);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    // Individual app API requires auth. Search for the app by ID via filter.
    // The app data is typically already collected during category/keyword scraping.
    // As a fallback, search all categories for this app ID.
    log.info("fetching app via search API (app detail API requires auth)", { slug });
    const searchUrl = zoomUrls.apiSearch(slug, 1, 10);
    const json = await this.httpClient.fetchPage(searchUrl, JSON_HEADERS);
    const data = JSON.parse(json);
    const apps = data.apps || [];

    // Try to find exact match by ID
    const match = apps.find((a: any) => a.id === slug);
    if (match) {
      return JSON.stringify(match);
    }

    // Return first result or empty object
    if (apps.length > 0) {
      return JSON.stringify(apps[0]);
    }

    throw new Error(`Zoom app not found: ${slug}`);
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    const p = page ?? 1;
    const url = zoomUrls.apiFilter(slug, p, 100);
    log.info("fetching category page via API", { slug, page: p, url });
    return this.httpClient.fetchPage(url, JSON_HEADERS);
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    const p = page ?? 1;
    const url = zoomUrls.apiSearch(keyword, p, 100);
    log.info("fetching search results via API", { keyword, page: p, url });
    return this.httpClient.fetchPage(url, JSON_HEADERS);
  }

  /**
   * Fetch all featured/curated collection data.
   * Uses a single API call to get all curated sections with preview apps.
   */
  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const url = zoomUrls.apiFeaturedPreview();
    log.info("fetching featured sections", { url });
    try {
      const json = await this.httpClient.fetchPage(url, JSON_HEADERS);
      const data = JSON.parse(json);
      return parseZoomFeaturedSections(data);
    } catch (err) {
      log.warn("failed to fetch featured sections", { error: String(err) });
      return [];
    }
  }

  // --- Parse ---

  parseAppDetails(json: string, _slug: string): NormalizedAppDetails {
    const app = JSON.parse(json);
    return parseZoomApp(app);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    const data = JSON.parse(json);
    const page = data.pageNum || 1;
    return parseZoomCategoryPage(data, slug, page);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    _offset: number,
  ): NormalizedSearchPage {
    const data = JSON.parse(json);
    return parseZoomSearchPage(data, keyword, page);
  }

  parseFeaturedSections(_html: string): NormalizedFeaturedSection[] {
    // Featured sections are fetched via API, not parsed from HTML.
    // This method is not used — use fetchFeaturedSections() instead.
    return [];
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // Match /apps/{slug}
    const match = url.match(/\/apps\/([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const cats = platformData.categories as Array<{ slug?: string }> | undefined;
    if (!Array.isArray(cats)) return [];
    return cats.map((c) => c.slug).filter((s): s is string => !!s);
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    // Match ?category={slug} or apiFilter URL
    const catMatch = url.match(/[?&]category=([^&]+)/);
    if (catMatch) return decodeURIComponent(catMatch[1]);
    // Fallback for API filter URLs
    const filterMatch = url.match(/\/filter\?category=([^&]+)/);
    return filterMatch ? decodeURIComponent(filterMatch[1]) : url;
  }
}
