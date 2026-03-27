import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp, NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import { ZENDESK_CATEGORY_NAMES } from "../constants.js";

const log = createLogger("zendesk:html-parser");

/**
 * Parse a Zendesk Marketplace category listing page from rendered HTML.
 * Used as fallback when Algolia API is unavailable.
 *
 * The page is a Next.js app with app cards rendered as links containing
 * name, rating, icon, short description, and pricing info.
 */
export function parseCategoryHtml(
  html: string,
  categorySlug: string,
): NormalizedCategoryPage {
  const $ = cheerio.load(html);
  const apps = extractAppCards($);

  log.info("parsed category page from HTML (fallback)", {
    categorySlug,
    appsFound: apps.length,
  });

  return {
    slug: categorySlug,
    url: "",
    title: ZENDESK_CATEGORY_NAMES[categorySlug] || categorySlug,
    description: "",
    appCount: apps.length || null,
    apps: apps.map((a, idx) => ({ ...a, position: idx + 1 }) as NormalizedCategoryApp),
    subcategoryLinks: [],
    hasNextPage: false, // Can't determine from HTML
  };
}

/**
 * Parse a Zendesk Marketplace search results page from rendered HTML.
 * Used as fallback when Algolia API is unavailable.
 */
export function parseSearchHtml(
  html: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const $ = cheerio.load(html);
  const apps = extractAppCards($);

  log.info("parsed search page from HTML (fallback)", {
    keyword,
    appsFound: apps.length,
  });

  return {
    keyword,
    currentPage: page,
    apps: apps.map((a, idx) => ({
      appSlug: a.slug,
      appName: a.name,
      shortDescription: a.shortDescription,
      averageRating: a.averageRating,
      ratingCount: a.ratingCount,
      logoUrl: a.logoUrl,
      pricingHint: a.pricingHint,
      badges: a.badges,
      position: idx + 1,
      isSponsored: false,
    }) as NormalizedSearchApp),
    totalResults: apps.length || null,
    hasNextPage: false,
  };
}

/**
 * Extract app card data from Zendesk marketplace HTML.
 * Looks for links to /marketplace/apps/{product}/{id}/{slug}/ and extracts
 * visible metadata from surrounding elements.
 */
function extractAppCards($: cheerio.CheerioAPI): Array<{
  slug: string;
  name: string;
  shortDescription: string;
  averageRating: number;
  ratingCount: number;
  logoUrl: string;
  pricingHint?: string;
  badges: string[];
  externalId?: string;
}> {
  const apps: Array<{
    slug: string;
    name: string;
    shortDescription: string;
    averageRating: number;
    ratingCount: number;
    logoUrl: string;
    pricingHint?: string;
    badges: string[];
    externalId?: string;
  }> = [];
  const seen = new Set<string>();

  // Find all app card links
  $('a[href*="/marketplace/apps/"]').each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/\/marketplace\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/);
    if (!match) return;

    const product = match[1];
    const numericId = match[2];
    const textSlug = match[3];
    const slug = `${numericId}--${textSlug}`;

    if (seen.has(slug)) return;
    seen.add(slug);

    // Navigate up to the card container
    const card = $(el).closest('[class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"], li, article') || $(el);

    // Extract name — look for heading or strong text
    const name = card.find("h2, h3, h4, [class*='name'], [class*='Name'], [class*='title'], [class*='Title']").first().text().trim()
      || $(el).text().trim().split("\n")[0]?.trim()
      || textSlug.replace(/-/g, " ");

    // Extract icon
    const img = card.find("img").first();
    const logoUrl = img.attr("src") || img.attr("data-src") || "";

    // Extract short description
    const desc = card.find("p, [class*='description'], [class*='Description']").first().text().trim();

    // Extract rating
    const ratingText = card.find("[class*='rating'], [class*='Rating'], [class*='star'], [class*='Star']").text();
    const ratingMatch = ratingText.match(/([\d.]+)/);
    const averageRating = safeParseFloat(ratingMatch?.[1], 0)!;

    // Extract review count
    const countMatch = ratingText.match(/\((\d+)\)/);
    const ratingCount = countMatch ? parseInt(countMatch[1], 10) : 0;

    // Extract pricing
    const priceText = card.find("[class*='price'], [class*='Price'], [class*='pricing'], [class*='Pricing']").first().text().trim();

    apps.push({
      slug,
      name: name || textSlug,
      shortDescription: desc || "",
      averageRating,
      ratingCount,
      logoUrl,
      pricingHint: priceText || undefined,
      badges: [],
      externalId: product,
    });
  });

  return apps;
}
