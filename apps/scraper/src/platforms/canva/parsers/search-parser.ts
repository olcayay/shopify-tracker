import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import { extractCanvaApps, type CanvaEmbeddedApp } from "./app-parser.js";

const log = createLogger("canva-search-parser");

const PAGE_SIZE = 30;

/** Cache extracted apps to avoid re-parsing the same HTML across pages */
let cachedHtmlLength = 0;
let cachedApps: CanvaEmbeddedApp[] = [];

function getApps(html: string): CanvaEmbeddedApp[] {
  if (html.length === cachedHtmlLength && cachedApps.length > 0) {
    return cachedApps;
  }
  cachedApps = extractCanvaApps(html);
  cachedHtmlLength = html.length;
  return cachedApps;
}

/**
 * Check if an app matches the keyword in any searchable field.
 */
function matchesKeyword(app: CanvaEmbeddedApp, lowerKeyword: string): boolean {
  return [
    app.name,
    app.shortDescription,
    app.tagline,
    app.developer,
    app.fullDescription,
  ].some((f) => (f || "").toLowerCase().includes(lowerKeyword));
}

/**
 * Parse search results for Canva by filtering embedded app data client-side.
 *
 * Canva embeds all ~1000+ apps as JSON in the /apps page. The embedded order
 * reflects Canva's internal popularity/quality ranking. We preserve this order
 * rather than applying our own relevance scoring, since Canva's ordering
 * incorporates signals (installs, usage) we don't have access to.
 *
 * Strategy: filter apps matching the keyword, keep original HTML order.
 */
export function parseCanvaSearchPage(
  html: string,
  keyword: string,
  page: number,
  _offset: number,
): NormalizedSearchPage {
  const apps = getApps(html);
  const lowerKeyword = keyword.toLowerCase();

  // Filter apps that match the keyword, preserve original HTML order
  // (which reflects Canva's popularity/quality ranking)
  const matching = apps.filter((app) => matchesKeyword(app, lowerKeyword));

  const totalResults = matching.length;
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageApps = matching.slice(startIdx, startIdx + PAGE_SIZE);
  const hasNextPage = startIdx + PAGE_SIZE < totalResults;

  log.info("search results", {
    keyword,
    page,
    totalResults,
    pageResults: pageApps.length,
    hasNextPage,
  });

  const normalizedApps: NormalizedSearchApp[] = pageApps.map((app, idx) => {
    const slug = app.urlSlug ? `${app.id}--${app.urlSlug}` : app.id;
    return {
      position: startIdx + idx + 1,
      appSlug: slug,
      appName: app.name,
      shortDescription: app.shortDescription || app.tagline,
      averageRating: 0,
      ratingCount: 0,
      logoUrl: app.iconUrl,
      isSponsored: false,
      badges: [],
      extra: {
        developer: app.developer,
        topics: app.topics,
      },
    };
  });

  return {
    keyword,
    totalResults,
    apps: normalizedApps,
    hasNextPage,
    currentPage: page,
  };
}
