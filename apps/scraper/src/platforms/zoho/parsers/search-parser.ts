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

    const card = $(el).closest("[class*='card'], [class*='extension'], [class*='app-item'], [class*='listing'], li, article") || $(el);

    const name =
      card.find("h3, h4, .extension-name, .app-name, .name").first().text().trim() ||
      $(el).text().trim() ||
      namespace;

    const shortDescription =
      card.find(".description, .tagline, .short-desc, p").first().text().trim() || "";

    const ratingText = card.find(".rating, .avg-rating, [class*='rating']").first().text().trim();
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    const rawRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    const averageRating = rawRating > 0 && rawRating <= 5 ? rawRating : 0;

    const ratingCountText = card.find(".rating-count, .review-count, [class*='count']").first().text().trim();
    const ratingCountMatch = ratingCountText.match(/(\d+)/);
    const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1], 10) : 0;

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
