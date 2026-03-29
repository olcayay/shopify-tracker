import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://appranks.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Platform landing pages
  const platforms = [
    "shopify", "salesforce", "canva", "wix", "wordpress",
    "google-workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot",
  ];

  const platformPages: MetadataRoute.Sitemap = platforms.map((p) => ({
    url: `${BASE_URL}/${p}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Future: dynamic pages will be added here as public routes are created
  // - /apps/{platform}/{slug}
  // - /categories/{platform}/{slug}
  // - /developers/{platform}/{slug}

  return [...staticPages, ...platformPages];
}
