import type { PlatformId, PlatformCapabilities, PricingModel } from "@appranks/shared";

// --- Normalized types returned by all platform parsers ---

export interface NormalizedAppDetails {
  name: string;
  slug: string;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
  /** Canonical pricing model — one of: Free, Freemium, Free trial, Free to install, Paid, or null */
  pricingModel: PricingModel;
  iconUrl: string | null;
  developer: { name: string; url?: string; website?: string } | null;
  badges: string[];
  /** Platform-specific data stored as JSONB in app_snapshots.platform_data.
   *  Use getPlatformData() from @appranks/shared for typed access. */
  platformData: Record<string, unknown>;
}

export interface NormalizedCategoryApp {
  slug: string;
  name: string;
  shortDescription: string;
  averageRating: number;
  ratingCount: number;
  logoUrl: string;
  pricingHint?: string;
  position?: number;
  isSponsored: boolean;
  badges: string[];
  /** Platform-specific external ID (e.g., Atlassian numeric addonId) */
  externalId?: string;
  /** Platform-specific extra fields */
  extra?: Record<string, unknown>;
}

export interface NormalizedCategoryPage {
  slug: string;
  url: string;
  title: string;
  description: string;
  appCount: number | null;
  apps: NormalizedCategoryApp[];
  subcategoryLinks: { slug: string; url: string; title: string; parentSlug?: string }[];
  hasNextPage: boolean;
}

export interface NormalizedSearchApp {
  position: number;
  appSlug: string;
  appName: string;
  shortDescription: string;
  averageRating: number;
  ratingCount: number;
  logoUrl: string;
  pricingHint?: string;
  isSponsored: boolean;
  badges: string[];
  /** Platform-specific extra fields */
  extra?: Record<string, unknown>;
}

export interface NormalizedSearchPage {
  keyword: string;
  totalResults: number | null;
  apps: NormalizedSearchApp[];
  hasNextPage: boolean;
  currentPage: number;
}

export interface NormalizedReview {
  reviewDate: string;
  content: string;
  reviewerName: string;
  reviewerCountry: string;
  durationUsingApp: string;
  rating: number;
  developerReplyDate: string | null;
  developerReplyText: string | null;
}

export interface NormalizedReviewPage {
  reviews: NormalizedReview[];
  hasNextPage: boolean;
  currentPage: number;
}

export interface NormalizedFeaturedSection {
  sectionHandle: string;
  sectionTitle: string;
  surface: string;
  surfaceDetail: string;
  apps: { slug: string; name: string; iconUrl: string; position: number | null }[];
}

// --- Platform constants ---

export interface PlatformConstants {
  seedCategories: string[];
  /** Slugs that look like categories but are curated/editorial featured sections.
   *  These are scraped via the category flow but recorded as featured_app_sightings
   *  instead of category rankings. */
  featuredSectionSlugs?: string[];
  maxCategoryDepth: number;
  defaultPagesPerCategory: number;
  trackedFields: string[];
  rateLimit: { minDelayMs: number; maxDelayMs: number };
  /** Max concurrent HTTP requests per HttpClient instance (default: 2) */
  httpMaxConcurrency?: number;
  /** Max concurrent app detail scrapes (default: 3) */
  appDetailsConcurrency?: number;
  /** Max seed categories to crawl in parallel (default: 1 = sequential) */
  concurrentSeedCategories?: number;
  /** Max keywords to scrape in parallel (default: 3) */
  keywordConcurrency?: number;
}

// --- Scoring config ---

export interface PlatformScoringConfig {
  pageSize: number;
  pageDecay: number;
  similarityWeights: {
    category: number;
    feature: number;
    keyword: number;
    text: number;
  };
  stopWords: Set<string>;
}

// --- The main PlatformModule interface ---

export interface PlatformModule {
  readonly platformId: PlatformId;
  readonly capabilities: PlatformCapabilities;
  readonly constants: PlatformConstants;
  readonly scoringConfig: PlatformScoringConfig;

  // URL builders
  buildAppUrl(slug: string): string;
  buildCategoryUrl(slug: string, page?: number): string;
  buildSearchUrl?(keyword: string, page?: number): string;
  buildReviewUrl?(slug: string, page?: number): string;
  buildAutoSuggestUrl?(keyword: string): string;

  // Fetch (handles HTTP vs browser, special headers, etc.)
  fetchAppPage(slug: string): Promise<string>;
  fetchCategoryPage(slug: string, page?: number): Promise<string>;
  fetchSearchPage?(keyword: string, page?: number): Promise<string | null>;
  fetchReviewPage?(slug: string, page?: number): Promise<string | null>;

  // Parse (returns normalized common types + platformData JSONB)
  parseAppDetails(html: string, slug: string): NormalizedAppDetails;
  parseCategoryPage(html: string, url: string): NormalizedCategoryPage;
  parseSearchPage?(
    html: string,
    keyword: string,
    page: number,
    offset: number
  ): NormalizedSearchPage;
  parseReviewPage?(html: string, page: number): NormalizedReviewPage;
  parseFeaturedSections?(html: string): NormalizedFeaturedSection[];
  fetchFeaturedSections?(): Promise<NormalizedFeaturedSection[]>;

  // Slug extraction from URLs
  extractSlugFromUrl(url: string): string;

  // Similarity scoring helpers
  extractCategorySlugs?(platformData: Record<string, unknown>): string[];
  extractFeatureHandles?(platformData: Record<string, unknown>): string[];
}
