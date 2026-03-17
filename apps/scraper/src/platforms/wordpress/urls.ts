import { BROWSE_PREFIX } from "./constants.js";

const BASE_URL = "https://wordpress.org/plugins";
const API_BASE = "https://api.wordpress.org/plugins/info/1.2/";

export const wordpressUrls = {
  base: BASE_URL,

  /** Plugin detail page */
  plugin: (slug: string) => `${BASE_URL}/${slug}/`,

  /** Tag (category) page */
  tag: (tag: string) => `${BASE_URL}/tags/${tag}/`,

  /** Search page */
  search: (keyword: string) => `${BASE_URL}/search/${encodeURIComponent(keyword)}/`,

  /** Reviews page (HTML) */
  reviews: (slug: string, page?: number) => {
    const base = `https://wordpress.org/support/plugin/${slug}/reviews/`;
    return page && page > 1 ? `${base}page/${page}/` : base;
  },

  // --- API endpoints ---

  /** Search plugins via API */
  apiSearch: (keyword: string, page = 1, perPage = 250) =>
    `${API_BASE}?action=query_plugins&search=${encodeURIComponent(keyword)}&per_page=${perPage}&page=${page}`,

  /** Browse by tag via API */
  apiTag: (tag: string, page = 1, perPage = 250) =>
    `${API_BASE}?action=query_plugins&tag=${encodeURIComponent(tag)}&per_page=${perPage}&page=${page}`,

  /** Browse curated lists via API */
  apiBrowse: (type: string, page = 1, perPage = 250) =>
    `${API_BASE}?action=query_plugins&browse=${encodeURIComponent(type)}&per_page=${perPage}&page=${page}`,

  /** Full plugin details via API */
  apiPlugin: (slug: string) =>
    `${API_BASE}?action=plugin_information&slug=${encodeURIComponent(slug)}&fields=icons`,

  /** Resolve a category slug to the correct API URL.
   *  `_browse_popular` → apiBrowse("popular"), regular slugs → apiTag(slug) */
  apiCategory: (slug: string, page = 1, perPage = 250): string => {
    if (slug.startsWith(BROWSE_PREFIX)) {
      const browseType = slug.slice(BROWSE_PREFIX.length);
      return wordpressUrls.apiBrowse(browseType, page, perPage);
    }
    return wordpressUrls.apiTag(slug, page, perPage);
  },

  /** External (human-visible) URL for a category slug */
  categoryPage: (slug: string): string => {
    if (slug.startsWith(BROWSE_PREFIX)) {
      const browseType = slug.slice(BROWSE_PREFIX.length);
      return `${BASE_URL}/browse/${browseType}/`;
    }
    return wordpressUrls.tag(slug);
  },
} as const;
