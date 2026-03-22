import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { ZENDESK_CATEGORY_NAMES } from "../constants.js";

const log = createLogger("zendesk:category-parser");

/**
 * Parse a Zendesk Marketplace category page (rendered HTML via BrowserClient).
 *
 * Category URL: /marketplace/apps/?category={slug}
 * App links follow: /marketplace/apps/{product}/{numericId}/{text-slug}/
 * Slug format: {numericId}--{text-slug}
 */
export function parseZendeskCategoryPage(
  html: string,
  categorySlug: string,
  url: string,
): NormalizedCategoryPage {
  const $ = cheerio.load(html);
  const apps: NormalizedCategoryApp[] = [];

  // App link pattern: /marketplace/apps/{product}/{numericId}/{text-slug}/
  const appPattern = /\/marketplace\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/;
  const seen = new Set<string>();

  $("a[href*='/marketplace/apps/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(appPattern);
    if (!match) return;

    const [, product, numericId, textSlug] = match;
    // Skip non-app links (category links, generic pages)
    if (!numericId) return;

    const appSlug = `${numericId}--${textSlug}`;

    // Deduplicate
    if (seen.has(appSlug)) return;
    seen.add(appSlug);

    // Walk up to find card container
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

    // Pricing
    const pricingHint = container.find("[class*='price'], [class*='Price'], [class*='pricing']").first().text().trim() || undefined;

    apps.push({
      slug: appSlug,
      name,
      shortDescription,
      averageRating,
      ratingCount,
      logoUrl,
      pricingHint,
      position: apps.length + 1,
      isSponsored: false,
      badges: [],
      externalId: product, // Store product type (support/chat/sell) for URL reconstruction
    });
  });

  const title = ZENDESK_CATEGORY_NAMES[categorySlug]
    || $("h1").first().text().trim()
    || categorySlug;

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
    subcategoryLinks: [], // Flat structure
    hasNextPage: false, // Initial implementation — pagination TBD
  };
}
