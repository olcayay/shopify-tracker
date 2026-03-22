const BASE_URL = "https://www.zendesk.com/marketplace";

export const zendeskUrls = {
  base: BASE_URL,

  /** App detail page: /marketplace/apps/{product}/{id}/{slug}/ */
  app: (slug: string, product = "support") => {
    const [id, ...rest] = slug.split("--");
    const textSlug = rest.join("-");
    return `${BASE_URL}/apps/${product}/${id}/${textSlug}/`;
  },

  /** Category listing page: /marketplace/apps/?category={slug} */
  category: (categorySlug: string) => `${BASE_URL}/apps/?category=${categorySlug}`,

  /** Search page: /marketplace/apps/?query={keyword} */
  search: (keyword: string) => `${BASE_URL}/apps/?query=${encodeURIComponent(keyword)}`,

  /** Homepage (for featured sections): /marketplace/apps/ */
  homepage: () => `${BASE_URL}/apps/`,

  /** Review page (reviews are on the app detail page) */
  reviews: (slug: string, product = "support") => {
    const [id, ...rest] = slug.split("--");
    const textSlug = rest.join("-");
    return `${BASE_URL}/apps/${product}/${id}/${textSlug}/`;
  },
} as const;
