const BASE_URL = "https://www.canva.com";

export const canvaUrls = {
  base: BASE_URL,

  /** Main apps marketplace page (all apps are embedded here) */
  apps: () => `${BASE_URL}/apps`,

  /** App detail page */
  app: (slug: string) => `${BASE_URL}/apps/${slug}`,

  /** External category URL (Canva doesn't have real category pages — this maps to the filter tab) */
  category: (slug: string) => `${BASE_URL}/apps?category=${slug}`,
} as const;
