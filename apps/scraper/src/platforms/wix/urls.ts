const BASE_URL = "https://www.wix.com/app-market";

export const wixUrls = {
  base: BASE_URL,

  /** App detail page */
  app: (slug: string) => `${BASE_URL}/web-solution/${slug}`,

  /** Category page — compound slugs use -- separator, convert to / for URL */
  category: (slug: string) => `${BASE_URL}/category/${slug.replace("--", "/")}`,

  /** Search results page */
  search: (keyword: string) => `${BASE_URL}/search-result?query=${encodeURIComponent(keyword)}`,

  /** Autocomplete API (anonymous, no auth required) */
  autocomplete: (term: string) =>
    `https://www.wix.com/_serverless/app-market-search/autocomplete?term=${encodeURIComponent(term)}&lang=en`,
} as const;
