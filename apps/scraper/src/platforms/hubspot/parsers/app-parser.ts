import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("hubspot:app-parser");

/**
 * Parse a HubSpot App Marketplace app detail page (rendered HTML via BrowserClient).
 *
 * HubSpot is a pure SPA — no SSR, no embedded JSON — so we parse the fully-rendered
 * React DOM using CSS selectors. The page is rendered by Playwright.
 *
 * URL format: /marketplace/listing/{slug}
 */
export function parseHubSpotAppDetails(html: string, slug: string): NormalizedAppDetails {
  const $ = cheerio.load(html);

  // Try JSON-LD structured data first
  const jsonLd = extractJsonLd($);
  if (jsonLd) {
    log.info("parsed app from JSON-LD", { slug });
    return buildFromJsonLd(jsonLd, $, slug);
  }

  // Fallback: DOM parsing
  log.info("parsing app from DOM selectors", { slug });
  return parseFromDom($, slug);
}

function extractJsonLd($: cheerio.CheerioAPI): any {
  let result: any = null;
  $('script[type="application/ld+json"]').each((_i, el) => {
    if (result) return;
    try {
      const data = JSON.parse($(el).html() || "");
      if (data["@type"] === "SoftwareApplication" || data["@type"] === "WebApplication") {
        result = data;
      }
    } catch { /* ignore */ }
  });
  return result;
}

function buildFromJsonLd(data: any, $: cheerio.CheerioAPI, slug: string): NormalizedAppDetails {
  const rating = data.aggregateRating;
  return {
    name: data.name || slug,
    slug,
    averageRating: rating?.ratingValue ? Number(rating.ratingValue) : null,
    ratingCount: rating?.ratingCount ? Number(rating.ratingCount) : null,
    pricingHint: extractPricing($),
    iconUrl: data.image || extractIconUrl($),
    developer: data.author ? {
      name: typeof data.author === "string" ? data.author : data.author.name || "",
      url: typeof data.author === "object" ? data.author.url : undefined,
    } : extractDeveloper($),
    badges: [],
    platformData: {
      shortDescription: data.description || extractShortDescription($),
      longDescription: extractLongDescription($),
      pricing: extractPricing($),
      version: data.softwareVersion || null,
      categories: extractCategories($),
      source: "json-ld",
    },
  };
}

function parseFromDom($: cheerio.CheerioAPI, slug: string): NormalizedAppDetails {
  // App name — typically in an h1
  const name = $("h1").first().text().trim() || slug;

  // Rating
  const ratingText = $(
    "[class*='rating'] [class*='average'], [class*='stars'] [class*='value'], " +
    "[data-rating], [class*='Rating']"
  ).first().text().trim()
    || $("[class*='rating']").first().attr("data-rating");
  const avgRating = ratingText ? parseFloat(ratingText) : null;

  // Rating count
  let ratingCount: number | null = null;
  const reviewCountText = $(
    "[class*='review-count'], [class*='rating-count'], [class*='reviewCount'], " +
    "[class*='ReviewCount'], [class*='reviews']"
  ).first().text().trim();
  if (reviewCountText) {
    const m = reviewCountText.match(/(\d[\d,]*)/);
    if (m) ratingCount = parseInt(m[1].replace(/,/g, ""), 10);
  }

  return {
    name,
    slug,
    averageRating: avgRating && !isNaN(avgRating) ? avgRating : null,
    ratingCount,
    pricingHint: extractPricing($),
    iconUrl: extractIconUrl($),
    developer: extractDeveloper($),
    badges: [],
    platformData: {
      shortDescription: extractShortDescription($),
      longDescription: extractLongDescription($),
      pricing: extractPricing($),
      categories: extractCategories($),
      source: "dom-fallback",
    },
  };
}

// --- Helper extractors ---

function extractIconUrl($: cheerio.CheerioAPI): string | null {
  return $(
    "[class*='app-icon'] img, [class*='app-logo'] img, " +
    "[class*='AppIcon'] img, [class*='listing-icon'] img, " +
    "[class*='ListingIcon'] img"
  ).first().attr("src")
    || $("img[alt*='logo']").first().attr("src")
    || null;
}

function extractDeveloper($: cheerio.CheerioAPI): { name: string; url?: string } | null {
  const devEl = $(
    "[class*='developer'], [class*='author'], [class*='partner'], " +
    "[class*='Developer'], [class*='Author'], [class*='Partner']"
  ).first();
  const name = devEl.find("a").first().text().trim() || devEl.text().trim();
  if (!name) return null;
  const url = devEl.find("a").first().attr("href") || undefined;
  return { name, url };
}

function extractPricing($: cheerio.CheerioAPI): string | null {
  return $(
    "[class*='price'], [class*='pricing'], [class*='Price'], [class*='Pricing']"
  ).first().text().trim() || null;
}

function extractShortDescription($: cheerio.CheerioAPI): string | null {
  return $(
    "[class*='subtitle'], [class*='tagline'], [class*='short-description'], " +
    "[class*='ShortDescription'], [class*='Tagline']"
  ).first().text().trim() || null;
}

function extractLongDescription($: cheerio.CheerioAPI): string | null {
  return $(
    "[class*='description'], [class*='long-description'], " +
    "[class*='LongDescription'], [class*='app-details'], [class*='AppDetails']"
  ).first().text().trim() || null;
}

function extractCategories($: cheerio.CheerioAPI): Array<{ slug: string; name?: string }> {
  const cats: Array<{ slug: string; name?: string }> = [];
  // Look for category links matching HubSpot's URL pattern
  $("a[href*='/marketplace/apps/']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/\/marketplace\/apps\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)/);
    if (m) {
      const slug = m[1].replace("/", "--");
      const name = $(el).text().trim() || undefined;
      if (slug && !slug.includes("?")) {
        cats.push({ slug, name });
      }
    }
  });
  return cats;
}
