const BASE_URL = "https://marketplace.atlassian.com";
const API_BASE = `${BASE_URL}/rest/2`;

export const atlassianUrls = {
  base: BASE_URL,

  /** App detail page (human URL) */
  app: (slug: string) => `${BASE_URL}/apps/${slug}`,

  /** Category page (human URL — used for HTML scraping) */
  category: (slug: string) => `${BASE_URL}/categories/${slug}`,

  /** Search page (human URL) */
  search: (keyword: string) => `${BASE_URL}/search?query=${encodeURIComponent(keyword)}`,

  // --- API endpoints ---

  /** App details via REST API */
  apiAddon: (addonKey: string) => `${API_BASE}/addons/${addonKey}`,

  /** Search addons via REST API */
  apiSearch: (keyword: string, offset = 0, limit = 50) =>
    `${API_BASE}/addons?text=${encodeURIComponent(keyword)}&offset=${offset}&limit=${limit}`,

  /** Reviews via REST API */
  apiReviews: (addonKey: string, offset = 0, limit = 50) =>
    `${API_BASE}/addons/${addonKey}/reviews?offset=${offset}&limit=${limit}`,

  /** Featured collections via REST API */
  apiFeatured: (marketingLabel: string, offset = 0, limit = 50) =>
    `${API_BASE}/addons?marketingLabel=${encodeURIComponent(marketingLabel)}&offset=${offset}&limit=${limit}`,

  /** Latest version info via REST API */
  apiVersionLatest: (addonKey: string) => `${API_BASE}/addons/${addonKey}/versions/latest`,

  /** Vendor details via REST API */
  apiVendor: (vendorId: number | string) => `${API_BASE}/vendors/${vendorId}`,

  /** Pricing tiers via REST API */
  apiPricing: (addonKey: string, hosting = "cloud") =>
    `${API_BASE}/addons/${addonKey}/pricing/${hosting}/live`,
} as const;
