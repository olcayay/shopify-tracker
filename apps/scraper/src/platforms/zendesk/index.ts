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
import { zendeskUrls } from "./urls.js";
import { ZENDESK_CONSTANTS, ZENDESK_SCORING, ZENDESK_CATEGORY_NAMES, ZENDESK_ALGOLIA } from "./constants.js";
import { parseZendeskAppDetails } from "./parsers/app-parser.js";
import { parseZendeskCategoryPage } from "./parsers/category-parser.js";
import { parseZendeskSearchPage } from "./parsers/search-parser.js";
import { parseZendeskReviewPage } from "./parsers/review-parser.js";
import { parseZendeskFeaturedSections } from "./parsers/featured-parser.js";
import { parseAppFromAlgolia } from "./parsers/algolia-app-parser.js";
import { parseCategoryHtml, parseSearchHtml } from "./parsers/html-parser.js";
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
    hasFlatCategories: true,
  };

  private httpClient?: HttpClient;
  private browserClient?: BrowserClient;
  tracker?: FallbackTracker;

  constructor(httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker) {
    this.httpClient = httpClient;
    this.browserClient = browserClient;
    this.tracker = tracker;
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

  /** App detail pages: primary = browser (Cloudflare), fallback = Algolia search by ID */
  async fetchAppPage(slug: string): Promise<string> {
    return withFallback(
      async () => {
        const url = zendeskUrls.app(slug);
        log.info("fetching app page via browser", { slug, url });
        if (!this.browserClient) {
          throw new Error("BrowserClient required for Zendesk app pages (Cloudflare protection)");
        }
        return this.browserClient.fetchPage(url, {
          waitUntil: "domcontentloaded",
          extraWaitMs: 3000,
        });
      },
      async () => {
        // Fallback: search Algolia by app name/ID to get basic data
        const numericId = slug.split("--")[0];
        log.info("fetching app via Algolia search (fallback)", { slug, numericId });
        const json = await this.algoliaQuery({
          query: numericId,
          hitsPerPage: 10,
          page: 0,
        });
        const data = JSON.parse(json);
        const hits = data.results?.[0]?.hits || [];
        const hit = hits.find((h: any) => String(h.id) === numericId) || hits[0];
        if (!hit) throw new Error(`Zendesk app not found via Algolia: ${slug}`);
        const parsed = parseAppFromAlgolia(hit, slug);
        return JSON.stringify({ _fromAlgolia: true, _parsed: parsed });
      },
      `zendesk/fetchAppPage/${slug}`,
      this.tracker,
    );
  }

  /**
   * Fetch category listing via Algolia API — no browser needed.
   * Fallback: browser render.
   */
  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    return withFallback(
      () => {
        const displayName = ZENDESK_CATEGORY_NAMES[slug] || slug;
        const algoliaPage = (page ?? 1) - 1;
        log.info("fetching category via Algolia", { slug, displayName, page: page ?? 1, algoliaPage });
        return this.algoliaQuery({
          facetFilters: [[`categories.name:${displayName}`]],
          hitsPerPage: 24,
          page: algoliaPage,
        });
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for zendesk fallback");
        const url = zendeskUrls.category(slug, page);
        log.info("fetching category page via browser (fallback)", { slug, url });
        const html = await this.browserClient.fetchPage(url, {
          waitUntil: "domcontentloaded",
          extraWaitMs: 5000,
        });
        // Pre-parse HTML and wrap in envelope (parseCategoryPage expects JSON)
        const parsed = parseCategoryHtml(html, slug);
        return JSON.stringify({ _fromHtml: true, _parsed: parsed });
      },
      `zendesk/fetchCategoryPage/${slug}`,
      this.tracker,
    );
  }

  /**
   * Fetch keyword search via Algolia API — no browser needed.
   * Fallback: browser render.
   */
  async fetchSearchPage(keyword: string): Promise<string | null> {
    return withFallback(
      () => {
        log.info("fetching search via Algolia", { keyword });
        return this.algoliaQuery({
          query: keyword,
          hitsPerPage: 24,
          page: 0,
        });
      },
      async () => {
        if (!this.browserClient) throw new Error("no browserClient for zendesk fallback");
        const url = zendeskUrls.search(keyword);
        log.info("fetching search page via browser (fallback)", { keyword, url });
        const html = await this.browserClient.fetchPage(url, {
          waitUntil: "domcontentloaded",
          extraWaitMs: 5000,
        });
        // Pre-parse HTML and wrap in envelope (parseSearchPage expects JSON)
        const parsed = parseSearchHtml(html, keyword, 1);
        return JSON.stringify({ _fromHtml: true, _parsed: parsed });
      },
      `zendesk/fetchSearchPage/${keyword}`,
      this.tracker,
    );
  }

  async fetchReviewPage(slug: string): Promise<string | null> {
    // Reviews are on the app detail page
    return this.fetchAppPage(slug);
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    // Check if this is a pre-parsed Algolia fallback envelope
    try {
      const envelope = JSON.parse(html);
      if (envelope._fromAlgolia && envelope._parsed) return envelope._parsed;
    } catch {
      // Not JSON — it's HTML, proceed with normal parsing
    }
    return parseZendeskAppDetails(html, slug);
  }

  parseCategoryPage(json: string, url: string): NormalizedCategoryPage {
    try {
      const envelope = JSON.parse(json);
      if (envelope._fromHtml && envelope._parsed) return envelope._parsed;
    } catch { /* not an envelope, continue with normal parsing */ }
    const slug = this.extractCategorySlugFromUrl(url);
    return parseZendeskCategoryPage(json, slug, url);
  }

  parseSearchPage(
    json: string,
    keyword: string,
    page: number,
  ): NormalizedSearchPage {
    try {
      const envelope = JSON.parse(json);
      if (envelope._fromHtml && envelope._parsed) return envelope._parsed;
    } catch { /* not an envelope, continue with normal parsing */ }
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
