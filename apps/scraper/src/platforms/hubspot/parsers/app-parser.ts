import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("hubspot:app-parser");

/**
 * Recursively unwrap CHIRP field values.
 * CHIRP wraps values as: { value: <actual>, __typename: "com.hubspot.chirp.ext.models.*FieldValue" }
 */
export function unwrapChirp(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(unwrapChirp);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("__typename" in obj && "value" in obj) {
      return unwrapChirp(obj.value);
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "__typename") continue;
      result[key] = unwrapChirp(val);
    }
    return result;
  }
  return v;
}

/**
 * Parse a HubSpot app detail from CHIRP API JSON response.
 * Input: JSON string from MarketplaceListingDetailsRpc/getListingDetailsV3
 */
export function parseHubSpotAppDetails(json: string, slug: string): NormalizedAppDetails {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    log.warn("failed to parse app detail JSON, returning minimal", { slug });
    return minimalAppDetails(slug);
  }

  const rawListing =
    (data as any)?.data?.listing?.value ??
    (data as any)?.data?.listing ??
    data;
  if (!rawListing || typeof rawListing !== "object") {
    log.warn("no listing found in response", { slug });
    return minimalAppDetails(slug);
  }

  const listing = unwrapChirp(rawListing) as Record<string, any>;

  const name = listing.name || listing.listingName || slug;
  const tagline = listing.tagline || "";
  const overview = listing.overview || "";
  const companyName = listing.companyName || "";
  const companyUrl = listing.companyUrl || "";
  const installCount = listing.installCount ? Number(listing.installCount) : null;

  // Icon URL — after unwrap, listingIcon is { value: "url", altText: "..." } or a string
  const iconRaw = listing.listingIcon;
  const iconUrl =
    typeof iconRaw === "string"
      ? iconRaw
      : iconRaw?.value || listing.iconUrl || null;

  // Categories
  const rawCategories: unknown[] = Array.isArray(listing.category) ? listing.category : [];
  const categories = rawCategories
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .map((c) => ({ slug: c, name: formatCategoryName(c) }));

  // Pricing
  const pricingPlans: any[] = Array.isArray(listing.pricingPlans) ? listing.pricingPlans : [];
  const pricingHint = buildPricingHint(pricingPlans);

  // Published dates
  const firstPublishedAt = listing.firstPublishedAt ? Number(listing.firstPublishedAt) : null;
  const launchedDate = firstPublishedAt
    ? new Date(firstPublishedAt).toISOString().split("T")[0]
    : null;

  log.info("parsed app from CHIRP API", { slug, name });

  return {
    name,
    slug,
    averageRating: null, // Not available in CHIRP API
    ratingCount: null,
    pricingHint,
    iconUrl,
    developer: companyName ? { name: companyName, url: companyUrl || undefined } : null,
    badges: buildBadges(listing),
    platformData: {
      shortDescription: tagline,
      longDescription: typeof overview === "string" ? stripHtml(overview) : null,
      pricing: pricingHint,
      pricingPlans: pricingPlans.map(formatPricingPlan),
      categories,
      installCount,
      launchedDate,
      productType: listing.productType || null,
      connectionType: listing.connectionType || null,
      certified: !!listing.certifiedAt,
      builtByHubSpot: listing.builtByHubSpot || false,
      source: "chirp-api",
    },
  };
}

function minimalAppDetails(slug: string): NormalizedAppDetails {
  return {
    name: slug,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    iconUrl: null,
    developer: null,
    badges: [],
    platformData: { source: "chirp-api-empty" },
  };
}

function formatCategoryName(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPricingHint(plans: any[]): string | null {
  if (!plans.length) return null;

  const freePlan = plans.find(
    (p) => p.pricingModel?.includes?.("FREE") || p.pricingName?.toLowerCase?.() === "free",
  );
  if (freePlan) return "Free plan available";

  const cheapest = plans.reduce((min: any, p: any) => {
    const price = p.pricingMonthlyCenticents || Infinity;
    return price < (min?.pricingMonthlyCenticents || Infinity) ? p : min;
  }, null);

  if (cheapest?.pricingMonthlyCenticents) {
    const dollars = cheapest.pricingMonthlyCenticents / 10000;
    return `From $${dollars}/mo`;
  }

  return plans[0]?.pricingName || null;
}

function formatPricingPlan(plan: any): Record<string, unknown> {
  return {
    name: plan.pricingName || null,
    model: plan.pricingModel || [],
    monthlyPrice: plan.pricingMonthlyCenticents
      ? plan.pricingMonthlyCenticents / 10000
      : null,
    features: plan.pricingFeatures || [],
  };
}

function buildBadges(listing: Record<string, any>): string[] {
  const badges: string[] = [];
  if (listing.certifiedAt) badges.push("Certified");
  if (listing.builtByHubSpot) badges.push("Built by HubSpot");
  return badges;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
