import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  createLogger,
  type CategoryPageData,
  type FirstPageApp,
  type FirstPageMetrics,
} from "@shopify-tracking/shared";

const log = createLogger("category-parser");

/**
 * Parse a category page (main or /all) and extract app listings, metrics,
 * subcategory links, and category metadata.
 *
 * App cards are identified by the `data-controller="app-card"` attribute.
 * Each card carries structured data in `data-app-card-*` attributes.
 */
export function parseCategoryPage(
  html: string,
  url: string
): CategoryPageData {
  const $ = cheerio.load(html);

  const slug = extractSlugFromUrl(url);
  const rawTitle = $("h1").first().text().trim() || slug;
  const title = rawTitle.replace(/\s+apps?\s*$/i, "");

  let breadcrumb = "";
  try { breadcrumb = parseBreadcrumb($, slug); } catch (e) {
    log.warn("failed to parse breadcrumb", { slug, error: String(e) });
  }

  let description = "";
  try { description = parseDescription($); } catch (e) {
    log.warn("failed to parse description", { slug, error: String(e) });
  }

  let appCount: number | null = null;
  try { appCount = parseAppCount($); } catch (e) {
    log.warn("failed to parse app count", { slug, error: String(e) });
  }

  let subcategoryLinks: { slug: string; url: string; title: string }[] = [];
  try { subcategoryLinks = parseSubcategoryLinks($, slug); } catch (e) {
    log.warn("failed to parse subcategory links", { slug, error: String(e) });
  }

  let firstPageApps: FirstPageApp[] = [];
  try { firstPageApps = parseAppCards($); } catch (e) {
    log.warn("failed to parse app cards", { slug, error: String(e) });
  }

  const firstPageMetrics =
    firstPageApps.length > 0 ? computeMetrics(firstPageApps) : null;

  return {
    slug,
    url,
    data_source_url: url.split("?")[0],
    title,
    breadcrumb,
    description,
    app_count: appCount,
    first_page_metrics: firstPageMetrics,
    first_page_apps: firstPageApps,
    subcategory_links: subcategoryLinks,
  };
}

/**
 * Check if the main category page has app cards or if we need the /all page.
 */
export function shouldUseAllPage(html: string): boolean {
  const $ = cheerio.load(html);
  const appCards = $('[data-controller="app-card"]');

  const hasViewAllLink =
    $('a[href*="/all"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes("view all") || text.includes("see all");
    }).length > 0;

  return appCards.length === 0 || hasViewAllLink;
}

/** Check if there's a next page for pagination */
export function hasNextPage(html: string): boolean {
  const $ = cheerio.load(html);
  // Only check for explicit "next" link — a[href*="page="] also matches
  // previous/numbered page links, causing false positives on the last page
  return $('a[rel="next"]').length > 0;
}

// --- Internal helpers ---

function extractSlugFromUrl(url: string): string {
  const match = url.match(/\/categories\/([^/?]+)/);
  return match ? match[1] : "";
}

function parseBreadcrumb($: cheerio.CheerioAPI, currentSlug: string): string {
  // Breadcrumb links have surface_type=category and point to parent categories
  const parts: string[] = [];
  const seen = new Set<string>();

  $('a[href*="surface_type=category"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (!text || seen.has(text)) return;

    // Only include category links that are ancestors of current slug
    const slugMatch = href.match(/\/categories\/([^/?]+)/);
    if (!slugMatch) return;

    seen.add(text);
    parts.push(text);
  });

  // Add current page title
  const h1 = $("h1").first().text().trim();
  if (h1 && !seen.has(h1)) {
    parts.push(h1);
  }

  return parts.join(" > ");
}

function parseDescription($: cheerio.CheerioAPI): string {
  // Meta description is the most reliable source
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc?.trim()) return metaDesc.trim();

  // Fallback: paragraph after h1
  const h1 = $("h1").first();
  const nextP = h1.next("p");
  if (nextP.length) return nextP.text().trim();

  return "";
}

