const BASE_URL = "https://appexchange.salesforce.com";
const API_BASE = "https://api.appexchange.salesforce.com/recommendations/v3/listings";

export const salesforceUrls = {
  base: BASE_URL,

  /** App detail page */
  app: (listingId: string) =>
    `${BASE_URL}/appxListingDetail?listingId=${listingId}`,

  /** Category listing via JSON API (1-based pages) */
  categoryApi: (slug: string, page = 1, sponsoredCount?: number) => {
    const params = new URLSearchParams({
      type: "apps",
      page: String(page),
      pageSize: "12",
      language: "en",
      category: slug,
    });
    if (sponsoredCount != null && sponsoredCount > 0) {
      params.set("sponsoredCount", String(sponsoredCount));
    }
    return `${API_BASE}?${params.toString()}`;
  },

  /** Keyword search via JSON API (1-based pages) */
  searchApi: (keyword: string, page = 1, sponsoredCount?: number) => {
    const params = new URLSearchParams({
      type: "apps",
      page: String(page),
      pageSize: "12",
      language: "en",
      keyword,
    });
    if (sponsoredCount != null && sponsoredCount > 0) {
      params.set("sponsoredCount", String(sponsoredCount));
    }
    return `${API_BASE}?${params.toString()}`;
  },

  /** External category URL (for display purposes) */
  category: (slug: string) =>
    `${BASE_URL}/explore/business-needs?category=${slug}`,
} as const;
