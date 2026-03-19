import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { ZOHO_CATEGORY_NAMES } from "../constants.js";

const log = createLogger("zoho:category-parser");

/**
 * Parse a Zoho Marketplace category page (SPA-rendered HTML via BrowserClient).
 *
 * Category pages list extensions for a specific Zoho product (e.g., CRM, Desk).
 * The page is a SPA so we need rendered HTML from Playwright.
 *
 * App links follow the pattern: /app/{service}/{namespace}
 * We build slugs as: {service}--{namespace}
 */
export function parseZohoCategoryPage(
  html: string,
  categorySlug: string,
  url: string,
): NormalizedCategoryPage {
  const $ = cheerio.load(html);
  const apps: NormalizedCategoryApp[] = [];

  // Find all app links matching /app/{service}/{namespace}
  const appPattern = /\/app\/([^/]+)\/([^/?#]+)/;
  const seen = new Set<string>();

  $("a[href*='/app/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(appPattern);
    if (!match) return;

    const [, service, namespace] = match;
    const appSlug = `${service}--${namespace}`;

    // Deduplicate
    if (seen.has(appSlug)) return;
    seen.add(appSlug);

    // Walk up to find the card container for this link
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
      slug: appSlug,
      name: name || namespace,
      shortDescription,
      averageRating,
      ratingCount,
      logoUrl,
      position: apps.length + 1,
      isSponsored: false,
      badges: [],
    });
  });

  const title = ZOHO_CATEGORY_NAMES[categorySlug] ||
    $("h1").first().text().trim() ||
    categorySlug;

  log.info("parsed category page", {
    category: categorySlug,
    appsFound: apps.length,
  });

  return {
    slug: categorySlug,
    url,
    title,
    description: "",
    appCount: apps.length || null,
    apps,
    subcategoryLinks: [], // Flat structure, no subcategories
    hasNextPage: false, // SPA loads all extensions on one page
  };
}
