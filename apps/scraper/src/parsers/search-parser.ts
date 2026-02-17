import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { createLogger, type SearchPageData, type KeywordSearchApp } from "@shopify-tracking/shared";

const log = createLogger("search-parser");

/**
 * Parse a Shopify App Store search results page.
 * Uses the same data-controller="app-card" structure as category pages.
 */
export function parseSearchPage(
  html: string,
  keyword: string,
  currentPage: number,
  positionOffset = 0
): SearchPageData {
  const $ = cheerio.load(html);

  let totalResults: number | null = null;
  try { totalResults = parseTotalResults($); } catch (e) {
    log.warn("failed to parse total results", { keyword, error: String(e) });
  }

  let apps: KeywordSearchApp[] = [];
  try { apps = parseSearchAppCards($, positionOffset); } catch (e) {
    log.warn("failed to parse search app cards", { keyword, error: String(e) });
  }

  if (apps.length === 0) {
    log.warn("no apps found in search results — possible HTML structure change", { keyword });
  }

  const hasNext =
    $('a[rel="next"]').length > 0 || $(`a[href*="page=${currentPage + 1}"]`).length > 0;

  return {
    keyword,
    total_results: totalResults,
    apps,
    has_next_page: hasNext,
    current_page: currentPage,
  };
}

function parseTotalResults($: cheerio.CheerioAPI): number | null {
  const bodyText = $.text();
  // Pattern: "X results for" or "X apps"
  const match =
    bodyText.match(/(\d[\d,]*)\s+results?\s+for/i) ||
    bodyText.match(/(\d[\d,]*)\s+apps?\b/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

function parseSearchAppCards($: cheerio.CheerioAPI, positionOffset = 0): KeywordSearchApp[] {
  const apps: KeywordSearchApp[] = [];
  const seenSponsoredSlugs = new Set<string>();
  const seenOrganicSlugs = new Set<string>();
  let position = positionOffset;

  $('[data-controller="app-card"]').each((_, el) => {
    const $card = $(el);

    const appSlug = $card.attr("data-app-card-handle-value") || "";
    const appName = ($card.attr("data-app-card-name-value") || "").trim();
    const logoUrl = $card.attr("data-app-card-icon-url-value") || "";
    const appLink = $card.attr("data-app-card-app-link-value") || "";

    if (!appSlug || !appName) return;

    const isBuiltIn = appSlug.startsWith("bif:");
    const isSponsored = !isBuiltIn && appLink.includes("surface_type=search_ad");

    // Deduplicate per type: same app can appear as both sponsored and organic
    if (isSponsored) {
      if (seenSponsoredSlugs.has(appSlug)) return;
      seenSponsoredSlugs.add(appSlug);
    } else {
      if (seenOrganicSlugs.has(appSlug)) return;
      seenOrganicSlugs.add(appSlug);
    }

    // Only increment position for organic (non-sponsored, non-built-in) results
    if (!isSponsored && !isBuiltIn) position++;

    const isBuiltForShopify = $card.find('[class*="built-for-shopify"]').length > 0;

    const cardText = $card.text();
    const { rating, count } = extractRating(cardText);
    const shortDescription = extractDescription($card);
    const pricingHint = extractPricingHint($card);

    apps.push({
      position: isSponsored || isBuiltIn ? 0 : position,
      app_slug: appSlug,
      app_name: appName,
      short_description: shortDescription,
      average_rating: rating,
      rating_count: count,
      app_url: isBuiltIn
        ? `https://apps.shopify.com/built-in-features/${appSlug.replace("bif:", "")}`
        : `https://apps.shopify.com/${appSlug}`,
      logo_url: logoUrl,
      pricing_hint: pricingHint || undefined,
      is_sponsored: isSponsored,
      is_built_in: isBuiltIn,
      is_built_for_shopify: isBuiltForShopify,
    });
  });

  return apps;
}

function extractRating(text: string): { rating: number; count: number } {
  const ratingMatch = text.match(/(\d\.\d)\s*out of 5 stars/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  const countMatch = text.match(/\(([\d,]+)\)\s*[\d,]*\s*total reviews/);
  const fallbackMatch = text.match(/([\d,]+)\s*total reviews/);
  const countStr = countMatch?.[1] || fallbackMatch?.[1] || "0";
  const count = parseInt(countStr.replace(/,/g, ""), 10);

  return { rating, count };
}

function extractDescription(
  $card: cheerio.Cheerio<AnyNode>
): string {
  // Shopify renders the app card subtitle in a <div> with these Tailwind classes
  const descDiv = $card.find("div.tw-text-fg-secondary.tw-text-body-xs:not(:has(*))");
  if (descDiv.length > 0) {
    const text = descDiv.first().text().trim();
    if (text.length > 5) return text;
  }

  // Fallback: search <p> and <div> tags for the longest descriptive text
  let bestDesc = "";
  $card.find("p, div").each((_, el) => {
    const text = cheerio.load(el)(el.tagName).text().trim();
    if (
      text.length > 10 &&
      text.length > bestDesc.length &&
      !text.includes("out of 5 stars") &&
      !text.includes("total reviews") &&
      !text.includes("paid search") &&
      !text.includes("highest standards") &&
      !text.includes("Built for Shopify") &&
      !text.includes("Included with Shopify")
    ) {
      bestDesc = text;
    }
  });

  return bestDesc;
}

function extractPricingHint(
  $card: cheerio.Cheerio<AnyNode>
): string {
  let pricing = "";
  $card.find("span").each((_, el) => {
    const text = cheerio.load(el)("span").first().text().trim();
    if (
      text.length > 2 &&
      !text.includes("out of 5") &&
      !text.includes("total review") &&
      text !== "•" &&
      !/^\([\d,]+\)$/.test(text) &&
      !/^[\d.]+$/.test(text) &&
      (text.includes("Free") ||
        text.includes("$") ||
        text.includes("/month") ||
        text.includes("install") ||
        text.includes("day") ||
        text.includes("trial"))
    ) {
      pricing = text;
    }
  });
  return pricing;
}
