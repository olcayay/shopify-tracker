import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { zoomUrls } from "../urls.js";
import { ZOOM_CATEGORY_NAMES } from "../constants.js";

const log = createLogger("zoom:category-parser");

/**
 * Parse Zoom filter API JSON response into NormalizedCategoryPage.
 *
 * Source: GET /api/v1/apps/filter?category={slug}&pageNum=N&pageSize=100
 */
export function parseZoomCategoryPage(
  json: Record<string, any>,
  slug: string,
  page: number,
): NormalizedCategoryPage {
  const rawApps = json.apps || [];
  const total = json.total ?? null;
  const pageSize = json.pageSize || 100;

  const apps: NormalizedCategoryApp[] = rawApps.map(
    (app: Record<string, any>, idx: number) => {
      const ratingStats = app.ratingStatistics || {};
      const iconUrl = app.icon ? zoomUrls.iconUrl(app.icon) : "";

      const badges: string[] = [];
      if (app.fedRampAuthorized) badges.push("fedramp_authorized");
      if (app.essentialApp) badges.push("essential_app");

      return {
        slug: app.id || "",
        name: app.displayName || app.name || "",
        shortDescription: app.description || "",
        averageRating: ratingStats.averageRating ?? 0,
        ratingCount: ratingStats.totalRatings ?? 0,
        logoUrl: iconUrl,
        position: (page - 1) * pageSize + idx + 1,
        isSponsored: false,
        badges,
        extra: {
          companyName: app.companyName || undefined,
          worksWith: app.worksWith || undefined,
          usage: app.usage || undefined,
        },
      };
    },
  );

  const hasNextPage = rawApps.length >= pageSize && (total === null || page * pageSize < total);

  log.info("parsed category page", {
    slug,
    page,
    apps: apps.length,
    total,
    hasNextPage,
  });

  return {
    slug,
    url: zoomUrls.category(slug),
    title: ZOOM_CATEGORY_NAMES[slug] || slug,
    description: "",
    appCount: total,
    apps,
    subcategoryLinks: [], // Flat categories, no subcategories
    hasNextPage,
  };
}
