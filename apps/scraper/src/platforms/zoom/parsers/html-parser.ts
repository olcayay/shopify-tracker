import { load } from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type {
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedCategoryApp,
  NormalizedSearchPage,
  NormalizedSearchApp,
  NormalizedFeaturedSection,
} from "../../platform-module.js";

const log = createLogger("zoom:html-parser");

/**
 * Parse app details from the Zoom Marketplace HTML page.
 * URL: https://marketplace.zoom.us/apps/{slug}
 *
 * The page is a React SPA, so this parses the rendered HTML from a browser.
 */
export function parseAppHtml(html: string, slug: string): NormalizedAppDetails {
  const $ = load(html);

  const name = $("h1").first().text().trim()
    || $('[class*="appName"], [class*="AppName"]').first().text().trim()
    || slug;

  // Rating
  const ratingText = $('[class*="rating"], [class*="Rating"]').first().text();
  const ratingMatch = ratingText.match(/([\d.]+)/);
  const ratingCountMatch = ratingText.match(/\((\d+)\)/);

  // Developer
  const devEl = $('[class*="developer"], [class*="Developer"], [class*="publisherName"]').first();
  const developerName = devEl.text().trim();

  // Icon
  const iconUrl = $('img[class*="appIcon"], img[class*="AppIcon"], img[alt*="logo"]').first().attr("src") || null;

  // Description
  const description = $('[class*="description"], [class*="Description"]').first().text().trim();

  // Categories
  const categories: Array<{ slug: string }> = [];
  $('a[href*="category="]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const catMatch = href.match(/category=([^&]+)/);
    if (catMatch) categories.push({ slug: decodeURIComponent(catMatch[1]) });
  });

  return {
    name,
    slug,
    averageRating: safeParseFloat(ratingMatch?.[1]),
    ratingCount: ratingCountMatch ? parseInt(ratingCountMatch[1]) : null,
    pricingHint: null,
    pricingModel: null,
    iconUrl,
    developer: developerName ? { name: developerName } : null,
    badges: [],
    platformData: {
      description,
      categories,
    },
  };
}

/**
 * Parse category page from the Zoom Marketplace HTML.
 * URL: https://marketplace.zoom.us/apps?category={slug}
 */
export function parseCategoryHtml(html: string, slug: string, page: number): NormalizedCategoryPage {
  const $ = load(html);
  const apps: NormalizedCategoryApp[] = [];

  // Look for app cards
  $('a[href*="/apps/"]').each((idx, el) => {
    const link = $(el);
    const href = link.attr("href") || "";
    const appSlug = href.match(/\/apps\/([^/?]+)/)?.[1];
    if (!appSlug || appSlug === "category") return;

    const card = link.closest('[class*="card"], [class*="Card"], [class*="AppItem"]');
    const container = card.length ? card : link;

    const appName = container.find("h3, h4, [class*=\"name\"], [class*=\"Name\"]").first().text().trim()
      || link.text().trim();

    if (!appName || appName.length > 200) return;

    const desc = container.find('[class*="description"], p').first().text().trim();
    const logo = container.find("img").first().attr("src") || "";
    const ratingText = container.find('[class*="rating"]').text();
    const ratingMatch = ratingText.match(/([\d.]+)/);

    apps.push({
      slug: appSlug,
      name: appName,
      shortDescription: desc,
      averageRating: safeParseFloat(ratingMatch?.[1], 0)!,
      ratingCount: 0,
      logoUrl: logo,
      isSponsored: false,
      badges: [],
      position: idx + 1,
    });
  });

  // Deduplicate by slug
  const seen = new Set<string>();
  const deduped = apps.filter((a) => {
    if (seen.has(a.slug)) return false;
    seen.add(a.slug);
    return true;
  });

  const title = $("h1").first().text().trim() || slug;

  return {
    slug,
    url: `https://marketplace.zoom.us/apps?category=${slug}`,
    title,
    description: "",
    appCount: null,
    apps: deduped,
    subcategoryLinks: [],
    hasNextPage: false, // Zoom loads all on one page
  };
}

/**
 * Parse search results from the Zoom Marketplace HTML.
 */
export function parseSearchHtml(html: string, keyword: string, page: number, offset: number): NormalizedSearchPage {
  const $ = load(html);
  const apps: NormalizedSearchApp[] = [];

  $('a[href*="/apps/"]').each((idx, el) => {
    const link = $(el);
    const href = link.attr("href") || "";
    const appSlug = href.match(/\/apps\/([^/?]+)/)?.[1];
    if (!appSlug || appSlug === "category" || appSlug === "search") return;

    const card = link.closest('[class*="card"], [class*="Card"], [class*="AppItem"]');
    const container = card.length ? card : link;

    const appName = container.find("h3, h4, [class*=\"name\"]").first().text().trim()
      || link.text().trim();

    if (!appName || appName.length > 200) return;

    const desc = container.find('[class*="description"], p').first().text().trim();
    const logo = container.find("img").first().attr("src") || "";

    apps.push({
      position: offset + idx + 1,
      appSlug,
      appName,
      shortDescription: desc,
      averageRating: 0,
      ratingCount: 0,
      logoUrl: logo,
      isSponsored: false,
      badges: [],
    });
  });

  // Deduplicate
  const seen = new Set<string>();
  const deduped = apps.filter((a) => {
    if (seen.has(a.appSlug)) return false;
    seen.add(a.appSlug);
    return true;
  });

  return {
    keyword,
    totalResults: deduped.length || null,
    apps: deduped,
    hasNextPage: false,
    currentPage: page,
  };
}

/**
 * Parse featured sections from the Zoom Marketplace homepage HTML.
 */
export function parseFeaturedHtml(html: string): NormalizedFeaturedSection[] {
  const $ = load(html);
  const sections: NormalizedFeaturedSection[] = [];

  // Look for section headings + app lists
  $("section, [class*='collection'], [class*='Collection']").each((_, sectionEl) => {
    const section = $(sectionEl);
    const title = section.find("h2, h3").first().text().trim();
    if (!title) return;

    const sectionApps: { slug: string; name: string; iconUrl: string; position: number | null }[] = [];
    section.find('a[href*="/apps/"]').each((idx, el) => {
      const href = $(el).attr("href") || "";
      const appSlug = href.match(/\/apps\/([^/?]+)/)?.[1];
      if (!appSlug) return;
      const appName = $(el).text().trim();
      const icon = $(el).find("img").attr("src") || "";
      sectionApps.push({ slug: appSlug, name: appName, iconUrl: icon, position: idx + 1 });
    });

    if (sectionApps.length > 0) {
      sections.push({
        sectionHandle: title.toLowerCase().replace(/\s+/g, "-"),
        sectionTitle: title,
        surface: "homepage",
        surfaceDetail: "homepage",
        apps: sectionApps,
      });
    }
  });

  return sections;
}
