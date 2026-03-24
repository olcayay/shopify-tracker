import type { PlatformCapabilities } from "@appranks/shared";
import type {
  PlatformModule,
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedReviewPage,
  NormalizedFeaturedSection,
  PlatformConstants,
  PlatformScoringConfig,
} from "../platform-module.js";
import { HttpClient } from "../../http-client.js";
import { parseAppPage, parseSimilarApps } from "../../parsers/app-parser.js";
import {
  parseCategoryPage as parseShopifyCategoryPage,
  hasNextPage,
  computeMetrics,
} from "../../parsers/category-parser.js";
import { parseSearchPage as parseShopifySearchPage } from "../../parsers/search-parser.js";
import { parseReviewPage as parseShopifyReviewPage } from "../../parsers/review-parser.js";
import {
  parseFeaturedSections as parseShopifyFeaturedSections,
} from "../../parsers/featured-parser.js";
import { shopifyUrls } from "./urls.js";
import { SHOPIFY_CONSTANTS, SHOPIFY_SCORING } from "./constants.js";

export class ShopifyModule implements PlatformModule {
  readonly platformId = "shopify" as const;
  readonly constants: PlatformConstants = SHOPIFY_CONSTANTS;
  readonly scoringConfig: PlatformScoringConfig = SHOPIFY_SCORING;

