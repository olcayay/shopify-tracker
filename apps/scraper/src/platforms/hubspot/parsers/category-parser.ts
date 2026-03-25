import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";

const log = createLogger("hubspot:category-parser");

/**
 * Parse a HubSpot App Marketplace category page (rendered HTML via BrowserClient).
 *
 * HubSpot is a pure SPA — we parse the fully-rendered React DOM.
 * URL format: /marketplace/apps/{slug} or /marketplace/apps/{parent}/{child}
 */
export function parseHubSpotCategoryPage(
  html: string,
  categorySlug: string,
  url: string,
): NormalizedCategoryPage {
  const $ = cheerio.load(html);

  // Extract app cards from the rendered page
  const apps: NormalizedCategoryApp[] = [];

  // Try common patterns for app cards/tiles in the category listing
  const appCards = $(
    "[class*='app-card'], [class*='AppCard'], [class*='listing-card'], " +
    "[class*='ListingCard'], [class*='result-card'], [class*='ResultCard'], " +
    "[class*='app-tile'], [class*='AppTile']"
  );

  if (appCards.length > 0) {
    appCards.each((idx, el) => {
      const card = $(el);
      const app = extractAppFromCard($, card, idx + 1);
      if (app) apps.push(app);
    });
  } else {
    // Fallback: look for links to /marketplace/listing/{slug}
    const seenSlugs = new Set<string>();
    $("a[href*='/marketplace/listing/']").each((_idx, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/\/marketplace\/listing\/([^/?#]+)/);
      if (m && !seenSlugs.has(m[1])) {
        seenSlugs.add(m[1]);
        const card = $(el).closest("[class*='card'], [class*='Card'], li, article, [class*='item'], [class*='Item']");
        const appData = extractAppFromContainer($, card.length ? card : $(el), apps.length + 1, m[1]);
        if (appData) apps.push(appData);
      }
    });
  }

  // Extract total count if available
  const totalText = $("[class*='total'], [class*='count'], [class*='results']").first().text();
  const totalMatch = totalText.match(/(\d[\d,]*)/);
  const appCount = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : null;

  // Check for pagination / next page
  const hasNextPage = !!$("a[href*='page='], [class*='next'], [class*='Next'], [class*='pagination'] a").last().length
    && apps.length >= 20;

  // Extract category title from page heading
  const title = $("h1").first().text().trim()
    || categorySlug.split("--").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" > ");

  log.info("parsed category page", { categorySlug, appsFound: apps.length, appCount, hasNextPage });

  return {
    slug: categorySlug,
    url,
    title,
    description: "",
    appCount,
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}

function extractAppFromCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<any>,
  position: number,
): NormalizedCategoryApp | null {
  const link = card.find("a[href*='/marketplace/listing/']").first();
  const href = link.attr("href") || "";
  const slugMatch = href.match(/\/marketplace\/listing\/([^/?#]+)/);
  if (!slugMatch) return null;

  const slug = slugMatch[1];
  const name = card.find("h3, h4, [class*='name'], [class*='Name'], [class*='title'], [class*='Title']").first().text().trim()
    || link.text().trim()
    || slug;

  // Rating
  const ratingText = card.find("[class*='rating'], [class*='Rating'], [class*='stars'], [class*='Stars']").first().text().trim();
  const ratingMatch = ratingText.match(/([\d.]+)/);
  const averageRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Rating count
  const countText = card.find("[class*='review'], [class*='Review'], [class*='count'], [class*='Count']").first().text().trim();
  const countMatch = countText.match(/(\d[\d,]*)/);
  const ratingCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;

  // Icon
  const logoUrl = card.find("img").first().attr("src") || "";

  // Short description
  const shortDescription = card.find("[class*='description'], [class*='Description'], p").first().text().trim() || "";

  return {
    position,
    slug,
    name,
    averageRating: !isNaN(averageRating) ? averageRating : 0,
    ratingCount,
    logoUrl,
    shortDescription,
    isSponsored: false,
    badges: [],
  };
}

function extractAppFromContainer(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<any>,
  position: number,
  slug: string,
): NormalizedCategoryApp | null {
  const name = container.find("h3, h4, [class*='name'], [class*='Name']").first().text().trim()
    || container.text().trim().split("\n")[0]?.trim()
    || slug;

  const logoUrl = container.find("img").first().attr("src") || "";

  return {
    position,
    slug,
    name,
    averageRating: 0,
    ratingCount: 0,
    logoUrl,
    shortDescription: "",
    isSponsored: false,
    badges: [],
  };
}
