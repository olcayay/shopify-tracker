const BASE_URL = "https://ecosystem.hubspot.com/marketplace";

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
} as const;
