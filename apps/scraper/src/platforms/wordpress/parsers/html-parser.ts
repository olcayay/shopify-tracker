import { load } from "cheerio";
import { createLogger } from "@appranks/shared";
import type {
  NormalizedAppDetails,
  NormalizedCategoryPage,
  NormalizedSearchPage,
  NormalizedSearchApp,
  NormalizedCategoryApp,
} from "../../platform-module.js";

const log = createLogger("wordpress:html-parser");

/**
 * Parse plugin details from the WordPress plugin page HTML.
 * URL: https://wordpress.org/plugins/{slug}/
 */
export function parsePluginHtml(html: string, slug: string): NormalizedAppDetails {
  const $ = load(html);

  const name = $("h1.plugin-title").text().trim()
    || $(".entry-title").text().trim()
    || slug;

  // Rating
  const ratingEl = $(".plugin-rating .wporg-ratings");
  const ratingTitle = ratingEl.attr("data-title-template") || ratingEl.attr("title") || "";
  const ratingMatch = ratingTitle.match(/([\d.]+)\s*out\s*of\s*5/i);
  const averageRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  const ratingCountText = $(".rating-count a").text();
  const ratingCountMatch = ratingCountText.match(/([\d,]+)/);
  const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1].replace(/,/g, "")) : null;

  // Developer
  const authorLink = $(".plugin-header .byline a").first();
  const developerName = authorLink.text().trim() || $(".plugin-header .byline").text().replace(/^By\s*/i, "").trim();
  const developerUrl = authorLink.attr("href") || undefined;

  // Icon
  const iconUrl = $(".plugin-icon img").attr("src") || null;

  // Pricing (WordPress plugins are free)
  const pricingHint = "Free";

  // Description
  const description = $(".plugin-description").text().trim()
    || $('[itemprop="description"]').text().trim()
    || "";

  // Active installs
  const activeInstalls = $(".active_installs").text().trim()
    || (() => {
      const metaItems = $(".plugin-meta li");
      let installs = "";
      metaItems.each((_, el) => {
        const text = $(el).text();
        if (text.includes("Active installations")) {
          installs = text.replace(/.*?:\s*/, "").trim();
        }
      });
      return installs;
    })();

  // Tags
  const tags: Record<string, string> = {};
  $(".plugin-meta .tags a").each((_, el) => {
    const tag = $(el).text().trim();
    const href = $(el).attr("href") || "";
    const tagSlug = href.match(/\/tags\/([^/?]+)/)?.[1] || tag.toLowerCase().replace(/\s+/g, "-");
    tags[tagSlug] = tag;
  });

  // Last updated
  const lastUpdated = $(".plugin-meta time").attr("datetime") || null;

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint,
    iconUrl,
    developer: developerName ? { name: developerName, url: developerUrl } : null,
    badges: [],
    platformData: {
      description,
      activeInstalls,
      tags,
      lastUpdated,
    },
  };
}

/**
 * Parse tag/category page from WordPress plugin directory HTML.
 * URL: https://wordpress.org/plugins/tags/{tag}/
 */
export function parseTagHtml(html: string, slug: string): NormalizedCategoryPage {
  const $ = load(html);
  const apps: NormalizedCategoryApp[] = [];

  $(".plugin-card").each((idx, el) => {
    const card = $(el);
    const nameLink = card.find(".plugin-card-top h3 a").first();
    const appName = nameLink.text().trim();
    const href = nameLink.attr("href") || "";
    const appSlug = href.match(/\/plugins\/([^/?]+)/)?.[1] || "";
    if (!appSlug) return;

    const desc = card.find(".plugin-card-top p").first().text().trim();
    const logo = card.find(".plugin-icon img").attr("src") || "";
    const ratingEl = card.find(".star-rating");
    const ratingTitle = ratingEl.attr("title") || "";
    const ratingMatch = ratingTitle.match(/([\d.]+)/);
    const ratingCountText = card.find(".num-ratings").text();
    const ratingCountMatch = ratingCountText.match(/([\d,]+)/);

    apps.push({
      slug: appSlug,
      name: appName,
      shortDescription: desc,
      averageRating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
      ratingCount: ratingCountMatch ? parseInt(ratingCountMatch[1].replace(/,/g, "")) : 0,
      logoUrl: logo,
      isSponsored: false,
      badges: [],
      position: idx + 1,
    });
  });

  const title = $("h1.page-title, h1").first().text().trim() || slug;
  const hasNextPage = $(".pagination .next").length > 0;

  return {
    slug,
    url: `https://wordpress.org/plugins/tags/${slug}/`,
    title,
    description: "",
    appCount: null,
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}

/**
 * Parse search results from the WordPress plugin search page HTML.
 * URL: https://wordpress.org/plugins/search/{keyword}/
 */
export function parseSearchHtml(html: string, keyword: string, page: number, offset: number): NormalizedSearchPage {
  const $ = load(html);
  const apps: NormalizedSearchApp[] = [];

  $(".plugin-card").each((idx, el) => {
    const card = $(el);
    const nameLink = card.find(".plugin-card-top h3 a").first();
    const appName = nameLink.text().trim();
    const href = nameLink.attr("href") || "";
    const appSlug = href.match(/\/plugins\/([^/?]+)/)?.[1] || "";
    if (!appSlug) return;

    const desc = card.find(".plugin-card-top p").first().text().trim();
    const logo = card.find(".plugin-icon img").attr("src") || "";
    const ratingEl = card.find(".star-rating");
    const ratingTitle = ratingEl.attr("title") || "";
    const ratingMatch = ratingTitle.match(/([\d.]+)/);
    const ratingCountText = card.find(".num-ratings").text();
    const ratingCountMatch = ratingCountText.match(/([\d,]+)/);

    apps.push({
      position: offset + idx + 1,
      appSlug,
      appName,
      shortDescription: desc,
      averageRating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
      ratingCount: ratingCountMatch ? parseInt(ratingCountMatch[1].replace(/,/g, "")) : 0,
      logoUrl: logo,
      isSponsored: false,
      badges: [],
    });
  });

  const totalText = $(".plugin-results-header").text();
  const totalMatch = totalText.match(/([\d,]+)\s*results?/i);
  const totalResults = totalMatch ? parseInt(totalMatch[1].replace(/,/g, "")) : null;
  const hasNextPage = $(".pagination .next").length > 0;

  return {
    keyword,
    totalResults,
    apps,
    hasNextPage,
    currentPage: page,
  };
}
