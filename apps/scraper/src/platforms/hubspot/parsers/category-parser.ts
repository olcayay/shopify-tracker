import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { HUBSPOT_PAGE_SIZE } from "../constants.js";

const log = createLogger("hubspot:category-parser");

/**
 * Parse category page from CHIRP API search response.
 * Input: JSON string from PersonalizationPublicRpc/search
 *
 * Note: The CHIRP search API returns all apps sorted by install count,
 * regardless of category. Category assignment happens in the app detail scraper.
 */
export function parseHubSpotCategoryPage(
  json: string,
  categorySlug: string,
  url: string,
): NormalizedCategoryPage {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    log.warn("failed to parse category JSON", { categorySlug });
    return emptyCategoryPage(categorySlug, url);
  }

  const total: number = data?.data?.total ?? 0;
  const cards: any[] = data?.data?.cards ?? [];

  const apps: NormalizedCategoryApp[] = cards.map((card: any, idx: number) => ({
    position: idx + 1,
    slug: card.slug || "",
    name: card.listingName || card.slug || "",
    shortDescription: card.description || "",
    averageRating: 0,
    ratingCount: 0,
    logoUrl: card.iconUrl || "",
    isSponsored: false,
    badges: buildCardBadges(card),
    extra: {
      installCount: card.installCount ?? null,
      companyName: card.companyName || null,
      displayTag: card.displayTag || null,
    },
  }));

  const hasNextPage = apps.length >= HUBSPOT_PAGE_SIZE && total > 0;

  const title = categorySlug
    .split("--")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" > ");

  log.info("parsed category page from CHIRP", { categorySlug, appsFound: apps.length, total, hasNextPage });

  return {
    slug: categorySlug,
    url,
    title,
    description: "",
    appCount: total,
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}

function emptyCategoryPage(slug: string, url: string): NormalizedCategoryPage {
  return {
    slug,
    url,
    title: slug,
    description: "",
    appCount: 0,
    apps: [],
    subcategoryLinks: [],
    hasNextPage: false,
  };
}

function buildCardBadges(card: any): string[] {
  const badges: string[] = [];
  const products: any[] = card.products || [];
  for (const p of products) {
    if (p.certified) badges.push("Certified");
    if (p.builtByHubSpot) badges.push("Built by HubSpot");
  }
  return [...new Set(badges)];
}
