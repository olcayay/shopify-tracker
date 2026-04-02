import type { MetadataRoute } from "next";
import { PLATFORM_IDS } from "@appranks/shared";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://appranks.io";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ISR: regenerate sitemap every 6 hours
export const revalidate = 21600;

async function fetchJson(path: string): Promise<any> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 21600 } });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
  ];

  // Platform pages (trends, categories index)
  const platformPages: MetadataRoute.Sitemap = PLATFORM_IDS.flatMap((p) => [
    { url: `${BASE_URL}/trends/${p}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 },
  ]);

  // Dynamic category pages per platform
  const categoryPages: MetadataRoute.Sitemap = [];
  for (const platform of PLATFORM_IDS) {
    const cats = await fetchJson(`/api/public/categories/${platform}`);
    if (Array.isArray(cats)) {
      for (const cat of cats.filter((c: any) => c.isListingPage)) {
        categoryPages.push({
          url: `${BASE_URL}/categories/${platform}/${cat.slug}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.7,
        });
        // Best-of pages
        categoryPages.push({
          url: `${BASE_URL}/best/${platform}/${cat.slug}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  }

  return [...staticPages, ...platformPages, ...categoryPages];
}
