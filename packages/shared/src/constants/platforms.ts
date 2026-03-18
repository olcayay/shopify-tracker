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
    pageSize: 250,
  },
  google_workspace: {
    id: "google_workspace" as const,
    name: "Google Workspace Marketplace",
    baseUrl: "https://workspace.google.com/marketplace",
    hasKeywordSearch: true,
    hasReviews: true,
    hasFeaturedSections: false,
    hasAdTracking: false,
    hasSimilarApps: false,
    hasAutoSuggestions: false,
    hasFeatureTaxonomy: false,
    hasPricing: true,
    hasLaunchedDate: false,
    pageSize: 20,
  },
} as const;

export type PlatformId = keyof typeof PLATFORMS;
export type PlatformConfig = (typeof PLATFORMS)[PlatformId];
export type PlatformCapabilities = Pick<PlatformConfig,
  "hasKeywordSearch" | "hasReviews" | "hasFeaturedSections" |
  "hasAdTracking" | "hasSimilarApps" | "hasAutoSuggestions" | "hasFeatureTaxonomy" | "hasPricing" | "hasLaunchedDate"
>;

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORMS;
}

export function getPlatform(id: PlatformId): PlatformConfig {
  return PLATFORMS[id];
}

/** Build the external URL for an app on its marketplace */
export function buildExternalAppUrl(platform: PlatformId, slug: string): string {
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
  }
}
