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
    // Featured cards: .featured-extnBanner → name in .fextn-tit
    // Regular cards: .extension_banner (per-card) → name in .extnTitle-firstOff or img[alt]
    // Note: .default-extension wraps ALL regular cards — do NOT use as card selector
    const featuredCard = $(el).closest(".featured-extnBanner");
    const regularCard = $(el).closest(".extension_banner");
    const card = featuredCard.length ? featuredCard : regularCard.length ? regularCard : $(el).parent().parent();

    const name =
      card.find(".fextn-tit").first().text().trim() ||
      card.find(".extnTitle-firstOff").first().text().trim() ||
      card.find(".extnTitle-secOff").first().text().trim() ||
      card.find("img").first().attr("alt")?.trim() ||
      namespace;

    const shortDescription =
      card.find(".fextn-desc").first().text().trim() ||
      card.find(".extension_secondOff .extnTitle-pricing + div").first().text().trim() ||
      "";

    // Rating count from (.avgRating-count) e.g. "(36)" or star count
    const ratingCountEl = card.find(".avgRating-count").first().text().trim();
    const ratingCountMatch = ratingCountEl.match(/(\d+)/);
    const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1], 10) : 0;

    // Count filled stars for average rating
    const starCount = card.find(".avgRating .rated.selectorIcon, .fRatingUser .rated.selectorIcon").length;
    const halfStar = card.find(".avgRating .floatedIcon, .fRatingUser .floatedIcon").length;
    const averageRating = starCount > 0 ? Math.min(starCount + halfStar * 0.5, 5) : 0;

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
