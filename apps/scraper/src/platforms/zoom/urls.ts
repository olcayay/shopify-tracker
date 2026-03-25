const BASE_URL = "https://marketplace.zoom.us";
const API_BASE = `${BASE_URL}/api/v1`;
const CDN_URL = "https://marketplacecontent-cf.zoom.us";

export const zoomUrls = {
  base: BASE_URL,

  /** App detail page (human URL) */
  app: (slug: string) => `${BASE_URL}/apps/${slug}`,

  /** Category page (human URL) */
  category: (slug: string) => `${BASE_URL}/apps?category=${slug}`,

  /** Search page (human URL) */
  search: (keyword: string) => `${BASE_URL}/apps?q=${encodeURIComponent(keyword)}`,

  // --- API endpoints ---

  /** Filter apps by category via API */
  apiFilter: (category: string, pageNum = 1, pageSize = 100) =>
    `${API_BASE}/apps/filter?category=${encodeURIComponent(category)}&pageNum=${pageNum}&pageSize=${pageSize}`,

  /** Filter ALL apps (no category) via API — returns every app with pagination */
  apiFilterAll: (pageNum = 1, pageSize = 100) =>
    `${API_BASE}/apps/filter?pageNum=${pageNum}&pageSize=${pageSize}`,

  /** Search apps via API */
  apiSearch: (keyword: string, pageNum = 1, pageSize = 100) =>
    `${API_BASE}/apps/search?q=${encodeURIComponent(keyword)}&pageNum=${pageNum}&pageSize=${pageSize}`,

  /** Curated/featured collections preview (single call for all sections) */
  apiFeaturedPreview: () =>
    `${API_BASE}/curatedCategory/preview/excludeBanner`,

  /** Category list via API */
  apiCategories: () => `${API_BASE}/app_categories`,

  /** Build full icon URL from relative path (served via CloudFlare CDN).
   *  The S3 key must be passed as a single URL-encoded component (slashes → %2F). */
  iconUrl: (path: string) => path.startsWith("http") ? path : `${CDN_URL}/${encodeURIComponent(path)}`,
} as const;
