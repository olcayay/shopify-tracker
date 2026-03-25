import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";

const log = createLogger("hubspot:search-parser");

/**
 * Parse HubSpot App Marketplace search results page (rendered HTML via BrowserClient).
 *
 * HubSpot is a pure SPA — we parse the fully-rendered React DOM.
 * URL format: /marketplace/explore?query={keyword}
 */
export function parseHubSpotSearchPage(
  html: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const $ = cheerio.load(html);

  const apps: NormalizedSearchApp[] = [];

  // Look for app cards/tiles in search results
  const appCards = $(
    "[class*='app-card'], [class*='AppCard'], [class*='listing-card'], " +
    "[class*='ListingCard'], [class*='result-card'], [class*='ResultCard'], " +
    "[class*='app-tile'], [class*='AppTile']"
  );

  if (appCards.length > 0) {
    appCards.each((idx, el) => {
      const card = $(el);
      const app = extractSearchApp($, card, idx + 1);
      if (app) apps.push(app);
    });
  } else {
    // Fallback: find app listing links
    const seenSlugs = new Set<string>();
    $("a[href*='/marketplace/listing/']").each((_i, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/\/marketplace\/listing\/([^/?#]+)/);
      if (m && !seenSlugs.has(m[1])) {
        seenSlugs.add(m[1]);
        const container = $(el).closest("[class*='card'], [class*='Card'], li, article, [class*='item'], [class*='Item']");
        const appName = container.find("h3, h4, [class*='name'], [class*='Name']").first().text().trim()
          || $(el).text().trim()
          || m[1];
        apps.push({
          position: apps.length + 1,
          appSlug: m[1],
          appName,
          shortDescription: container.find("p, [class*='description']").first().text().trim() || "",
          averageRating: 0,
          ratingCount: 0,
          logoUrl: container.find("img").first().attr("src") || "",
          isSponsored: false,
          badges: [],
        });
      }
    });
  }

  // Extract total results count
  const totalText = $("[class*='total'], [class*='count'], [class*='results'], [class*='Results']").first().text();
  const totalMatch = totalText.match(/(\d[\d,]*)/);
  const totalResults = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : null;

  // Check for next page
  const hasNextPage = !!$("a[href*='page='], [class*='next'], [class*='Next']").length
    && apps.length >= 20;

  log.info("parsed search results", { keyword, appsFound: apps.length, totalResults });

  return {
    keyword,
    totalResults: totalResults || apps.length || null,
    apps,
    hasNextPage,
    currentPage: page,
  };
}

function extractSearchApp(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<any>,
  position: number,
): NormalizedSearchApp | null {
  const link = card.find("a[href*='/marketplace/listing/']").first();
  const href = link.attr("href") || "";
  const slugMatch = href.match(/\/marketplace\/listing\/([^/?#]+)/);
  if (!slugMatch) return null;

  const appSlug = slugMatch[1];
  const appName = card.find("h3, h4, [class*='name'], [class*='Name'], [class*='title'], [class*='Title']").first().text().trim()
    || link.text().trim()
    || appSlug;

  // Rating
  const ratingText = card.find("[class*='rating'], [class*='Rating']").first().text().trim();
  const ratingMatch = ratingText.match(/([\d.]+)/);

  // Rating count
  const countText = card.find("[class*='review'], [class*='Review'], [class*='count'], [class*='Count']").first().text().trim();
  const countMatch = countText.match(/(\d[\d,]*)/);

  return {
    position,
    appSlug,
    appName,
    shortDescription: card.find("[class*='description'], [class*='Description'], p").first().text().trim() || "",
    averageRating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
    ratingCount: countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0,
    logoUrl: card.find("img").first().attr("src") || "",
    isSponsored: false,
    badges: [],
  };
}
