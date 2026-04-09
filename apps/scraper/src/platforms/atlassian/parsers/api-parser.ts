import { createLogger, normalizePricingModel } from "@appranks/shared";
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

/** Parse version details from /rest/2/addons/{key}/versions/latest */
export function parseVersionDetails(json: Record<string, any>) {
  const licenseHref = json._links?.license?.href || "";
  const licenseMatch = licenseHref.match(/\/licenseTypes\/(.+)/);
  const licenseType = licenseMatch
    ? licenseMatch[1].charAt(0).toUpperCase() + licenseMatch[1].slice(1)
    : null;

  const compatibilities: Array<{ application: string; cloud: boolean; server: boolean; dataCenter: boolean }> = [];
  if (Array.isArray(json.compatibilities)) {
    for (const c of json.compatibilities) {
      compatibilities.push({
        application: c.application || "",
        cloud: c.hosting === "cloud",
        server: c.hosting === "server",
        dataCenter: c.hosting === "dataCenter",
      });
    }
  }

  const highlights: Array<{ title: string; body: string }> = [];
  if (Array.isArray(json._embedded?.highlights)) {
    for (const h of json._embedded.highlights) {
      highlights.push({
        title: h.title || "",
        body: h.body ? stripHtml(h.body) : "",
      });
    }
  }

  return {
    version: json.name || null,
    paymentModel: json.paymentModel || null,
    releaseDate: json.release?.date || null,
    licenseType,
    compatibilities,
    highlights,
    fullDescription: json.text?.moreDetails ? stripHtml(json.text.moreDetails) : null,
    documentationUrl: json.vendorLinks?.documentation || null,
    eulaUrl: json.vendorLinks?.eula || null,
  };
}

/** Parse vendor details from /rest/2/vendors/{id} */
export function parseVendorDetails(json: Record<string, any>) {
  const support = json.supportDetails?.supportOrg;
  return {
    supportEmail: support?.supportEmail || null,
    supportUrl: support?.supportUrl || null,
    supportPhone: support?.supportPhone || null,
    contactEmail: json.email || null,
    address: json.address || null,
    homePage: json.vendorLinks?.homePage || null,
    slaUrl: json.vendorLinks?.sla || null,
    trustCenterUrl: json.vendorLinks?.trustCenterUrl || null,
  };
}

/** Parse pricing tiers from /rest/2/addons/{key}/pricing/cloud/live */
export function parsePricingTiers(json: Record<string, any>) {
  const items = json.items;
  if (!Array.isArray(items) || items.length === 0) return [];

  // Filter to annual (monthsValid === 12) items
  const annual = items.filter((i: any) => i.monthsValid === 12);
  if (annual.length === 0) return [];

  // Pick representative tiers to avoid huge arrays
  const targetUnits = new Set([10, 25, 100, 500, 2000, 10000]);
  let selected = annual.filter((i: any) => targetUnits.has(i.unitCount));
  if (selected.length === 0) {
    // Fallback: take first 6 unique tiers
    selected = annual.slice(0, 6);
  }

  return selected.map((i: any) => ({
    name: i.editionDescription || `${i.unitCount} users`,
    price: String(i.amount / 100),
    period: "yr",
    yearly_price: null,
    discount_text: null,
    trial_text: null,
    features: [],
    currency_code: null,
    units: i.unitCount ? `${i.unitCount} users` : null,
  }));
}

/** Parse a single addon detail JSON response into NormalizedAppDetails.
 *  Source: GET /rest/2/addons/{addonKey}
 *  Optionally enriched with version, vendor, and pricing data.
 */
export function parseAddonDetails(
  json: Record<string, any>,
  versionData?: Record<string, any> | null,
  vendorData?: Record<string, any> | null,
  pricingData?: Record<string, any> | null,
): NormalizedAppDetails {
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

  // Extract vendorId from vendor self link
  const vendorHref = embedded.vendor?._links?.self?.href || "";
  const vendorIdMatch = vendorHref.match(/\/vendors\/(\d+)/);
  const vendorId = vendorIdMatch ? vendorIdMatch[1] : null;

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

  // Parse optional enrichment data
  const versionInfo = versionData ? parseVersionDetails(versionData) : null;
  const vendorInfo = vendorData ? parseVendorDetails(vendorData) : null;
  const pricingPlans = pricingData ? parsePricingTiers(pricingData) : [];

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
    // New fields from addon endpoint
    lastModified: json.lastModified || null,
    vendorLinks: json.vendorLinks || null,
    vendorId,
    bugBountyParticipant: json.programs?.bugBountyParticipant?.cloud?.status === "approved" || false,
    tagCategories: json.tags?.category || [],
    tagKeywords: json.tags?.keywords || [],
    listingCategories: categories.map(c => c.name),
    // Version info
    version: versionInfo?.version || null,
    paymentModel: versionInfo?.paymentModel || null,
    releaseDate: versionInfo?.releaseDate || null,
    licenseType: versionInfo?.licenseType || null,
    compatibilities: versionInfo?.compatibilities || [],
    highlights: versionInfo?.highlights || [],
    fullDescription: versionInfo?.fullDescription || null,
    documentationUrl: versionInfo?.documentationUrl || null,
    eulaUrl: versionInfo?.eulaUrl || null,
    // Vendor info
    supportEmail: vendorInfo?.supportEmail || null,
    supportUrl: vendorInfo?.supportUrl || null,
    supportPhone: vendorInfo?.supportPhone || null,
    contactEmail: vendorInfo?.contactEmail || null,
    vendorAddress: vendorInfo?.address || null,
    vendorHomePage: vendorInfo?.homePage || null,
    slaUrl: vendorInfo?.slaUrl || null,
    trustCenterUrl: vendorInfo?.trustCenterUrl || null,
    // Pricing
    pricingPlans,
  };

  const pricingHint = versionInfo?.paymentModel === "free"
    ? "Free"
    : pricingPlans.length > 0
      ? `From $${pricingPlans[0].price}/yr`
      : null;

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint,
    pricingModel: normalizePricingModel(pricingHint),
    iconUrl,
    developer: vendorName
      ? { name: vendorName, url: vendorUrl, website: vendorInfo?.homePage || undefined }
      : null,
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
      if (addonEmbedded.vendor?.programs?.topVendor?.status === "approved" || addon.programs?.topVendor?.status === "approved") {
        badges.push("top_vendor");
      }

      const vendorName = addonEmbedded.vendor?.name || null;

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
          ...(vendorName && { vendorName }),
          ...(addon.id && { externalId: String(addon.id) }),
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

