import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import type { ZendeskAlgoliaHit, ZendeskAlgoliaResult } from "./category-parser.js";

const log = createLogger("zendesk:search-parser");

/**
 * Parse Zendesk search results from Algolia API JSON response.
 */
export function parseZendeskSearchPage(
  json: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  let result: ZendeskAlgoliaResult;
  try {
    const parsed = JSON.parse(json);
    result = parsed.results?.[0] ?? parsed;
  } catch (e) {
    log.error("failed to parse Algolia search JSON", { keyword, error: String(e) });
    return { keyword, totalResults: null, apps: [], hasNextPage: false, currentPage: page };
  }

  const apps: NormalizedSearchApp[] = result.hits.map((hit: ZendeskAlgoliaHit, idx: number) => {
    const urlMatch = hit.url.match(/\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/);
    const numericId = urlMatch?.[2] ?? String(hit.id);
    const textSlug = urlMatch?.[3] ?? hit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return {
      position: idx + 1,
      appSlug: `${numericId}--${textSlug}`,
      appName: hit.name,
      shortDescription: hit.short_description || "",
      averageRating: hit.rating?.average ?? 0,
      ratingCount: hit.rating?.total_count ?? 0,
      logoUrl: hit.icon_url || "",
      isSponsored: false,
      badges: [],
    };
  });

  log.info("parsed search results (Algolia)", { keyword, appsFound: apps.length, totalHits: result.nbHits });

  return {
    keyword,
    totalResults: result.nbHits || apps.length || null,
    apps,
    hasNextPage: result.page < result.nbPages - 1,
    currentPage: page,
  };
}
