import { PLATFORMS, type PlatformId } from "@appranks/shared";

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
      const product = externalId || "support";
      const [id, ...rest] = slug.split("--");
      const textSlug = rest.join("-");
      return `https://www.zendesk.com/marketplace/apps/${product}/${id}/${textSlug}/`;
    }
    case "hubspot":
      return `https://ecosystem.hubspot.com/marketplace/listing/${slug}`;
  }
}

export function buildExternalCategoryUrl(platform: PlatformId, slug: string): string {
  switch (platform) {
    case "shopify":
      return `https://apps.shopify.com/categories/${slug}`;
    case "salesforce":
      return `https://appexchange.salesforce.com/explore/business-needs?category=${slug}`;
    case "canva":
      return `https://www.canva.com/your-apps/${slug}`;
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
      return `https://www.zendesk.com/marketplace/apps/?categories.name=${encodeURIComponent(slug)}`;
    case "hubspot":
      return `https://ecosystem.hubspot.com/marketplace/apps/${slug}`;
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
  }
}

export function buildExternalKeywordUrl(platform: PlatformId, keyword: string): string {
  return buildExternalSearchUrl(platform, keyword);
}

export function getPlatformName(platform: PlatformId): string {
  return PLATFORMS[platform].name;
}

/**
 * Format a category title for display.
 * After the compound-slug migration, Canva categories use simple slugs
 * so no special formatting is needed.
 */
export function formatCategoryTitle(platform: PlatformId, slug: string, title: string): string {
  return title;
}

const ZOOM_CDN = "https://marketplacecontent-cf.zoom.us";

/**
 * Fix Zoom CDN icon URLs: the S3 key must be URL-encoded (slashes → %2F).
 * Handles both already-encoded and raw URLs. Returns other URLs unchanged.
 */
export function fixIconUrl(url: string | null | undefined): string | null | undefined {
  if (!url || !url.startsWith(ZOOM_CDN)) return url;
  // Already encoded
  if (url.startsWith(`${ZOOM_CDN}/%2F`)) return url;
  const path = url.slice(ZOOM_CDN.length);
  return `${ZOOM_CDN}/${encodeURIComponent(path)}`;
}
