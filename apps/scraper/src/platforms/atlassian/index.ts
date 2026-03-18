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
import { HttpClient } from "../../http-client.js";
import { atlassianUrls } from "./urls.js";
import { ATLASSIAN_CONSTANTS, ATLASSIAN_SCORING, ATLASSIAN_FEATURED_SECTIONS } from "./constants.js";
import { parseAddonDetails, parseSearchResults } from "./parsers/api-parser.js";
import { parseAtlassianCategoryPage } from "./parsers/category-parser.js";
import { parseAtlassianReviewPage } from "./parsers/review-parser.js";
import { parseAtlassianFeaturedSections } from "./parsers/featured-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("atlassian");

/**
 * Atlassian Marketplace platform module.
 *
 * Key architectural notes:
 * - REST API v2 for app details, search, reviews, featured collections (JSON)
 * - HTML scraping (window.__INITIAL_STATE__ Apollo cache) for category pages
 * - No browser/Playwright needed — HttpClient only
 * - App identifier: addonKey (e.g. com.onresolve.jira.groovy.groovyrunner)
 * - API deprecated Jan 2026, removal after June 2026
 */
export class AtlassianModule implements PlatformModule {
  readonly platformId = "atlassian" as const;
  readonly constants: PlatformConstants = ATLASSIAN_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = ATLASSIAN_SCORING;

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

  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient();
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return atlassianUrls.app(slug);
  }

  buildCategoryUrl(slug: string, _page?: number): string {
    return atlassianUrls.category(slug);
  }

  buildSearchUrl(keyword: string, _page?: number): string {
    return atlassianUrls.search(keyword);
  }

  buildReviewUrl(slug: string, _page?: number): string {
    return atlassianUrls.apiReviews(slug);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    const addonUrl = atlassianUrls.apiAddon(slug);
    const versionUrl = atlassianUrls.apiVersionLatest(slug);
    log.info("fetching addon via API (multi-endpoint)", { slug });

    // Fetch addon + version in parallel
    const [addonJson, versionJson] = await Promise.all([
      this.httpClient.fetchPage(addonUrl),
      this.httpClient.fetchPage(versionUrl).catch(() => null),
    ]);

    // Extract vendorId from addon JSON to fetch vendor details
    const addon = JSON.parse(addonJson);
    const vendorHref = addon._embedded?.vendor?._links?.self?.href;
    const vendorId = vendorHref?.match(/\/vendors\/(\d+)/)?.[1];

    // Fetch vendor + pricing in parallel
    const [vendorJson, pricingJson] = await Promise.all([
      vendorId ? this.httpClient.fetchPage(atlassianUrls.apiVendor(vendorId)).catch(() => null) : null,
      this.httpClient.fetchPage(atlassianUrls.apiPricing(slug)).catch(() => null),
    ]);

    // Return combined JSON envelope
    return JSON.stringify({
      addon,
      version: versionJson ? JSON.parse(versionJson) : null,
      vendor: vendorJson ? JSON.parse(vendorJson) : null,
      pricing: pricingJson ? JSON.parse(pricingJson) : null,
    });
  }

  async fetchCategoryPage(slug: string, _page?: number): Promise<string> {
    const url = atlassianUrls.category(slug);
    log.info("fetching category page (HTML)", { slug, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    const pageSize = 50;
    const offset = ((page ?? 1) - 1) * pageSize;
    const url = atlassianUrls.apiSearch(keyword, offset, pageSize);
    log.info("fetching search results via API", { keyword, page, offset, url });
    return this.httpClient.fetchPage(url);
  }

  async fetchReviewPage(slug: string, page?: number): Promise<string | null> {
    const pageSize = 50;
    const offset = ((page ?? 1) - 1) * pageSize;
    const url = atlassianUrls.apiReviews(slug, offset, pageSize);
    log.info("fetching reviews via API", { slug, page, offset, url });
    return this.httpClient.fetchPage(url);
  }

  /**
   * Fetch all featured collection responses.
   * Returns a JSON string containing all featured sections.
   */
  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const responses = new Map<string, Record<string, any>>();

    for (const config of ATLASSIAN_FEATURED_SECTIONS) {
      try {
        const url = atlassianUrls.apiFeatured(config.marketingLabel);
        log.info("fetching featured section", { label: config.marketingLabel, url });
        const json = await this.httpClient.fetchPage(url);
        responses.set(config.marketingLabel, JSON.parse(json));
      } catch (err) {
        log.warn("failed to fetch featured section", {
          label: config.marketingLabel,
          error: String(err),
        });
      }
    }

    return parseAtlassianFeaturedSections(responses);
  }

  // --- Parse ---

  parseAppDetails(json: string, _slug: string): NormalizedAppDetails {
    const envelope = JSON.parse(json);
    return parseAddonDetails(envelope.addon, envelope.version, envelope.vendor, envelope.pricing);
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const slug = this.extractCategorySlugFromUrl(url);
    return parseAtlassianCategoryPage(html, slug);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
    offset: number,
  ): NormalizedSearchPage {
    const data = JSON.parse(json);
    return parseSearchResults(data, keyword, page, offset);
  }

  parseReviewPage(json: string, page: number): NormalizedReviewPage {
    const data = JSON.parse(json);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    return parseAtlassianReviewPage(data, page, offset);
  }

  parseFeaturedSections(_html: string): NormalizedFeaturedSection[] {
    // Featured sections are fetched via API, not parsed from HTML.
    // This method is not used — use fetchFeaturedSections() instead.
    return [];
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // Match /apps/{numericId}/{slug} or just /apps/{slug}
    const match = url.match(/\/apps\/(?:\d+\/)?([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const cats = platformData.categories as Array<{ slug?: string; key?: string }> | undefined;
    if (!Array.isArray(cats)) return [];
    return cats.map((c) => c.slug || c.key).filter((s): s is string => !!s);
  }

  // --- Private helpers ---

  private extractCategorySlugFromUrl(url: string): string {
    const match = url.match(/\/categories\/([^/?]+)/);
    return match?.[1] || url.split("/").pop()?.split("?")[0] || url;
  }
}
