const BASE_URL = "https://ecosystem.hubspot.com/marketplace";
const CHIRP_BASE = "https://app.hubspot.com/api/chirp-frontend-external/v1/gateway";

export const hubspotUrls = {
  base: BASE_URL,

  /** App detail page: /marketplace/listing/{slug} */
  app: (slug: string) => `${BASE_URL}/listing/${slug}`,

  /** Category listing page: /marketplace/apps/{slug} */
  category: (categorySlug: string, page?: number) => {
    if (page && page > 1) {
      return `${BASE_URL}/apps/${categorySlug}?page=${page}`;
    }
    return `${BASE_URL}/apps/${categorySlug}`;
  },

  /** Search page: /marketplace/explore?query={keyword} */
  search: (keyword: string) => `${BASE_URL}/explore?query=${encodeURIComponent(keyword)}`,

  /** Homepage (for featured sections): /marketplace */
  homepage: () => BASE_URL,

  /** Review page (reviews are on the app detail page) */
  reviews: (slug: string) => `${BASE_URL}/listing/${slug}`,

  /** Featured collection: /marketplace/featured/{collectionSlug} */
  featured: (collectionSlug: string) => `${BASE_URL}/featured/${collectionSlug}`,

  // --- CHIRP API endpoints ---
  chirp: {
    /** List all apps (paginated by offset/limit, sorted by install count) */
    search: () =>
      `${CHIRP_BASE}/com.hubspot.marketplace.personalization.rpc.PersonalizationPublicRpc/search`,

    /** Full app listing details by slug */
    appDetail: () =>
      `${CHIRP_BASE}/com.hubspot.marketplace.listing.details.rpc.MarketplaceListingDetailsRpc/getListingDetailsV3`,

    /** Filter config with all categories */
    filterConfig: () =>
      `${CHIRP_BASE}/com.hubspot.marketplace.storefront.service.rpc.MarketplaceStorefrontPublicRpc/getSearchFilterConfig`,

    /** Featured collections (curated) */
    collections: () =>
      `${CHIRP_BASE}/com.hubspot.marketplace.quality.rpc.CollectionsPublicRpc/getCollections`,

    /** Homepage suggestion sections */
    suggestions: () =>
      `${CHIRP_BASE}/com.hubspot.marketplace.personalization.rpc.PersonalizationPublicRpc/getSuggestionSections`,
  },
} as const;

/** Standard headers for CHIRP API requests. */
export const CHIRP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Referer: "https://ecosystem.hubspot.com/",
  Accept: "application/json",
};
