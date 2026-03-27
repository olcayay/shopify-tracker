import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { extractAfData, extractAppEntries, type GWorkspaceAppEntry } from "./extract-embedded-data.js";

const log = createLogger("gworkspace-category-parser");

/**
 * Parse Google Workspace Marketplace category page.
 *
 * Primary data source: AF_initDataCallback ds:1 (embedded structured JSON)
 * Category format: [count, [entries]] where each entry is [[35-fields]]
 *
 * Fallback: DOM selectors with real CSS classes.
 */
export function parseGoogleWorkspaceCategoryPage(
  html: string,
  categorySlug: string,
  page: number,
  offset: number,
): NormalizedCategoryPage {
  const $ = cheerio.load(html);

  // Page title — strip appended tooltip text ("infoMore details about user reviews")
  const rawTitle =
    $("h1.UL2LKb").first().text().trim() ||
    $("h1").first().text().trim() ||
    $("title").text().replace(/\s*[-|].*$/, "").trim() ||
    categorySlug;
  const title = rawTitle.replace(/info\s*More details about user reviews$/i, "").trim();

  const description = $('meta[name="description"]').attr("content") || "";

  // Try structured JSON first
  const ds1 = extractAfData(html, "ds:1");
  const entries = extractAppEntries(ds1);

  let apps: NormalizedCategoryApp[];
  if (entries.length > 0) {
    log.info("parsing category from embedded JSON", { categorySlug, entryCount: entries.length });
    apps = entries.map((entry, idx) => entryToApp(entry, offset + idx + 1));
  } else {
    log.warn("falling back to DOM parsing for category", { categorySlug });
    apps = parseAppsFromDom($, offset);
  }

  // Sub-category links from sidebar
  const subcategoryLinks = parseSubcategoryLinks($, categorySlug);

  const url = `https://workspace.google.com/marketplace/category/${categorySlug.replace("--", "/")}`;

  log.info("parsed category page", {
    categorySlug,
    title,
    apps: apps.length,
    subcategories: subcategoryLinks.length,
  });

  return {
    slug: categorySlug,
    url,
    title,
    description,
    appCount: apps.length || null,
    apps,
    subcategoryLinks,
    hasNextPage: false, // GWM shows all results on one page (up to 100)
  };
}

function entryToApp(entry: GWorkspaceAppEntry, position: number): NormalizedCategoryApp {
  return {
    slug: `${entry.slug}--${entry.appId}`,
    name: entry.name,
    shortDescription: entry.shortDescription,
    averageRating: entry.rating || 0,
    ratingCount: entry.reviewCount || 0,
    logoUrl: entry.iconUrl,
    position,
    isSponsored: false,
    badges: [],
  };
}

/**
 * Fallback DOM parser using real card selectors.
 *
 * Card structure:
 *   div[data-card-index] > div > a.RwHvCd (link wrapping entire card)
 *     div.M0atNd — app name
 *     span.y51Cnd — developer
 *     div.BiEFEd — description
 *     span.wUhZA[aria-description=", Rating"] — rating
 *     span.wUhZA (2nd, containing [aria-label=", Number of users"]) — installs
 *     img[jsname="DlICee"] — icon/banner
 */
function parseAppsFromDom($: cheerio.CheerioAPI, offset: number): NormalizedCategoryApp[] {
  const apps: NormalizedCategoryApp[] = [];
  const seenSlugs = new Set<string>();

  $("div[data-card-index]").each((_, el) => {
    const $card = $(el);
    const link = $card.find("a.RwHvCd").first();
    const href = link.attr("href") || "";

    // Extract slug from href: ./marketplace/app/{slug}/{id}?flow_type=...
    const slugMatch = href.match(/\/marketplace\/app\/([^/?]+)\/([^/?]+)/);
    if (!slugMatch) return;

    const appSlug = `${slugMatch[1]}--${slugMatch[2]}`;
    if (seenSlugs.has(appSlug)) return;
    seenSlugs.add(appSlug);

    const name = $card.find("div.M0atNd").text().trim();
    const shortDesc = $card.find("div.BiEFEd").text().trim();

    // Rating — first wUhZA with aria-description containing "Rating"
    const ratingText = $card.find('span.wUhZA[aria-description*="Rating"]').text().trim();
    const averageRating = safeParseFloat(ratingText, 0)!;

    // Logo
    const logoUrl = $card.find('img[jsname="DlICee"]').first().attr("src") || "";

    apps.push({
      slug: appSlug,
      name,
      shortDescription: shortDesc,
      averageRating,
      ratingCount: 0, // Not available in card DOM
      logoUrl,
      position: offset + apps.length + 1,
      isSponsored: false,
      badges: [],
    });
  });

  return apps;
}

function parseSubcategoryLinks(
  $: cheerio.CheerioAPI,
  categorySlug: string,
): { slug: string; url: string; title: string; parentSlug?: string }[] {
  const links: { slug: string; url: string; title: string; parentSlug?: string }[] = [];

  // The sidebar lists ALL categories (not just children of current category).
  // Only return actual child subcategories — two-part paths where the parent
  // matches the current category slug (e.g., /category/business-tools/sales-and-crm
  // is a child of business-tools, but /category/communication is NOT).
  const baseSlug = categorySlug.split("--")[0]; // top-level parent slug

  $('a[href*="/marketplace/category/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const linkTitle = $(el).text().trim();
    const match = href.match(/\/marketplace\/category\/([^/?]+)\/([^/?]+)/);
    // Only match two-part paths (parent/child) where parent matches current category
    if (match && linkTitle && match[1] === baseSlug) {
      const slug = `${match[1]}--${match[2]}`;
      if (slug !== categorySlug && !links.some(l => l.slug === slug)) {
        links.push({
          slug,
          url: href.startsWith("./") ? `https://workspace.google.com${href.slice(1)}` : href,
          title: linkTitle,
          parentSlug: match[1],
        });
      }
    }
  });

  return links;
}
