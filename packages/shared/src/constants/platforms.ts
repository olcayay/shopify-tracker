export const PLATFORMS = {
  shopify: {
    id: "shopify" as const,
    name: "Shopify App Store",
    baseUrl: "https://apps.shopify.com",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: true,
    hasSimilarApps: true,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: true,
    hasPricing: true,
    hasLaunchedDate: true,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 24,
  },
  salesforce: {
    id: "salesforce" as const,
    name: "Salesforce AppExchange",
    baseUrl: "https://appexchange.salesforce.com",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: false,
    hasAdTracking: true,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: true,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 12,
  },
  canva: {
    id: "canva" as const,
    name: "Canva Apps",
    baseUrl: "https://www.canva.com/apps",
    hasKeywordSearch: true,
    hasReviews: false,
    hasFeaturedSections: false,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: false,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 30,
  },
  wix: {
    id: "wix" as const,
    name: "Wix App Market",
    baseUrl: "https://www.wix.com/app-market",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: true,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 50,
  },
  wordpress: {
    id: "wordpress" as const,
    name: "WordPress Plugin Directory",
    baseUrl: "https://wordpress.org/plugins",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: true,
    hasFlatCategories: true,
    allowLinkedButUnrankedCategories: true,
    maxRatingStars: 5,
    pageSize: 250,
  },
  google_workspace: {
    id: "google_workspace" as const,
    name: "Google Workspace Marketplace",
    baseUrl: "https://workspace.google.com/marketplace",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 20,
  },
  atlassian: {
    id: "atlassian" as const,
    name: "Atlassian Marketplace",
    baseUrl: "https://marketplace.atlassian.com",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: true,
    maxRatingStars: 4,
    pageSize: 50,
  },
  zoom: {
    id: "zoom" as const,
    name: "Zoom App Marketplace",
    baseUrl: "https://marketplace.zoom.us",
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
    maxRatingStars: 5,
    pageSize: 100,
  },
  zoho: {
    id: "zoho" as const,
    name: "Zoho Marketplace",
    baseUrl: "https://marketplace.zoho.com",
    hasKeywordSearch: true,
    hasReviews: false,
    hasFeaturedSections: false,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: false,
    hasLaunchedDate: true,
    hasFlatCategories: true,
    maxRatingStars: 5,
    pageSize: 50,
  },
  zendesk: {
    id: "zendesk" as const,
    name: "Zendesk Marketplace",
    baseUrl: "https://www.zendesk.com/marketplace",
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
    maxRatingStars: 5,
    pageSize: 24,
  },
  hubspot: {
    id: "hubspot" as const,
    name: "HubSpot App Marketplace",
    baseUrl: "https://ecosystem.hubspot.com/marketplace",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: false,
    maxRatingStars: 5,
    pageSize: 24,
  },
  woocommerce: {
    id: "woocommerce" as const,
    name: "WooCommerce Marketplace",
    baseUrl: "https://woocommerce.com/products",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: true,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    hasFlatCategories: true,
    maxRatingStars: 5,
    pageSize: 60,
  },
} as const;

export type PlatformId = keyof typeof PLATFORMS;
export type PlatformConfig = (typeof PLATFORMS)[PlatformId];
export type PlatformCapabilities = Pick<PlatformConfig,
  "hasKeywordSearch" | "hasReviews" | "hasFeaturedSections" |
  "hasAdTracking" | "hasSimilarApps" | "hasAutoSuggestions" | "hasFeatureTaxonomy" | "hasPricing" | "hasLaunchedDate" | "hasFlatCategories"
>;

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

/**
 * Browser requirements per platform.
 * - `true`: browser needed for all scraper types
 * - `Record<string, boolean>`: browser needed only for specific scraper types
 * - absent/`false`: no browser needed
 */
export const BROWSER_REQUIREMENTS: Partial<Record<PlatformId, boolean | Record<string, boolean>>> = {
  canva: true,
  google_workspace: true,
  zoho: true,
  zendesk: true,
  salesforce: { app_details: true },
};

/** Check whether a platform needs a browser client for the given scraper type. */
export function needsBrowser(platform: PlatformId, scraperType?: string): boolean {
  const req = BROWSER_REQUIREMENTS[platform];
  if (req === undefined || req === false) return false;
  if (req === true) return true;
  return scraperType ? (req[scraperType] ?? false) : Object.values(req).some(Boolean);
}

/** Map a platformId to its feature flag slug (e.g. "google_workspace" → "platform-google-workspace") */
export function platformFeatureFlagSlug(platform: PlatformId): string {
  return `platform-${platform.replace(/_/g, "-")}`;
}

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORMS;
}

