import { PLATFORMS, buildExternalSearchUrl as sharedBuildExternalSearchUrl, type PlatformId } from "@appranks/shared";

// Re-export URL builders from shared package (single source of truth)
export { buildExternalAppUrl, buildExternalCategoryUrl, buildExternalSearchUrl } from "@appranks/shared";

export function buildExternalKeywordUrl(platform: PlatformId, keyword: string): string {
  return sharedBuildExternalSearchUrl(platform, keyword);
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
