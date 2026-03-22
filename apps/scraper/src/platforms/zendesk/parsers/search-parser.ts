import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

const log = createLogger("zendesk:search-parser");

/**
 * Parse a Zendesk Marketplace search results page (rendered HTML via BrowserClient).
 *
 * Search URL: /marketplace/apps/?query={keyword}
 * App links follow: /marketplace/apps/{product}/{numericId}/{text-slug}/
 * Slug format: {numericId}--{text-slug}
 */
export function parseZendeskSearchPage(
  html: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const $ = cheerio.load(html);
  const apps: NormalizedSearchApp[] = [];
  const appPattern = /\/marketplace\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/;
  const seen = new Set<string>();

  $("a[href*='/marketplace/apps/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(appPattern);
    if (!match) return;

    const [, _product, numericId, textSlug] = match;
    if (!numericId) return;

    const appSlug = `${numericId}--${textSlug}`;

    if (seen.has(appSlug)) return;
    seen.add(appSlug);

    const card = $(el).closest("[class*='card'], [class*='Card'], [class*='app-item'], [class*='AppItem'], [class*='listing'], li, article")
      .first();
    const container = card.length ? card : $(el).parent().parent();

    const name = container.find("h2, h3, h4, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']").first().text().trim()
      || textSlug.replace(/-/g, " ");

    const shortDescription = container.find("[class*='description'], [class*='subtitle'], [class*='Description']").first().text().trim() || "";

    // Rating
    const ratingEl = container.find("[class*='rating'], [class*='stars'], [class*='Rating']").first();
    const ratingText = ratingEl.attr("data-rating") || ratingEl.text().trim();
    const ratingMatch = ratingText?.match(/([\d.]+)/);
    const averageRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

    // Rating count
    const countText = container.find("[class*='review-count'], [class*='reviewCount'], [class*='count']").first().text().trim();
    const countMatch = countText?.match(/(\d[\d,]*)/);
    const ratingCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;

    // Logo
    const logoUrl = container.find("img").first().attr("src") || container.find("img").first().attr("data-src") || "";

    apps.push({
      position: apps.length + 1,
      appSlug,
      appName: name,
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
    hasNextPage: false,
    currentPage: page,
  };
}
