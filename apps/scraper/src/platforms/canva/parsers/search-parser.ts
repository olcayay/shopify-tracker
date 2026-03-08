import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

const log = createLogger("canva-search-parser");

const PAGE_SIZE = 100;

/**
 * Canva search API response shape (combined from all pages).
 *
 * Field mapping (minified keys):
 *   A = total result count
 *   C = results array (all pages merged)
 *     C[].A = app ID
 *     C[].B = app name
 *     C[].C = short description
 *     C[].D = icon URL
 */
interface CanvaSearchResponse {
  A: number;
  B?: string | null;
  C: CanvaSearchResultApp[];
}

interface CanvaSearchResultApp {
  A: string;
  B: string;
  C?: string;
  D?: string;
}

/**
 * Parse Canva search API JSON response into normalized format.
 *
 * The response comes from Canva's Elasticsearch-backed search API,
 * which returns results in the exact order users see them on canva.com.
 *
 * All pages are already merged by CanvaModule, so we paginate locally.
 */
export function parseCanvaSearchPage(
  json: string,
  keyword: string,
  page: number,
  _offset: number,
): NormalizedSearchPage & { _cursor?: string | null } {
  let data: CanvaSearchResponse;
  try {
    data = JSON.parse(json);
  } catch (e) {
    log.error("failed to parse search response JSON", { keyword, page, error: String(e) });
    return { keyword, totalResults: 0, apps: [], hasNextPage: false, currentPage: page };
  }

  const totalResults = data.A || 0;
  const allResults = data.C || [];

  // Paginate locally (all results already fetched)
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageResults = allResults.slice(startIdx, startIdx + PAGE_SIZE);
  const hasNextPage = startIdx + PAGE_SIZE < allResults.length;

  log.info("search results", {
    keyword,
    page,
    totalResults,
    totalFetched: allResults.length,
    pageResults: pageResults.length,
    hasNextPage,
  });

  const normalizedApps: NormalizedSearchApp[] = pageResults.map((app, idx) => {
    const urlSlug = app.B
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = urlSlug ? `${app.A}--${urlSlug}` : app.A;

    return {
      position: startIdx + idx + 1,
      appSlug: slug,
      appName: app.B,
      shortDescription: app.C || "",
      averageRating: 0,
      ratingCount: 0,
      logoUrl: app.D || "",
      isSponsored: false,
      badges: [],
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
