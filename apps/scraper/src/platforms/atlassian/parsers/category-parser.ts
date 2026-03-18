import { createLogger } from "@appranks/shared";
import type {
  NormalizedCategoryPage,
  NormalizedCategoryApp,
} from "../../platform-module.js";

const log = createLogger("atlassian:category-parser");

/** Atlassian Marketplace logo base URL */
const LOGO_BASE = "https://marketplace.atlassian.com/product-listing/files";

/**
 * Extract window.__INITIAL_STATE__ JSON from the Atlassian Marketplace HTML.
 *
 * The JSON is large and contains unicode escapes, so a simple regex with
 * non-greedy `[\s\S]*?` fails. We use brace-matching to find the real end.
 */
function extractInitialState(html: string): Record<string, any> | null {
  const startMarker = "window.__INITIAL_STATE__ = ";
  const idx = html.indexOf(startMarker);
  if (idx === -1) return null;

  const jsonStart = idx + startMarker.length;

  // Brace-match to find the end of the JSON object
  let depth = 0;
  let inString = false;
  let realEnd = 0;

  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++; // skip escaped char
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        realEnd = i + 1;
        break;
      }
    }
  }

  if (realEnd === 0) {
    log.warn("brace-matching failed for __INITIAL_STATE__");
    return null;
  }

  try {
    return JSON.parse(html.substring(jsonStart, realEnd));
  } catch (err) {
    log.warn("failed to parse __INITIAL_STATE__ JSON", { error: String(err) });
    return null;
  }
}

/**
 * Build a logo URL from the Atlassian CDN file ID.
 */
function buildLogoUrl(logo: any): string {
  if (!logo) return "";
  const id = logo.highRes || logo.image;
  if (!id) return "";
  return `${LOGO_BASE}/${id}`;
}

/**
 * Parse category page HTML to extract app listings from the Apollo cache.
 *
 * The Atlassian Marketplace uses React + Apollo Client.
 * State lives in `window.__INITIAL_STATE__.apolloInitialState`.
 *
 * Category query is at ROOT_QUERY.marketplaceCategory:{slug,filters,sort,pageNumber}
 * which contains:
 * - category.__ref → MarketplaceStoreCategoryResponse:{slug} (name, description)
 * - apps.edges[] → ordered array of {node.__ref: "AppTile:{id}"}
 * - apps.pageInfo → {totalCount, hasNextPage, totalPages}
 *
 * AppTile entries are resolved from the cache by __ref.
 */
export function parseAtlassianCategoryPage(
  html: string,
  categorySlug: string,
): NormalizedCategoryPage {
  const apps: NormalizedCategoryApp[] = [];
  let categoryTitle = categorySlug.replace(/-/g, " ");
  let categoryDescription = "";
  let totalCount: number | null = null;
  let hasNextPage = false;

  const state = extractInitialState(html);

  if (state) {
    const apollo = state.apolloInitialState || state;
    const rootQuery = apollo.ROOT_QUERY || {};

    // Extract category metadata
    for (const [key, value] of Object.entries(apollo)) {
      if (!key.startsWith("MarketplaceStoreCategoryResponse")) continue;
      const cat = value as Record<string, any>;
      if (cat.slug === categorySlug || cat.id === categorySlug) {
        categoryTitle = cat.name || categoryTitle;
        categoryDescription = cat.heroSection?.description || "";
        break;
      }
    }

    // Find the marketplaceCategory query for this slug
    let categoryQuery: Record<string, any> | null = null;
    for (const [key, value] of Object.entries(rootQuery)) {
      if (key.startsWith("marketplaceCategory") && key.includes(`"slug":"${categorySlug}"`)) {
        categoryQuery = value as Record<string, any>;
        break;
      }
    }

    if (categoryQuery?.apps) {
      const pageInfo = categoryQuery.apps.pageInfo;
      if (pageInfo) {
        totalCount = pageInfo.totalCount ?? null;
        hasNextPage = pageInfo.hasNextPage ?? false;
      }

      // Extract apps in order from edges
      const edges = categoryQuery.apps.edges || [];
      for (let i = 0; i < edges.length; i++) {
        const ref = edges[i]?.node?.__ref;
        if (!ref) continue;

        const tile = apollo[ref] as Record<string, any> | undefined;
        if (!tile || (!tile.addonKey && !tile.name)) continue;

        // Resolve vendor name from ref
        let vendorName = "";
        if (tile.vendor?.__ref && apollo[tile.vendor.__ref]) {
          vendorName = (apollo[tile.vendor.__ref] as any).name || "";
        }

        // Badges
        const badges: string[] = [];
        if (tile.programs?.cloudFortified?.status === "approved") {
          badges.push("cloud_fortified");
        }
        const marketingTags = tile.tags?.marketingLabels || [];
        if (marketingTags.includes("Top Vendor")) {
          badges.push("top_vendor");
        }

        const totalInstalls = tile.distribution?.activeInstalls ?? tile.distribution?.totalInstalls ?? null;

        apps.push({
          slug: tile.addonKey || "",
          name: tile.name || "",
          shortDescription: tile.tagLine || "",
          averageRating: tile.ratings?.avgStars ?? 0,
          ratingCount: tile.ratings?.numRatings ?? 0,
          logoUrl: buildLogoUrl(tile.logo),
          pricingHint: undefined,
          position: i + 1,
          isSponsored: false,
          badges,
          externalId: tile.addonId ? String(tile.addonId) : undefined,
          extra: {
            ...(vendorName && { vendorName }),
            ...(totalInstalls != null && { totalInstalls }),
          },
        });
      }
    } else {
      // Fallback: unordered AppTile scan (e.g. if ROOT_QUERY structure changes)
      for (const [key, value] of Object.entries(apollo)) {
        if (!key.startsWith("AppTile:")) continue;
        const tile = value as Record<string, any>;
        if (!tile.addonKey && !tile.name) continue;

        let vendorName = "";
        if (tile.vendor?.__ref && apollo[tile.vendor.__ref]) {
          vendorName = (apollo[tile.vendor.__ref] as any).name || "";
        }

        const badges: string[] = [];
        if (tile.programs?.cloudFortified?.status === "approved") {
          badges.push("cloud_fortified");
        }
        const marketingTags = tile.tags?.marketingLabels || [];
        if (marketingTags.includes("Top Vendor")) {
          badges.push("top_vendor");
        }

        const totalInstalls = tile.distribution?.activeInstalls ?? tile.distribution?.totalInstalls ?? null;

        apps.push({
          slug: tile.addonKey || "",
          name: tile.name || "",
          shortDescription: tile.tagLine || "",
          averageRating: tile.ratings?.avgStars ?? 0,
          ratingCount: tile.ratings?.numRatings ?? 0,
          logoUrl: buildLogoUrl(tile.logo),
          pricingHint: undefined,
          position: apps.length + 1,
          isSponsored: false,
          badges,
          externalId: tile.addonId ? String(tile.addonId) : undefined,
          extra: {
            ...(vendorName && { vendorName }),
            ...(totalInstalls != null && { totalInstalls }),
          },
        });
      }
    }
  }

  log.info("parsed category page", {
    categorySlug,
    appCount: apps.length,
    totalCount,
    hasNextPage,
  });

  return {
    slug: categorySlug,
    url: `https://marketplace.atlassian.com/categories/${categorySlug}`,
    title: categoryTitle,
    description: categoryDescription,
    appCount: totalCount ?? (apps.length || null),
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}
