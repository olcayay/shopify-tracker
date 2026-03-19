import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import { zoomUrls } from "../urls.js";

const log = createLogger("zoom:search-parser");

/**
 * Parse Zoom search API JSON response into NormalizedSearchPage.
 *
 * Source: GET /api/v1/apps/search?q={keyword}&pageNum=N&pageSize=100
 */
export function parseZoomSearchPage(
  json: Record<string, any>,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const rawApps = json.apps || [];
  const total = json.total ?? null;
  const pageSize = json.pageSize || 100;

  const apps: NormalizedSearchApp[] = rawApps.map(
    (app: Record<string, any>, idx: number) => {
      const ratingStats = app.ratingStatistics || {};
      const iconUrl = app.icon ? zoomUrls.iconUrl(app.icon) : "";

      const badges: string[] = [];
      if (app.fedRampAuthorized) badges.push("fedramp_authorized");
      if (app.essentialApp) badges.push("essential_app");

      return {
        position: (page - 1) * pageSize + idx + 1,
        appSlug: app.id || "",
        appName: app.displayName || app.name || "",
        shortDescription: app.description || "",
        averageRating: ratingStats.averageRating ?? 0,
        ratingCount: ratingStats.totalRatings ?? 0,
        logoUrl: iconUrl,
        isSponsored: false,
        badges,
        extra: {
          companyName: app.companyName || undefined,
          worksWith: app.worksWith || undefined,
        },
      };
    },
  );

  const hasNextPage = rawApps.length >= pageSize && (total === null || page * pageSize < total);

  log.info("parsed search page", {
    keyword,
    page,
    apps: apps.length,
    total,
    hasNextPage,
  });

  return {
    keyword,
    totalResults: total,
    apps,
    hasNextPage,
    currentPage: page,
  };
}