export function getPlatform(id: PlatformId): PlatformConfig {
  return PLATFORMS[id];
}

/** Build the external URL for an app on its marketplace */
export function buildExternalAppUrl(platform: PlatformId, slug: string, externalId?: string | null): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/${slug}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/appxListingDetail?listingId=${slug}`;
    case "canva":
      return `https://www.canva.com/apps/${slug.replace("--", "/")}`;
    case "wix":
      return `https://www.wix.com/app-market/web-solution/${slug}`;
    case "wordpress":
      return `https://wordpress.org/plugins/${slug}/`;
    case "google_workspace":
      return `https://workspace.google.com/marketplace/app/${slug.replace("--", "/")}`;
    case "atlassian":
      if (externalId) return `https://marketplace.atlassian.com/apps/${externalId}`;
      return `https://marketplace.atlassian.com/apps/${slug}`;
    case "zoom":
      return `https://marketplace.zoom.us/apps/${slug}`;
    case "zoho":
      return `https://marketplace.zoho.com/app/${slug.replace("--", "/")}`;
    case "zendesk": {
      // slug format: {numericId}--{text-slug}, product type in externalId
      const product = externalId || "support";
      const [id, ...rest] = slug.split("--");
      const textSlug = rest.join("-");
      return `https://www.zendesk.com/marketplace/apps/${product}/${id}/${textSlug}/`;
    }
    case "hubspot":
      return `https://ecosystem.hubspot.com/marketplace/listing/${slug}`;
    case "woocommerce":
      return `https://woocommerce.com/products/${slug}/`;
  }
}

/** Build the external URL for a category on its marketplace */
export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/categories/${slug}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/explore/business-needs?category=${slug}`;
    case "canva": {
      // Compound slugs (sub-categories): use parent's URL
      const parentSlug = slug.includes("--") ? slug.split("--")[0] : slug;
      return `https://www.canva.com/your-apps/${parentSlug}`;
    }
    case "wix":
      return `https://www.wix.com/app-market/category/${slug.replace("--", "/")}`;
    case "wordpress":
      if (slug.startsWith("_browse_")) {
        const browseType = slug.slice("_browse_".length);
        return `https://wordpress.org/plugins/browse/${browseType}/`;
      }
      return `https://wordpress.org/plugins/tags/${slug}/`;
    case "google_workspace":
      return `https://workspace.google.com/marketplace/category/${slug.replace("--", "/")}`;
    case "atlassian":
      return `https://marketplace.atlassian.com/categories/${slug}`;
    case "zoom":
      return `https://marketplace.zoom.us/apps?category=${slug}`;
    case "zoho":
      return `https://marketplace.zoho.com/app/${slug}`;
    case "zendesk":
      // Category title is stored in the DB; slug is kebab-case, title is the URL param
      // Fallback: convert slug to title-case for URL
      return `https://www.zendesk.com/marketplace/apps/?categories.name=${encodeURIComponent(slug)}`;
    case "hubspot":
      return `https://ecosystem.hubspot.com/marketplace/apps/${slug.replace(/--/g, "/")}`;
    case "woocommerce":
      return `https://woocommerce.com/product-category/woocommerce-extensions/?category=${slug}`;
  }
}

export function buildExternalSearchUrl(platform: PlatformId, query: string): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/search?q=${encodeURIComponent(query)}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/appxSearchKeywordResults?keywords=${encodeURIComponent(query)}`;
    case "canva":
      return `https://www.canva.com/your-apps?q=${encodeURIComponent(query)}`;
    case "wix":
      return `https://www.wix.com/app-market/search-result?query=${encodeURIComponent(query)}`;
    case "wordpress":
      return `https://wordpress.org/plugins/search/${encodeURIComponent(query)}/`;
    case "google_workspace":
      return `https://workspace.google.com/marketplace/search/${encodeURIComponent(query)}?flow_type=2`;
    case "atlassian":
      return `https://marketplace.atlassian.com/search?query=${encodeURIComponent(query)}`;
    case "zoom":
      return `https://marketplace.zoom.us/apps?q=${encodeURIComponent(query)}`;
    case "zoho":
      return `https://marketplace.zoho.com/search?searchTerm=${encodeURIComponent(query)}`;
    case "zendesk":
      return `https://www.zendesk.com/marketplace/apps/?query=${encodeURIComponent(query)}`;
    case "hubspot":
      return `https://ecosystem.hubspot.com/marketplace/explore?query=${encodeURIComponent(query)}`;
    case "woocommerce":
      return `https://woocommerce.com/search/?q=${encodeURIComponent(query)}`;
  }
}
