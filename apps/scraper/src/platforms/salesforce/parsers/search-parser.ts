import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

/** Shape of a listing item from the Salesforce API */
interface SalesforceListingItem {
  oafId: string;
  type?: string;
  title: string;
  description: string;
  listingCategories?: string[];
  logos?: { mediaId: string; logoType: string; external_id?: string }[];
  publisher?: string;
  averageRating?: number;
  reviewsAmount?: number;
  pricing?: string;
  chatEnabled?: boolean;
  sponsored?: boolean;
  additionalProps?: Record<string, unknown>;
}

/** Shape of the Salesforce API response payload */
export interface SalesforceApiResponse {
  advancedQuery?: string;
  queryText?: string;
  searchQueryUid?: string;
  totalCount: number;
  listings: SalesforceListingItem[];
  featured?: SalesforceListingItem[];
}

/** Extract the Logo URL from the logos array (prefer "Logo" type) */
function extractLogoUrl(logos?: SalesforceListingItem["logos"]): string {
  if (!logos || logos.length === 0) return "";
  const logo = logos.find((l) => l.logoType === "Logo");
  return (logo || logos[0]).mediaId || "";
}

/** Detect listing ID type based on format */
function detectIdType(oafId: string): "salesforce" | "uuid" {
  // Salesforce IDs typically start with "a0N" and are 15 or 18 chars
  if (/^a0[A-Za-z]/.test(oafId) && (oafId.length === 15 || oafId.length === 18)) {
    return "salesforce";
  }
  return "uuid";
}

/**
 * Parse Salesforce API JSON response into a NormalizedSearchPage.
 *
 * @param json - Raw JSON string from the API
 * @param keyword - The keyword searched
 * @param page - Current page number (1-based)
 * @param organicOffset - Number of organic apps already seen from previous pages
 */
export function parseSalesforceSearchPage(
  json: string,
  keyword: string,
  page: number,
  organicOffset: number
): NormalizedSearchPage {
  const data: SalesforceApiResponse = JSON.parse(json);
  const apps: NormalizedSearchApp[] = [];

  // Sponsored/featured apps (only record from first page to avoid duplicates)
  if (page === 1 && data.featured) {
    for (let i = 0; i < data.featured.length; i++) {
      const item = data.featured[i];
      apps.push({
        position: i + 1,
        appSlug: item.oafId,
        appName: item.title,
        shortDescription: item.description || "",
        averageRating: item.averageRating ?? 0,
        ratingCount: item.reviewsAmount ?? 0,
        logoUrl: extractLogoUrl(item.logos),
        pricingHint: item.pricing || undefined,
        isSponsored: true,
        badges: [],
        extra: {
          listingIdType: detectIdType(item.oafId),
          publisher: item.publisher,
          listingCategories: item.listingCategories,
        },
      });
    }
  }

  // Organic listings
  for (let i = 0; i < data.listings.length; i++) {
    const item = data.listings[i];
    apps.push({
      position: organicOffset + i + 1,
      appSlug: item.oafId,
      appName: item.title,
      shortDescription: item.description || "",
      averageRating: item.averageRating ?? 0,
      ratingCount: item.reviewsAmount ?? 0,
      logoUrl: extractLogoUrl(item.logos),
      pricingHint: item.pricing || undefined,
      isSponsored: false,
      badges: [],
      extra: {
        listingIdType: detectIdType(item.oafId),
        publisher: item.publisher,
        listingCategories: item.listingCategories,
      },
    });
  }

  const pageSize = 12;
  const totalResults = data.totalCount;
  const hasNextPage = data.listings.length >= pageSize && (organicOffset + data.listings.length) < totalResults;

  return {
    keyword,
    totalResults,
    apps,
    hasNextPage,
    currentPage: page,
  };
}