  readonly capabilities: PlatformCapabilities = {
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: true,
    hasSimilarApps: true,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: true,
    hasPricing: true,
    hasLaunchedDate: true,
  };

  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient();
  }

  // --- URL builders ---

  buildAppUrl(slug: string): string {
    return shopifyUrls.app(slug);
  }

  buildCategoryUrl(slug: string, page?: number): string {
    return shopifyUrls.categoryPage(slug, page);
  }

  buildSearchUrl(keyword: string, page?: number): string {
    return shopifyUrls.search(keyword, page);
  }

  buildReviewUrl(slug: string, page?: number): string {
    return shopifyUrls.appReviews(slug, page);
  }

  buildAutoSuggestUrl(keyword: string): string {
    return shopifyUrls.autocomplete(keyword);
  }

  // --- Fetch ---

  async fetchAppPage(slug: string): Promise<string> {
    return this.httpClient.fetchPage(shopifyUrls.app(slug));
  }

  async fetchCategoryPage(slug: string, page?: number): Promise<string> {
    return this.httpClient.fetchPage(shopifyUrls.categoryPage(slug, page));
  }

  async fetchSearchPage(keyword: string, page?: number): Promise<string | null> {
    return this.httpClient.fetchPage(shopifyUrls.search(keyword, page), {
      "Turbo-Frame": "search-results",
    });
  }

  async fetchReviewPage(slug: string, page?: number): Promise<string | null> {
    return this.httpClient.fetchPage(shopifyUrls.appReviews(slug, page));
  }

  // --- Parse ---

  parseAppDetails(html: string, slug: string): NormalizedAppDetails {
    const parsed = parseAppPage(html, slug);
    const similarApps = parseSimilarApps(html);

    return {
      name: parsed.app_name,
      slug: parsed.app_slug,
      averageRating: parsed.average_rating,
      ratingCount: parsed.rating_count,
      pricingHint: parsed.pricing || null,
      iconUrl: parsed.icon_url,
      developer: parsed.developer
        ? { name: parsed.developer.name, url: parsed.developer.url, website: parsed.developer.website }
        : null,
      badges: [], // Will be determined by checking is_built_for_shopify in the scraper
      platformData: {
        appIntroduction: parsed.app_introduction,
        appDetails: parsed.app_details,
        seoTitle: parsed.seo_title,
        seoMetaDescription: parsed.seo_meta_description,
        features: parsed.features,
        integrations: parsed.integrations,
        categories: parsed.categories,
        pricingPlans: parsed.pricing_plans,
        support: parsed.support,
        demoStoreUrl: parsed.demo_store_url,
        languages: parsed.languages,
        launchedDate: parsed.launched_date,
        similarApps,
      },
    };
  }

  parseCategoryPage(html: string, url: string): NormalizedCategoryPage {
    const parsed = parseShopifyCategoryPage(html, url);

    return {
      slug: parsed.slug,
      url: parsed.url,
      title: parsed.title,
      description: parsed.description,
      appCount: parsed.app_count,
      apps: parsed.first_page_apps.map((app) => ({
        slug: app.app_url.replace("https://apps.shopify.com/", ""),
        name: app.name,
        shortDescription: app.short_description,
        averageRating: app.average_rating,
        ratingCount: app.rating_count,
        logoUrl: app.logo_url,
        pricingHint: app.pricing_hint,
        position: app.position,
        isSponsored: app.is_sponsored ?? false,
        badges: app.is_built_for_shopify ? ["built_for_shopify"] : [],
      })),
      subcategoryLinks: parsed.subcategory_links,
      hasNextPage: hasNextPage(html),
    };
  }

  parseSearchPage(
    html: string,
    keyword: string,
    page: number,
    offset: number
  ): NormalizedSearchPage {
    const parsed = parseShopifySearchPage(html, keyword, page, offset);

    return {
      keyword: parsed.keyword,
      totalResults: parsed.total_results,
      apps: parsed.apps.map((app) => ({
        position: app.position,
        appSlug: app.app_slug,
        appName: app.app_name,
        shortDescription: app.short_description,
        averageRating: app.average_rating,
        ratingCount: app.rating_count,
        logoUrl: app.logo_url,
        pricingHint: app.pricing_hint,
        isSponsored: app.is_sponsored ?? false,
        badges: [
          ...(app.is_built_for_shopify ? ["built_for_shopify"] : []),
        ],
        extra: {
          isBuiltIn: app.is_built_in ?? false,
        },
      })),
      hasNextPage: parsed.has_next_page,
      currentPage: parsed.current_page,
    };
  }

  parseReviewPage(html: string, page: number): NormalizedReviewPage {
    const parsed = parseShopifyReviewPage(html, page);

    return {
      reviews: parsed.reviews.map((r) => ({
        reviewDate: r.review_date,
        content: r.content,
        reviewerName: r.reviewer_name,
        reviewerCountry: r.reviewer_country,
        durationUsingApp: r.duration_using_app,
        rating: r.rating,
        developerReplyDate: r.developer_reply_date,
        developerReplyText: r.developer_reply_text,
      })),
      hasNextPage: parsed.has_next_page,
      currentPage: parsed.current_page,
    };
  }

  async fetchFeaturedSections(): Promise<NormalizedFeaturedSection[]> {
    const html = await this.httpClient.fetchPage(shopifyUrls.home());
    return this.parseFeaturedSections(html);
  }

  parseFeaturedSections(html: string): NormalizedFeaturedSection[] {
    const parsed = parseShopifyFeaturedSections(html);

    return parsed.map((section) => ({
      sectionHandle: section.sectionHandle,
      sectionTitle: section.sectionTitle,
      surface: section.surface,
      surfaceDetail: section.surfaceDetail,
      apps: section.apps.map((app) => ({
        slug: app.slug,
        name: app.name,
        iconUrl: app.iconUrl,
        position: app.position,
      })),
    }));
  }

  // --- Slug extraction ---

  extractSlugFromUrl(url: string): string {
    // Remove base URL and extract slug
    const cleaned = url
      .replace("https://apps.shopify.com/", "")
      .split("?")[0]
      .split("/")[0];
    return cleaned;
  }

  // --- Similarity helpers ---

  extractCategorySlugs(platformData: Record<string, unknown>): string[] {
    const categories = platformData.categories as
      | { url: string; subcategories?: { features?: { feature_handle: string }[] }[] }[]
      | undefined;
    if (!categories) return [];

    return categories
      .map((cat) => {
        const match = cat.url?.match(/\/categories\/([^/?]+)/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null);
  }

  extractFeatureHandles(platformData: Record<string, unknown>): string[] {
    const categories = platformData.categories as
      | { subcategories?: { features?: { feature_handle: string }[] }[] }[]
      | undefined;
    if (!categories) return [];

    const handles: string[] = [];
    for (const cat of categories) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        if (!sub.features) continue;
        for (const f of sub.features) {
          if (f.feature_handle) handles.push(f.feature_handle);
        }
      }
    }
    return handles;
  }
}
