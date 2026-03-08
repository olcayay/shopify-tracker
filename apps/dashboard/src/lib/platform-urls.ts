import { PLATFORMS, type PlatformId } from "@appranks/shared";

export function buildExternalAppUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/${slug}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/appxListingDetail?listingId=${slug}`;
    case "canva":
      return `https://www.canva.com/apps/${slug.replace("--", "/")}`;
  }
}

export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/categories/${slug}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/explore/business-needs?category=${slug}`;
    case "canva":
      return `https://www.canva.com/apps/collections/${slug}`;
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
  }
}

export function buildExternalKeywordUrl(platform: PlatformId, keyword: string): string {
  return buildExternalSearchUrl(platform, keyword);
}

export function getPlatformName(platform: PlatformId): string {
  return PLATFORMS[platform].name;
}
