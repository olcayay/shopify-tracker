const BASE_URL = "https://apps.shopify.com";

export const shopifyUrls = {
  base: BASE_URL,
  home: () => BASE_URL,
  app: (slug: string) => `${BASE_URL}/${slug}`,
  appReviews: (slug: string, page = 1) =>
    `${BASE_URL}/${slug}/reviews?sort_by=newest&page=${page}`,
  category: (slug: string) => `${BASE_URL}/categories/${slug}`,
  categoryPage: (slug: string, page?: number) =>
    `${BASE_URL}/categories/${slug}${page && page > 1 ? `?page=${page}` : ""}`,
  categoryAll: (slug: string, page?: number) =>
    `${BASE_URL}/categories/${slug}/all${page && page > 1 ? `?page=${page}` : ""}`,
  search: (keyword: string, page = 1) =>
    `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&st_source=autocomplete&page=${page}`,
  autocomplete: (keyword: string) =>
    `${BASE_URL}/search/autocomplete?q=${encodeURIComponent(keyword)}`,
} as const;
