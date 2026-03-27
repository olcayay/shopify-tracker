import { load } from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type {
  NormalizedAppDetails,
  NormalizedSearchPage,
  NormalizedSearchApp,
  NormalizedCategoryApp,
} from "../../platform-module.js";

const log = createLogger("atlassian:html-parser");

/**
 * Parse app details from the Atlassian Marketplace HTML page.
 *
 * The page embeds `window.__INITIAL_STATE__` with Apollo cache data.
 * If that's not available, we fall back to parsing visible DOM elements.
 */
export function parseAppHtml(html: string, slug: string): NormalizedAppDetails {
  const state = extractInitialState(html);

  if (state) {
    return parseFromInitialState(state, slug);
  }

  // Fallback: parse from DOM
  return parseFromDom(html, slug);
}

function extractInitialState(html: string): Record<string, any> | null {
  const marker = "window.__INITIAL_STATE__ = ";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const jsonStart = idx + marker.length;
  let depth = 0;
  let inString = false;

  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseFromInitialState(state: Record<string, any>, slug: string): NormalizedAppDetails {
  // Find the app data in Apollo cache
  const cache = state.apollo?.cache || state.ROOT_QUERY || {};

  // Look through all cache entries for the addon
  let appData: Record<string, any> | null = null;
  for (const [key, val] of Object.entries(cache)) {
    if (key.includes(slug) && typeof val === "object" && val !== null) {
      const obj = val as Record<string, any>;
      if (obj.name && (obj.key === slug || obj.addonKey === slug)) {
        appData = obj;
        break;
      }
    }
  }

  if (!appData) {
    // Try to find by iterating values
    for (const val of Object.values(cache)) {
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, any>;
        if (obj.__typename === "Addon" || obj.addonKey) {
          appData = obj;
          break;
        }
      }
    }
  }

  if (!appData) {
    log.warn("could not find app data in __INITIAL_STATE__", { slug });
    return emptyResult(slug);
  }

  const badges: string[] = [];
  if (appData.isCloudFortified || appData.cloudFortified) badges.push("cloud_fortified");
  if (appData.isTopVendor || appData.topVendor) badges.push("top_vendor");

  return {
    name: appData.name || slug,
    slug,
    averageRating: appData.rating?.stars ?? appData.averageStars ?? null,
    ratingCount: appData.rating?.count ?? appData.reviewCount ?? null,
    pricingHint: appData.pricing?.summary || null,
    iconUrl: appData.logo?.url || appData.logoUrl || null,
    developer: appData.vendor
      ? { name: appData.vendor.name, url: appData.vendor.links?.base }
      : null,
    badges,
    platformData: {
      categories: appData.categories || [],
      summary: appData.summary || null,
      description: appData.description || null,
      hostingOptions: appData.hostingOptions || [],
      installCount: appData.installCount ?? null,
    },
  };
}

function parseFromDom(html: string, slug: string): NormalizedAppDetails {
  const $ = load(html);

  const name = $("h1").first().text().trim() || slug;
  const ratingText = $('[data-testid="rating-count"], .rating-count').first().text();
  const ratingMatch = ratingText.match(/([\d.]+)/);
  const ratingCountMatch = ratingText.match(/\((\d+)\)/);

  const developer = $('[data-testid="vendor-name"], .vendor-name').first().text().trim();
  const iconUrl = $('img[data-testid="app-logo"], .app-logo img').first().attr("src") || null;
  const pricing = $('[data-testid="pricing"], .pricing-summary').first().text().trim();

  const badges: string[] = [];
  if (html.includes("Cloud Fortified") || html.includes("cloud-fortified")) badges.push("cloud_fortified");
  if (html.includes("Top Vendor") || html.includes("top-vendor")) badges.push("top_vendor");

  return {
    name,
    slug,
    averageRating: safeParseFloat(ratingMatch?.[1]),
    ratingCount: ratingCountMatch ? parseInt(ratingCountMatch[1]) : null,
    pricingHint: pricing || null,
    iconUrl,
    developer: developer ? { name: developer } : null,
    badges,
    platformData: {},
  };
}

/**
 * Parse search results from the Atlassian Marketplace search page HTML.
 */
export function parseSearchHtml(html: string, keyword: string, page: number, offset: number): NormalizedSearchPage {
  const state = extractInitialState(html);
  const apps: NormalizedSearchApp[] = [];

  if (state) {
    // Extract search results from Apollo cache
    const cache = state.apollo?.cache || {};
    const items: any[] = [];

    for (const val of Object.values(cache)) {
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, any>;
        if (obj.__typename === "Addon" || (obj.addonKey && obj.name)) {
          items.push(obj);
        }
      }
    }

    let pos = offset;
    for (const item of items) {
      pos++;
      apps.push({
        position: pos,
        appSlug: item.addonKey || item.key || "",
        appName: item.name || "",
        shortDescription: item.summary || "",
        averageRating: item.rating?.stars ?? item.averageStars ?? 0,
        ratingCount: item.rating?.count ?? item.reviewCount ?? 0,
        logoUrl: item.logo?.url || item.logoUrl || "",
        isSponsored: false,
        badges: [],
      });
    }
  }

  return {
    keyword,
    totalResults: apps.length || null,
    apps,
    hasNextPage: false,
    currentPage: page,
  };
}

function emptyResult(slug: string): NormalizedAppDetails {
  return {
    name: slug,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    iconUrl: null,
    developer: null,
    badges: [],
    platformData: {},
  };
}
