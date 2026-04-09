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
import type { BrowserClient } from "../../browser-client.js";
import { withFallback } from "../../utils/with-fallback.js";
import type { FallbackTracker } from "../../utils/fallback-tracker.js";
import { zoomUrls } from "./urls.js";
import { ZOOM_CONSTANTS, ZOOM_SCORING } from "./constants.js";
import { parseZoomApp } from "./parsers/app-parser.js";
import { parseZoomCategoryPage } from "./parsers/category-parser.js";
import { parseZoomSearchPage } from "./parsers/search-parser.js";
import { parseZoomFeaturedSections } from "./parsers/featured-parser.js";
import { parseAppHtml, parseCategoryHtml, parseSearchHtml } from "./parsers/html-parser.js";
import { createLogger } from "@appranks/shared";
import { AppNotFoundError } from "../../utils/app-not-found-error.js";

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
    hasFlatCategories: true,
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
    return withFallback(
      () => this.fetchAppPageViaApi(slug),
      () => this.fetchAppPageViaBrowser(slug),
      `zoom/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  private async fetchAppPageViaApi(slug: string): Promise<string> {
    // Individual app API requires auth. The filter API without a category
    // returns ALL apps with pagination — paginate until we find the target.
    log.info("fetching app via filter API pagination (app detail API requires auth)", { slug });

    const maxPages = 35; // safety limit (~3500 apps at 100/page)
    for (let page = 1; page <= maxPages; page++) {
      const url = zoomUrls.apiFilterAll(page, 100);
      const json = await this.httpClient.fetchPage(url, JSON_HEADERS);
      const data = JSON.parse(json);
      const apps: any[] = data.apps || [];

      const match = apps.find((a: any) => a.id === slug);
      if (match) {
        log.info("found app via filter API", { slug, page });
        return JSON.stringify(match);
      }

      // No more pages — stop early
      if (apps.length < 100) break;
    }

    throw new AppNotFoundError(slug, "zoom", "exhausted filter API pagination");
  }

  private async fetchAppPageViaBrowser(slug: string): Promise<string> {
    if (!this.browserClient) throw new Error("no browserClient for zoom fallback");
    const url = zoomUrls.app(slug);
    log.info("fetching app page via browser (fallback)", { slug, url });
    const html = await this.browserClient.fetchPage(url, { waitUntil: "networkidle" });
    const parsed = parseAppHtml(html, slug);
    return JSON.stringify({ _fromHtml: true, _parsed: parsed });
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    return withFallback(
      () => {
        const p = page ?? 1;
        const url = zoomUrls.apiFilter(slug, p, 100);
        log.info("fetching category page via API", { slug, page: p, url });
        return this.httpClient.fetchPage(url, JSON_HEADERS);
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for zoom fallback");
        const url = zoomUrls.category(slug);
        log.info("fetching category page via browser (fallback)", { slug, url });
        const html = await this.browserClient.fetchPage(url, { waitUntil: "networkidle" });
        const parsed = parseCategoryHtml(html, slug, page ?? 1);
        return JSON.stringify({ _fromHtml: true, _parsed: parsed });
      },
      `zoom/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    return withFallback(
      () => {
        const p = page ?? 1;
        const url = zoomUrls.apiSearch(keyword, p, 100);
        log.info("fetching search results via API", { keyword, page: p, url });
        return this.httpClient.fetchPage(url, JSON_HEADERS);
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for zoom fallback");
        const url = zoomUrls.search(keyword);
        log.info("fetching search page via browser (fallback)", { keyword, url });
        const html = await this.browserClient.fetchPage(url, {
          waitUntil: "domcontentloaded",
          waitForSelector: '[class*="marketplace"], [class*="app-card"], [class*="search-result"], a[href*="/marketplace/"]',
        });
        const parsed = parseSearchHtml(html, keyword, page ?? 1, 0);
        return JSON.stringify({ _fromHtml: true, _parsed: parsed });
      },
      `zoom/fetchSearchPage/${keyword}`,
      this.tracker,
    );
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
    const data = JSON.parse(json);
    if (data._fromHtml && data._parsed) return data._parsed;
    return parseZoomApp(data);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    const data = JSON.parse(json);
    if (data._fromHtml && data._parsed) return data._parsed;
    const slug = this.extractCategorySlugFromUrl(url);
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
    if (data._fromHtml && data._parsed) return data._parsed;
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
