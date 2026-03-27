import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("zendesk:app-parser");

/**
 * Parse a Zendesk Marketplace app detail page (rendered HTML via BrowserClient).
 *
 * The page is behind Cloudflare, so we receive rendered HTML from Playwright.
 * URL format: /marketplace/apps/{product}/{numericId}/{text-slug}/
 * Slug format: {numericId}--{text-slug}
 *
 * The page may contain embedded JSON-LD or __NEXT_DATA__ — try those first,
 * then fall back to DOM selectors.
 */
export function parseZendeskAppDetails(html: string, slug: string): NormalizedAppDetails {
  const $ = cheerio.load(html);

  // Try to extract structured data (JSON-LD)
  const jsonLd = extractJsonLd($);
  if (jsonLd) {
    log.info("parsed app from JSON-LD", { slug });
    return buildFromJsonLd(jsonLd, $, slug);
  }

  // Try __NEXT_DATA__ or similar embedded JSON
  const nextData = extractNextData($);
  if (nextData) {
    log.info("parsed app from __NEXT_DATA__", { slug });
    return buildFromNextData(nextData, $, slug);
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

function extractNextData($: cheerio.CheerioAPI): any {
  const el = $("#__NEXT_DATA__");
  if (!el.length) return null;
  try {
    return JSON.parse(el.html() || "");
  } catch {
    return null;
  }
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
      datePublished: data.datePublished || null,
      version: data.softwareVersion || null,
      categories: extractCategories($),
      products: extractProducts($),
      source: "json-ld",
    },
  };
}

function buildFromNextData(data: any, $: cheerio.CheerioAPI, slug: string): NormalizedAppDetails {
  // Navigate through the __NEXT_DATA__ structure to find app data
  const pageProps = data?.props?.pageProps;
  const app = pageProps?.app || pageProps?.data?.app || pageProps;

  return {
    name: app?.name || $("h1").first().text().trim() || slug,
    slug,
    averageRating: app?.rating?.average ? Number(app.rating.average) : null,
    ratingCount: app?.rating?.count ? Number(app.rating.count) : null,
    pricingHint: app?.pricing || extractPricing($),
    iconUrl: app?.icon || app?.iconUrl || extractIconUrl($),
    developer: app?.author ? {
      name: app.author.name || app.author,
      url: app.author.url || undefined,
      website: app.author.website || undefined,
    } : extractDeveloper($),
    badges: [],
    platformData: {
      shortDescription: app?.shortDescription || extractShortDescription($),
      longDescription: app?.longDescription || extractLongDescription($),
      installationInstructions: app?.installationInstructions || null,
      pricing: app?.pricing || extractPricing($),
      datePublished: app?.datePublished || null,
      version: app?.version || null,
      categories: app?.categories || extractCategories($),
      products: app?.products || extractProducts($),
      source: "next-data",
    },
  };
}

function parseFromDom($: cheerio.CheerioAPI, slug: string): NormalizedAppDetails {
  // App name — typically in an h1
  const name = $("h1").first().text().trim() || slug;

  // Rating
  const ratingText = $("[class*='rating'] [class*='average'], [class*='stars'] [class*='value'], [data-rating]").first().text().trim()
    || $("[class*='rating']").first().attr("data-rating");
  const avgRating = safeParseFloat(ratingText);

  // Rating count — look for "(N reviews)" or "(N)" patterns
  let ratingCount: number | null = null;
  const reviewCountText = $("[class*='review-count'], [class*='rating-count'], [class*='reviewCount']").first().text().trim();
  if (reviewCountText) {
    const m = reviewCountText.match(/(\d[\d,]*)/);
    if (m) ratingCount = parseInt(m[1].replace(/,/g, ""), 10);
  }

  // Icon URL
  const iconUrl = extractIconUrl($);

  // Developer
  const developer = extractDeveloper($);

  // Pricing
  const pricingHint = extractPricing($);

  return {
    name,
    slug,
    averageRating: avgRating && !isNaN(avgRating) ? avgRating : null,
    ratingCount,
    pricingHint,
    iconUrl,
    developer,
    badges: [],
    platformData: {
      shortDescription: extractShortDescription($),
      longDescription: extractLongDescription($),
      pricing: pricingHint,
      categories: extractCategories($),
      products: extractProducts($),
      source: "dom-fallback",
    },
  };
}

// --- Helper extractors ---

function extractIconUrl($: cheerio.CheerioAPI): string | null {
  // Look for app icon/logo in common containers
  return $("[class*='app-icon'] img, [class*='app-logo'] img, [class*='AppIcon'] img, [class*='listing-icon'] img").first().attr("src")
    || $("img[alt*='logo']").first().attr("src")
    || null;
}

function extractDeveloper($: cheerio.CheerioAPI): { name: string; url?: string } | null {
  const devEl = $("[class*='developer'], [class*='author'], [class*='partner'], [class*='Developer']").first();
  const name = devEl.find("a").first().text().trim() || devEl.text().trim();
  if (!name) return null;
  const url = devEl.find("a").first().attr("href") || undefined;
  return { name, url };
}

function extractPricing($: cheerio.CheerioAPI): string | null {
  return $("[class*='price'], [class*='pricing'], [class*='Price'], [class*='Pricing']").first().text().trim() || null;
}

function extractShortDescription($: cheerio.CheerioAPI): string | null {
  return $("[class*='subtitle'], [class*='tagline'], [class*='short-description'], [class*='ShortDescription']").first().text().trim() || null;
}

function extractLongDescription($: cheerio.CheerioAPI): string | null {
  return $("[class*='description'], [class*='long-description'], [class*='LongDescription'], [class*='app-details']").first().text().trim() || null;
}

function extractCategories($: cheerio.CheerioAPI): Array<{ slug: string; name?: string }> {
  const cats: Array<{ slug: string; name?: string }> = [];
  $("a[href*='category=']").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/[?&]category=([^&]+)/);
    if (m) {
      cats.push({ slug: decodeURIComponent(m[1]), name: $(el).text().trim() || undefined });
    }
  });
  return cats;
}

function extractProducts($: cheerio.CheerioAPI): string[] {
  const products: string[] = [];
  // Look for product labels (Support, Chat, Sell)
  $("[class*='product'], [class*='Product']").each((_i, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes("support")) products.push("support");
    if (text.includes("chat")) products.push("chat");
    if (text.includes("sell")) products.push("sell");
  });
  return [...new Set(products)];
}
