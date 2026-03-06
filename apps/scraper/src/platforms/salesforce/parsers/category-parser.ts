import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import type { SalesforceApiResponse } from "./search-parser.js";

/** Extract the Logo URL from the logos array (prefer "Logo" type) */
function extractLogoUrl(logos?: { mediaId: string; logoType: string }[]): string {
  if (!logos || logos.length === 0) return "";
  const logo = logos.find((l) => l.logoType === "Logo");
  return (logo || logos[0]).mediaId || "";
}

/** Detect listing ID type based on format */
function detectIdType(oafId: string): "salesforce" | "uuid" {
  if (/^a0[A-Za-z]/.test(oafId) && (oafId.length === 15 || oafId.length === 18)) {
    return "salesforce";
  }
  return "uuid";
}

/**
 * Parse Salesforce API JSON response into a NormalizedCategoryPage.
 *
 * @param json - Raw JSON string from the API
 * @param categorySlug - The category slug
 * @param page - Current page number (1-based)
 * @param organicOffset - Number of organic apps already seen from previous pages
 */
export function parseSalesforceCategoryPage(
  json: string,
  categorySlug: string,
  page: number,
  organicOffset: number
): NormalizedCategoryPage {
  const data: SalesforceApiResponse = JSON.parse(json);
  const apps: NormalizedCategoryApp[] = [];

  // Sponsored/featured apps (only record from first page)
  if (page === 1 && data.featured) {
    for (let i = 0; i < data.featured.length; i++) {
      const item = data.featured[i];
      apps.push({
        slug: item.oafId,
        name: item.title,
        shortDescription: item.description || "",
        averageRating: item.averageRating ?? 0,
        ratingCount: item.reviewsAmount ?? 0,
        logoUrl: extractLogoUrl(item.logos),
        pricingHint: item.pricing,
        position: i + 1,
        isSponsored: true,
        badges: [],
      });
    }
  }

  // Organic listings
  for (let i = 0; i < data.listings.length; i++) {
    const item = data.listings[i];
    apps.push({
      slug: item.oafId,
      name: item.title,
      shortDescription: item.description || "",
      averageRating: item.averageRating ?? 0,
      ratingCount: item.reviewsAmount ?? 0,
      logoUrl: extractLogoUrl(item.logos),
      pricingHint: item.pricing,
      position: organicOffset + i + 1,
      isSponsored: false,
      badges: [],
    });
  }

  const pageSize = 12;
  const totalResults = data.totalCount;
  const hasNextPage = data.listings.length >= pageSize && (organicOffset + data.listings.length) < totalResults;

  // Format the display title
  const title = categorySlug
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  return {
    slug: categorySlug,
    url: `https://appexchange.salesforce.com/explore/business-needs?category=${categorySlug}`,
    title,
    description: "",
    appCount: totalResults,
    apps,
    subcategoryLinks: [], // Salesforce has flat categories
    hasNextPage,
  };
}
