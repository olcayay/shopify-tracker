import { createLogger } from "@appranks/shared";
import type {
  NormalizedAppDetails,
  NormalizedSearchPage,
  NormalizedSearchApp,
} from "../../platform-module.js";

const log = createLogger("atlassian:api-parser");

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Parse a single addon detail JSON response into NormalizedAppDetails.
 *  Source: GET /rest/2/addons/{addonKey}
 */
export function parseAddonDetails(json: Record<string, any>): NormalizedAppDetails {
  const name = json.name || "";
  const slug = json.key || "";

  const embedded = json._embedded || {};

  // Rating
  const averageRating = embedded.reviews?.averageStars ?? null;
  const ratingCount = embedded.reviews?.count ?? null;

  // Icon
  const iconUrl = embedded.logo?._links?.image?.href ?? null;

  // Developer / vendor
  const vendorName = embedded.vendor?.name || null;
  const vendorUrl = embedded.vendor?._links?.self?.href || undefined;

  // Badges
  const badges: string[] = [];
  if (json.programs?.cloudFortified?.status === "approved") {
    badges.push("cloud_fortified");
  }
  if (embedded.vendor?.programs?.topVendor?.status === "approved" || json.programs?.topVendor?.status === "approved") {
    badges.push("top_vendor");
  }

  // Distribution
  const distribution = embedded.distribution || {};

  // Categories from embedded
  const categories: Array<{ slug: string; name: string }> = [];
  if (Array.isArray(embedded.categories)) {
    for (const cat of embedded.categories) {
      if (cat.key || cat.name) {
        categories.push({ slug: cat.key || "", name: cat.name || "" });
      }
    }
  }

  const platformData: Record<string, unknown> = {
    appId: json.id ?? null,
    tagLine: json.tagLine || null,
    summary: json.summary ? stripHtml(json.summary) : null,
    description: json.description || null,
    hostingVisibility: json.hosting?.visibility || null,
    totalInstalls: distribution.totalInstalls ?? null,
    downloads: distribution.totalDownloads ?? null,
    categories,
    cloudFortified: json.programs?.cloudFortified?.status === "approved",
    topVendor: embedded.vendor?.programs?.topVendor?.status === "approved" || json.programs?.topVendor?.status === "approved" || false,
    vendorName,
  };

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint: null,
    iconUrl,
    developer: vendorName ? { name: vendorName, url: vendorUrl } : null,
    badges,
    platformData,
  };
}

/** Parse search results JSON into NormalizedSearchPage.
 *  Source: GET /rest/2/addons?text={keyword}&offset=N&limit=50
 */
export function parseSearchResults(
  json: Record<string, any>,
  keyword: string,
  page: number,
  offset: number,
): NormalizedSearchPage {
  const embedded = json._embedded || {};
  const addons = embedded.addons || [];

  const apps: NormalizedSearchApp[] = addons.map(
    (addon: Record<string, any>, idx: number) => {
      const addonEmbedded = addon._embedded || {};
      const iconUrl = addonEmbedded.logo?._links?.image?.href || "";

      const badges: string[] = [];
      if (addon.programs?.cloudFortified?.status === "approved") {
        badges.push("cloud_fortified");
      }

      return {
        position: offset + idx + 1,
        appSlug: addon.key || "",
        appName: addon.name || "",
        shortDescription: addon.summary ? stripHtml(addon.summary) : "",
        averageRating: addonEmbedded.reviews?.averageStars ?? 0,
        ratingCount: addonEmbedded.reviews?.count ?? 0,
        logoUrl: iconUrl,
        pricingHint: undefined,
        isSponsored: false,
        badges,
        extra: {
          totalInstalls: addonEmbedded.distribution?.totalInstalls,
        },
      };
    },
  );

  const totalResults = json.count ?? null;

  log.info("parsed search results", {
    keyword,
    page,
    totalResults,
    appCount: apps.length,
  });

  return {
    keyword,
    totalResults,
    apps,
    hasNextPage: apps.length > 0 && (offset + apps.length) < (totalResults || 0),
    currentPage: page,
  };
}
