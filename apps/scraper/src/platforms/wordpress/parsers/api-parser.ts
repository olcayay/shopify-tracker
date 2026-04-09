import { createLogger } from "@appranks/shared";
import type {
  NormalizedAppDetails,
  NormalizedSearchPage,
  NormalizedSearchApp,
  NormalizedCategoryPage,
  NormalizedCategoryApp,
} from "../../platform-module.js";

const log = createLogger("wordpress:api-parser");

/** Decode HTML entities (e.g., &amp; &#8217; &ndash;) from API text fields */
function decodeHtmlEntities(text: string): string {
  const NAMED_ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019",
    ldquo: "\u201C", rdquo: "\u201D", hellip: "\u2026", nbsp: " ",
    trade: "\u2122", copy: "\u00A9", reg: "\u00AE",
  };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(\w+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Pick the best icon URL from the icons object */
function pickIconUrl(icons: Record<string, string> | undefined): string | null {
  if (!icons) return null;
  return icons["2x"] || icons["1x"] || icons["svg"] || icons["default"] || null;
}

/** Parse a single plugin info JSON response into NormalizedAppDetails */
export function parsePluginInfo(json: Record<string, any>): NormalizedAppDetails {
  const name = decodeHtmlEntities(json.name || "");
  const slug = json.slug || "";

  // API returns rating 0-100, we store 0-5
  const rating = typeof json.rating === "number" ? json.rating / 20 : null;
  const ratingCount = typeof json.num_ratings === "number" ? json.num_ratings : null;

  const iconUrl = pickIconUrl(json.icons);

  const authorName = stripHtml(decodeHtmlEntities(json.author || ""));
  const authorUrl = json.author_profile || undefined;

  const badges: string[] = [];
  if (json.business_model) {
    badges.push(json.business_model);
  }

  const platformData: Record<string, unknown> = {
    shortDescription: decodeHtmlEntities(json.short_description || ""),
    version: json.version || null,
    testedUpTo: json.tested || null,
    requiresWP: json.requires || null,
    requiresPHP: json.requires_php || null,
    activeInstalls: json.active_installs ?? null,
    downloaded: json.downloaded ?? null,
    lastUpdated: json.last_updated || null,
    added: json.added || null,
    contributors: json.contributors || null,
    tags: json.tags || null,
    supportThreads: json.support_threads ?? null,
    supportThreadsResolved: json.support_threads_resolved ?? null,
    homepage: json.homepage || null,
    donateLink: json.donate_link || null,
    description: json.sections?.description || null,
    faq: json.sections?.faq || null,
    changelog: json.sections?.changelog || null,
    screenshots: json.screenshots || null,
    banners: json.banners || null,
    businessModel: json.business_model || null,
    ratings: json.ratings || null,
  };

  return {
    name,
    slug,
    averageRating: rating,
    ratingCount,
    pricingHint: null, // All wordpress.org plugins are free
    pricingModel: "Free",
    iconUrl,
    developer: authorName ? { name: authorName, url: authorUrl } : null,
    badges,
    platformData,
  };
}

/** Parse search results JSON into NormalizedSearchPage */
export function parseSearchResults(
  json: Record<string, any>,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const plugins = json.plugins || [];
  const info = json.info || {};

  const apps: NormalizedSearchApp[] = plugins.map(
    (p: Record<string, any>, idx: number) => {
      const position = (page - 1) * (info.page_size || plugins.length) + idx + 1;
      return {
        position,
        appSlug: p.slug || "",
        appName: decodeHtmlEntities(p.name || ""),
        shortDescription: decodeHtmlEntities(p.short_description || ""),
        averageRating: typeof p.rating === "number" ? p.rating / 20 : 0,
        ratingCount: p.num_ratings ?? 0,
        logoUrl: pickIconUrl(p.icons) || "",
        pricingHint: undefined,
        isSponsored: false,
        badges: p.business_model ? [p.business_model] : [],
        extra: {
          activeInstalls: p.active_installs,
          tested: p.tested,
          requiresPhp: p.requires_php,
        },
      };
    },
  );

  const totalResults = info.results ?? null;
  const currentPage = info.page ?? page;
  const totalPages = info.pages ?? 1;

  log.info("parsed search results", { keyword, page: currentPage, totalResults, appCount: apps.length });

  return {
    keyword,
    totalResults,
    apps,
    hasNextPage: currentPage < totalPages,
    currentPage,
  };
}

/** Parse tag browse results JSON into NormalizedCategoryPage */
export function parseTagResults(
  json: Record<string, any>,
  tagSlug: string,
): NormalizedCategoryPage {
  const plugins = json.plugins || [];
  const info = json.info || {};

  const apps: NormalizedCategoryApp[] = plugins.map(
    (p: Record<string, any>, idx: number) => ({
      slug: p.slug || "",
      name: decodeHtmlEntities(p.name || ""),
      shortDescription: decodeHtmlEntities(p.short_description || ""),
      averageRating: typeof p.rating === "number" ? p.rating / 20 : 0,
      ratingCount: p.num_ratings ?? 0,
      logoUrl: pickIconUrl(p.icons) || "",
      pricingHint: undefined,
      position: idx + 1,
      isSponsored: false,
      badges: p.business_model ? [p.business_model] : [],
    }),
  );

  const totalResults = info.results ?? null;
  const currentPage = info.page ?? 1;
  const totalPages = info.pages ?? 1;

  log.info("parsed tag results", { tagSlug, appCount: apps.length, totalResults });

  return {
    slug: tagSlug,
    url: `https://wordpress.org/plugins/tags/${tagSlug}/`,
    title: tagSlug.replace(/-/g, " "),
    description: "",
    appCount: totalResults,
    apps,
    subcategoryLinks: [], // Flat tags, no subcategories
    hasNextPage: currentPage < totalPages,
  };
}
