const API_BASE = "https://woocommerce.com/wp-json/wccom-extensions/1.0";
const SITE_BASE = "https://woocommerce.com";

export const woocommerceUrls = {
  base: `${SITE_BASE}/products`,

  /** Product detail page */
  app: (slug: string) => `${SITE_BASE}/products/${slug}/`,

  /** Category listing via search API with category filter */
  category: (categorySlug: string, page?: number) => {
    const params = new URLSearchParams({ category: categorySlug, per_page: "60" });
    if (page && page > 1) params.set("page", String(page));
    return `${API_BASE}/search?${params}`;
  },

  /** Keyword search via search API */
  search: (keyword: string, page?: number) => {
    const params = new URLSearchParams({ search: keyword, per_page: "60" });
    if (page && page > 1) params.set("page", String(page));
    return `${API_BASE}/search?${params}`;
  },

  /** All extensions (no filter) */
  all: (page?: number) => {
    const params = new URLSearchParams({ per_page: "60" });
    if (page && page > 1) params.set("page", String(page));
    return `${API_BASE}/search?${params}`;
  },

  /** Categories list */
  categories: () => `${API_BASE}/categories`,

  /** Featured sections */
  featured: () => `${API_BASE}/featured`,
} as const;
