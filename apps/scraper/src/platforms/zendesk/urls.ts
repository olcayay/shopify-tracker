import { ZENDESK_CATEGORY_NAMES } from "./constants.js";

const BASE_URL = "https://www.zendesk.com/marketplace";

export const zendeskUrls = {
  base: BASE_URL,

  /** App detail page: /marketplace/apps/{product}/{id}/{slug}/ */
  app: (slug: string, product = "support") => {
    const [id, ...rest] = slug.split("--");
    const textSlug = rest.join("-");
    return `${BASE_URL}/apps/${product}/${id}/${textSlug}/`;
  },

  /** Category listing page: /marketplace/apps/?categories.name={Display Name} */
  category: (categorySlug: string, page?: number) => {
    const displayName = ZENDESK_CATEGORY_NAMES[categorySlug] || categorySlug;
    const encoded = encodeURIComponent(displayName).replace(/%20/g, "+");
    if (page && page > 1) {
      return `${BASE_URL}/apps/?page=${page}&categories.name=${encoded}`;
    }
    return `${BASE_URL}/apps/?categories.name=${encoded}`;
  },

  /** Search page: /marketplace/apps/?query={keyword} */
  search: (keyword: string) => `${BASE_URL}/apps/?query=${encodeURIComponent(keyword)}`,

  /** Homepage (for featured sections): /marketplace/apps/ */
  homepage: () => `${BASE_URL}/apps/`,

  /** Review API endpoint */
  reviews: (slug: string, _product = "support") => {
    const [id] = slug.split("--");
    return `https://marketplace.zendesk.com/api/v2/apps/${id}/reviews.json`;
  },
} as const;