function parseAppCount($: cheerio.CheerioAPI): number | null {
  // Look for text like "129 apps" - search in the page title/heading area
  const bodyText = $.text();
  const match = bodyText.match(/(\d[\d,]*)\s+apps?\b/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

function parseSubcategoryLinks(
  $: cheerio.CheerioAPI,
  currentSlug: string
): { slug: string; url: string; title: string }[] {
  const subcategories: { slug: string; url: string; title: string }[] = [];
  const seen = new Set<string>();

  // Subcategory links carry surface_detail param and are in the main content area.
  // They link to child categories whose slug starts with currentSlug-
  $('a[href*="/categories/"][href*="surface_detail"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";

    // Skip navbar/megamenu links
    if (
      $el.closest(
        '.megamenu-component, .side-menu-component, [class*="navbar"]'
      ).length > 0
    )
      return;

    const cleanHref = href.split("?")[0];
    if (cleanHref.includes("/all")) return;

    const slugMatch = cleanHref.match(/\/categories\/([^/?]+)$/);
    if (!slugMatch) return;

    const slug = slugMatch[1];

    // Only include direct children of current category
    if (!slug.startsWith(currentSlug + "-")) return;

    if (seen.has(slug)) return;
    seen.add(slug);

    // Take first line of text (avoid multiline card descriptions)
    const title = $el.text().trim().split("\n")[0].trim().replace(/\s+apps?\s*$/i, "");
    if (title && title.length < 200) {
      subcategories.push({
        slug,
        url: `https://apps.shopify.com/categories/${slug}`,
        title,
      });
    }
  });

  return subcategories;
}

/**
 * Parse app cards using data-controller="app-card" elements.
 * Each card has structured data in data-app-card-* attributes.
 */
function parseAppCards($: cheerio.CheerioAPI): FirstPageApp[] {
  const apps: FirstPageApp[] = [];
  const seenSlugs = new Set<string>();

  $('[data-controller="app-card"]').each((_, el) => {
    const $card = $(el);

    // Extract data from card attributes
    const appSlug = $card.attr("data-app-card-handle-value") || "";
    const name = ($card.attr("data-app-card-name-value") || "").trim();
    const logoUrl = $card.attr("data-app-card-icon-url-value") || "";
    const appLink = $card.attr("data-app-card-app-link-value") || "";
    const intraPosition = $card.attr("data-app-card-intra-position-value");

    if (!appSlug || !name) return;

    // Deduplicate: same app can appear as both sponsored and organic
    if (seenSlugs.has(appSlug)) return;
    seenSlugs.add(appSlug);

    const appUrl = `https://apps.shopify.com/${appSlug}`;

    // Determine if sponsored from the app link URL
    const isSponsored =
      appLink.includes("surface_type=category_ad") ||
      appLink.includes("surface_type=search_ad");

    // Extract rating and review count from card text
    const cardText = $card.text();
    const { rating, count } = extractRatingFromText(cardText);

    // Check for "Built for Shopify" badge
    const isBuiltForShopify =
      $card.find('[class*="built-for-shopify"]').length > 0;

    // Extract short description
    const shortDescription = extractDescription($, $card);

    // Extract pricing hint (e.g. "Free plan available", "$9.99/month")
    const pricingHint = extractPricingHint($, $card);

    // Position from data attribute
    const position = intraPosition ? parseInt(intraPosition, 10) : undefined;

    apps.push({
      name,
      short_description: shortDescription,
      average_rating: rating,
      rating_count: count,
      app_url: appUrl,
      logo_url: logoUrl,
      position: position || undefined,
      pricing_hint: pricingHint || undefined,
      is_sponsored: isSponsored,
      is_built_for_shopify: isBuiltForShopify,
    });
  });

  return apps.slice(0, 24);
}

function extractRatingFromText(text: string): {
  rating: number;
  count: number;
} {
  // Pattern: "4.9 out of 5 stars (2,121) 2121 total reviews"
  const ratingMatch = text.match(/(\d\.\d)\s*out of 5 stars/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Pattern: "(2,121)" right after the stars text
  const countMatch = text.match(/\(([\d,]+)\)\s*[\d,]*\s*total reviews/);
  // Fallback: just "N total reviews"
  const fallbackMatch = text.match(/([\d,]+)\s*total reviews/);
  const countStr = countMatch?.[1] || fallbackMatch?.[1] || "0";
  const count = parseInt(countStr.replace(/,/g, ""), 10);

  return { rating, count };
}

/** Detect Shopify ad/sponsored card boilerplate text */
function isAdText(text: string): boolean {
  return (
    text.includes("app developer paid to promote") ||
    text.includes("This ad is based on") ||
    text.includes("paid search")
  );
}

function extractDescription(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<AnyNode>
): string {
  // Shopify renders the app card subtitle in a <div> with these Tailwind classes
  const descDiv = $card.find("div.tw-text-fg-secondary.tw-text-body-xs:not(:has(*))");
  if (descDiv.length > 0) {
    const text = $(descDiv.first()).text().trim();
    if (text.length > 5 && !isAdText(text)) return text;
  }

  // Fallback: search <p> and <div> tags for the longest descriptive text
  let bestDesc = "";
  $card.find("p, div").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.length > 10 &&
      !isAdText(text) &&
      !text.includes("out of 5 stars") &&
      !text.includes("total reviews") &&
      !text.includes("highest standards") &&
      !text.includes("Built for Shopify") &&
      !text.includes("Included with Shopify") &&
      text.length > bestDesc.length
    ) {
      bestDesc = text;
    }
  });

  return bestDesc;
}

