import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { ZENDESK_CATEGORY_NAMES } from "../constants.js";

const log = createLogger("zendesk:category-parser");

/** Shape of a single Algolia hit from Zendesk's appsIndex. */
export interface ZendeskAlgoliaHit {
  id: number;
  name: string;
  url: string; // e.g. "/apps/support/849231/stylo-assist/"
  icon_url: string;
  short_description: string;
  author_name: string;
  author_url: string;
  products: string[]; // ["support", "sell", ...]
  categories: Array<{ id: number; name: string }>;
  rating: { total_count: number; average: number };
  display_price: string;
  tile_display_price: string;
  date_published: string;
  version: string;
  objectID: string;
}

/** Algolia query response (single index result). */
export interface ZendeskAlgoliaResult {
  hits: ZendeskAlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

/**
 * Parse Zendesk category data from Algolia API JSON response.
 * Input is the raw JSON string from the Algolia multi-index endpoint.
 */
export function parseZendeskCategoryPage(
  json: string,
  categorySlug: string,
  _url: string,
): NormalizedCategoryPage {
  let result: ZendeskAlgoliaResult;
  try {
    const parsed = JSON.parse(json);
    // Algolia returns { results: [...] } — we use the first result
    result = parsed.results?.[0] ?? parsed;
  } catch (e) {
    log.error("failed to parse Algolia JSON", { categorySlug, error: String(e) });
    return {
      slug: categorySlug,
      url: _url,
      title: ZENDESK_CATEGORY_NAMES[categorySlug] || categorySlug,
      description: "",
      appCount: null,
      apps: [],
      subcategoryLinks: [],
      hasNextPage: false,
    };
  }

  const apps: NormalizedCategoryApp[] = result.hits.map((hit, idx) => {
    // Slug: {numericId}--{text-slug} from URL "/apps/support/849231/stylo-assist/"
    const urlMatch = hit.url.match(/\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/);
    const numericId = urlMatch?.[2] ?? String(hit.id);
    const textSlug = urlMatch?.[3] ?? hit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const product = urlMatch?.[1] ?? hit.products?.[0] ?? "support";

    return {
      slug: `${numericId}--${textSlug}`,
      name: hit.name,
      shortDescription: hit.short_description || "",
      averageRating: hit.rating?.average ?? 0,
      ratingCount: hit.rating?.total_count ?? 0,
      logoUrl: hit.icon_url || "",
      pricingHint: hit.tile_display_price || hit.display_price || undefined,
      position: idx + 1,
      isSponsored: false,
      badges: [],
      externalId: product,
    };
  });

  const hasNextPage = result.page < result.nbPages - 1;

  log.info("parsed category page (Algolia)", {
    category: categorySlug,
    appsFound: apps.length,
    totalHits: result.nbHits,
    page: result.page + 1,
    totalPages: result.nbPages,
    hasNextPage,
  });

  return {
    slug: categorySlug,
    url: _url,
    title: ZENDESK_CATEGORY_NAMES[categorySlug] || categorySlug,
    description: "",
    appCount: result.nbHits || apps.length || null,
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}
