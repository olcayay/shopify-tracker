import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

const log = createLogger("hubspot:search-parser");

/**
 * Parse search results from CHIRP API search response.
 *
 * The CHIRP search API does not support text filtering — it returns all apps
 * sorted by install count. We apply client-side keyword matching on
 * listingName, description, and companyName.
 *
 * Input: JSON string from PersonalizationPublicRpc/search
 */
export function parseHubSpotSearchPage(
  json: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    log.warn("failed to parse search JSON", { keyword });
    return { keyword, totalResults: null, apps: [], hasNextPage: false, currentPage: page };
  }

  const cards: any[] = data?.data?.cards ?? [];

  // Client-side text filtering
  const keywords = keyword.toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = cards.filter((card: any) => {
    const name = (card.listingName || "").toLowerCase();
    const desc = (card.description || "").toLowerCase();
    const company = (card.companyName || "").toLowerCase();
    const slug = (card.slug || "").toLowerCase();
    return keywords.some(
      (kw) => name.includes(kw) || desc.includes(kw) || company.includes(kw) || slug.includes(kw),
    );
  });

  const apps: NormalizedSearchApp[] = filtered.map((card: any, idx: number) => ({
    position: idx + 1,
    appSlug: card.slug || "",
    appName: card.listingName || card.slug || "",
    shortDescription: card.description || "",
    averageRating: 0,
    ratingCount: 0,
    logoUrl: card.iconUrl || "",
    isSponsored: false,
    badges: [],
  }));

  log.info("parsed search results from CHIRP", {
    keyword,
    totalCards: cards.length,
    matched: apps.length,
  });

  return {
    keyword,
    totalResults: apps.length,
    apps,
    hasNextPage: false, // Client-side filtering returns all matches at once
    currentPage: page,
  };
}