function extractPricingHint(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<AnyNode>
): string {
  // Shopify renders exactly one pricing span per card with this class combo
  // (language-agnostic — works for "Free", "無料プランあり", "$9.99/month", etc.)
  const pricingSpan = $card.find("span.tw-overflow-hidden.tw-whitespace-nowrap.tw-text-ellipsis");
  if (pricingSpan.length > 0) {
    const text = pricingSpan.first().text().trim();
    if (text.length > 0) return normalizePricingHint(text);
  }
  return "";
}

/**
 * Normalize non-English Shopify pricing hints to English.
 * Shopify uses a fixed set of pricing hint templates that get translated
 * per app listing locale. We detect the pattern and map to English.
 */
function normalizePricingHint(text: string): string {
  // Already English or contains price — return as-is
  if (/^(Free|From |\$|£|€)/.test(text)) return text;

  // Keyword-based detection for non-English pricing hints.
  // Shopify translates its ~5 pricing templates into each locale.
  const t = text.toLowerCase();

  // "Free to install" pattern (check before generic "free" — more specific)
  if (/インストール|安装|설치|installa|instalar|installer|installier/i.test(text)) {
    return "Free to install";
  }
  // "Free trial available" pattern
  if (/体験|试用|체험|trial|essai|prueba|prova|Testversion|deneme/i.test(text)) {
    return "Free trial available";
  }
  // "Free plan available" pattern
  if (/プラン|计划|플랜|plan|forfait|Tarif/i.test(text)) {
    return "Free plan available";
  }
  // Generic "Free" — standalone free word in any language
  if (/^(無料|免费|무료|Kostenlos|Gratuit|Gratis|Gratuito|Ücretsiz|Бесплатно)$/i.test(text)) {
    return "Free";
  }

  // Contains a currency/price pattern in any locale (¥, ₩, etc.)
  if (/[$€£¥₩₹]|\/月|\/Monat|\/mois|\/mes|\/mese|\/ay/i.test(text)) {
    return text; // Keep original — it's a localized price like "¥980/月"
  }

  return text;
}

// --- Metrics computation ---

export function computeMetrics(apps: FirstPageApp[]): FirstPageMetrics {
  const sorted = [...apps].sort((a, b) => b.rating_count - a.rating_count);
  const totalReviews = apps.reduce((sum, a) => sum + a.rating_count, 0);

  const top4 = sorted.slice(0, 4);
  const top8 = sorted.slice(0, 8);

  const top4Reviews = top4.reduce((sum, a) => sum + a.rating_count, 0);
  const top8Reviews = top8.reduce((sum, a) => sum + a.rating_count, 0);

  return {
    sponsored_count: apps.filter((a) => a.is_sponsored).length,
    built_for_shopify_count: apps.filter((a) => a.is_built_for_shopify).length,
    count_100_plus_reviews: apps.filter((a) => a.rating_count >= 100).length,
    count_1000_plus_reviews: apps.filter((a) => a.rating_count >= 1000).length,
    total_reviews: totalReviews,
    top_4_avg_rating:
      top4.length > 0
        ? top4.reduce((sum, a) => sum + a.average_rating, 0) / top4.length
        : 0,
    top_4_avg_rating_count:
      top4.length > 0 ? top4Reviews / top4.length : 0,
    top_1_pct_reviews:
      totalReviews > 0 ? (sorted[0]?.rating_count ?? 0) / totalReviews : 0,
    top_4_pct_reviews:
      totalReviews > 0 ? top4Reviews / totalReviews : 0,
    top_8_pct_reviews:
      totalReviews > 0 ? top8Reviews / totalReviews : 0,
  };
}
