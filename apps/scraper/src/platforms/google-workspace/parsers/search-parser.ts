import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import { extractAfData, extractAppEntries, type GWorkspaceAppEntry } from "./extract-embedded-data.js";

const log = createLogger("gworkspace-search-parser");

/**
 * Parse Google Workspace Marketplace search results page.
 *
 * Primary data source: AF_initDataCallback ds:1 (embedded structured JSON)
 * Search format: [[[count, [entries]]]] where each entry is [[35-fields]]
 *
 * Fallback: DOM selectors with real CSS classes.
 */
export function parseGoogleWorkspaceSearchPage(
  html: string,
  keyword: string,
  page: number,
  offset: number,
): NormalizedSearchPage {
  // Try structured JSON first
  const ds1 = extractAfData(html, "ds:1");
  const entries = extractAppEntries(ds1);

  let apps: NormalizedSearchApp[];
  if (entries.length > 0) {
    log.info("parsing search from embedded JSON", { keyword, entryCount: entries.length });
    apps = entries.map((entry, idx) => entryToSearchApp(entry, offset + idx + 1));
  } else {
    log.warn("falling back to DOM parsing for search", { keyword });
    const $ = cheerio.load(html);
    apps = parseSearchAppsFromDom($, offset);
  }

  log.info("parsed search page", { keyword, page, apps: apps.length });

  return {
    keyword,
    totalResults: apps.length || null,
    apps,
    hasNextPage: false, // GWM loads all results at once (up to 100)
    currentPage: page,
  };
}

function entryToSearchApp(entry: GWorkspaceAppEntry, position: number): NormalizedSearchApp {
  return {
    position,
    appSlug: `${entry.slug}--${entry.appId}`,
    appName: entry.name,
    shortDescription: entry.shortDescription,
    averageRating: entry.rating || 0,
    ratingCount: entry.reviewCount || 0,
    logoUrl: entry.iconUrl,
    isSponsored: false,
    badges: [],
    extra: {
      externalId: entry.appId,
      ...(entry.developerName && { vendorName: entry.developerName }),
      ...(entry.installCountExact != null && { installCount: entry.installCountExact }),
    },
  };
}

/**
 * Fallback DOM parser using real card selectors.
 * Same card structure as category page.
 */
function parseSearchAppsFromDom($: cheerio.CheerioAPI, offset: number): NormalizedSearchApp[] {
  const apps: NormalizedSearchApp[] = [];
  const seenSlugs = new Set<string>();

  $("div[data-card-index]").each((_, el) => {
    const $card = $(el);
    const link = $card.find("a.RwHvCd").first();
    const href = link.attr("href") || "";

    const slugMatch = href.match(/\/marketplace\/app\/([^/?]+)\/([^/?]+)/);
    if (!slugMatch) return;

    const appSlug = `${slugMatch[1]}--${slugMatch[2]}`;
    if (seenSlugs.has(appSlug)) return;
    seenSlugs.add(appSlug);

    const name = $card.find("div.M0atNd").text().trim();
    const shortDesc = $card.find("div.BiEFEd").text().trim();
    const ratingText = $card.find('span.wUhZA[aria-description*="Rating"]').text().trim();
    const averageRating = safeParseFloat(ratingText, 0)!;
    const logoUrl = $card.find('img[jsname="DlICee"]').first().attr("src") || "";

    apps.push({
      position: offset + apps.length + 1,
      appSlug,
      appName: name,
      shortDescription: shortDesc,
      averageRating,
      ratingCount: 0,
      logoUrl,
      isSponsored: false,
      badges: [],
    });
  });

  return apps;
}
