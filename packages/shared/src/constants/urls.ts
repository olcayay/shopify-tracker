const BASE_URL = "https://apps.shopify.com";

export const urls = {
  base: BASE_URL,

  /** Homepage: apps.shopify.com */
  home: () => BASE_URL,

  /** App detail page: /formful */
  app: (slug: string) => `${BASE_URL}/${slug}`,

  /** App reviews page: /formful/reviews?page=1 */
  appReviews: (slug: string, page = 1) =>
    `${BASE_URL}/${slug}/reviews?page=${page}`,

  /** Category page: /categories/store-design */
  category: (slug: string) => `${BASE_URL}/categories/${slug}`,

  /** Category full app list: /categories/store-design/all?page=2 */
  categoryAll: (slug: string, page?: number) =>
    `${BASE_URL}/categories/${slug}/all${page && page > 1 ? `?page=${page}` : ""}`,

  /** Keyword search: /search?q=form */
  search: (keyword: string, page = 1) =>
    `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&st_source=autocomplete&page=${page}`,

  /** Autocomplete suggestions: /search/autocomplete?q=form */
  autocomplete: (keyword: string) =>
    `${BASE_URL}/search/autocomplete?q=${encodeURIComponent(keyword)}`,
} as const;
