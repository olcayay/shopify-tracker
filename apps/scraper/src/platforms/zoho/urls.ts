const BASE_URL = "https://marketplace.zoho.com";

export const zohoUrls = {
  base: BASE_URL,

  /** App detail page (human URL): /app/{service}/{namespace} */
  app: (slug: string) => `${BASE_URL}/app/${slug.replace("--", "/")}`,

  /** Category page (human URL): /app/{service} */
  category: (service: string) => `${BASE_URL}/app/${service}`,

  /** Search page (human URL): /search?searchTerm={keyword} */
  search: (keyword: string) => `${BASE_URL}/search?searchTerm=${encodeURIComponent(keyword)}`,
} as const;
