const BASE_URL = "https://workspace.google.com/marketplace";

export const googleWorkspaceUrls = {
  base: BASE_URL,

  /** App detail page (slug uses -- separator, convert to / for real URL) */
  app: (slug: string) => `${BASE_URL}/app/${slug.replace("--", "/")}`,

  /** Category page */
  category: (slug: string) => `${BASE_URL}/category/${slug.replace("--", "/")}`,

  /** Search page */
  search: (query: string) => `${BASE_URL}/search/${encodeURIComponent(query)}?flow_type=2`,
} as const;
