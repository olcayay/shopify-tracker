import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://appranks.io";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/apps/",
          "/categories/",
          "/developers/",
          "/compare/",
          "/best/",
          "/trends/",
          "/insights/",
          "/keywords/",
        ],
        disallow: [
          "/settings",
          "/system-admin",
          "/api/",
          "/login",
          "/register",
          "/invite/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
