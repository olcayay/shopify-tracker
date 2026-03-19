import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

const log = createLogger("zoho:search-parser");

/**
 * Parse a Zoho Marketplace search results page (SPA-rendered HTML via BrowserClient).
 *
 * Search URL: /search?searchTerm={keyword}
 * App links follow: /app/{service}/{namespace}
 * Slug format: {service}--{namespace}
 */
export function parseZohoSearchPage(
  html: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const $ = cheerio.load(html);
  const apps: NormalizedSearchApp[] = [];
  const appPattern = /\/app\/([^/]+)\/([^/?#]+)/;
  const seen = new Set<string>();

  $("a[href*='/app/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(appPattern);
    if (!match) return;

    const [, service, namespace] = match;
    const appSlug = `${service}--${namespace}`;

    if (seen.has(appSlug)) return;
    seen.add(appSlug);

    // Search cards: .default-card-wrapper → name in .f15.singleLineEllips or .secondComp title
    // Category featured cards: .featured-extnBanner → name in .fextn-tit
    // Category regular cards: .default-extension → name in .extnTitle-firstOff
    const searchCard = $(el).closest(".default-card-wrapper");
    const featuredCard = $(el).closest(".featured-extnBanner");
    const regularCard = $(el).closest(".default-extension");
    const card = searchCard.length ? searchCard
      : featuredCard.length ? featuredCard
      : regularCard.length ? regularCard
      : $(el).parent().parent().parent();

    const name =
      card.find(".f15.singleLineEllips").first().text().trim() ||
      card.find(".fextn-tit").first().text().trim() ||
      card.find(".extnTitle-firstOff").first().text().trim() ||
      card.find(".extnTitle-secOff").first().text().trim() ||
      card.find("img").first().attr("alt")?.trim() ||
      namespace;

    const shortDescription =
      card.find(".fextn-desc").first().text().trim() ||
      card.find(".secondComp .f14").first().text().trim() ||
      "";

    // Rating count from (N) pattern
    const ratingCountEl = card.find(".no-rating, .avgRating-count").first().text().trim();
    const ratingCountMatch = ratingCountEl.match(/(\d+)/);
    const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1], 10) : 0;

    // Count filled stars
    const starCount = card.find("a.colorF5A623, .rated.selectorIcon").length;
    const halfStar = card.find("span.colorF5A623, .floatedIcon").length;
    const averageRating = starCount > 0 ? Math.min(starCount + halfStar * 0.5, 5) : 0;

    const logoUrl =
      card.find("img").first().attr("src") ||
      card.find("img").first().attr("data-src") ||
      "";

    apps.push({
      position: apps.length + 1,
      appSlug,
      appName: name || namespace,
      shortDescription,
      averageRating,
      ratingCount,
      logoUrl,
      isSponsored: false,
      badges: [],
    });
  });

  log.info("parsed search page", { keyword, appsFound: apps.length });

  return {
    keyword,
    totalResults: apps.length || null,
    apps,
    hasNextPage: false, // SPA loads all results
    currentPage: page,
  };
}
