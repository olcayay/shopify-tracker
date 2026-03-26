import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("zendesk:algolia-app-parser");

/**
 * Parse app details from an Algolia search hit.
 *
 * This is a fallback for when browser-based scraping fails (Cloudflare blocks).
 * Algolia provides basic fields but lacks full description, badges, and screenshots.
 */
export function parseAppFromAlgolia(hit: Record<string, any>, slug: string): NormalizedAppDetails {
  log.info("parsing app details from Algolia hit", { slug, name: hit.name });

  // Extract product/id/textSlug from URL
  const urlMatch = (hit.url || "").match(/\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/);
  const product = urlMatch?.[1] || hit.products?.[0] || "support";
  const numericId = urlMatch?.[2] || String(hit.id || "");
  const textSlug = urlMatch?.[3] || hit.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "";
  const computedSlug = numericId ? `${numericId}--${textSlug}` : slug;

  const rating = hit.rating || {};

  // Map categories
  const categories = Array.isArray(hit.categories)
    ? hit.categories.map((c: any) => ({
        slug: (c.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: c.name,
      }))
    : [];

  return {
    name: hit.name || slug,
    slug: computedSlug,
    averageRating: rating.average ?? null,
    ratingCount: rating.total_count ?? null,
    pricingHint: hit.tile_display_price || hit.display_price || null,
    iconUrl: hit.icon_url || null,
    developer: hit.author_name
      ? { name: hit.author_name, url: hit.author_url || undefined }
      : null,
    badges: [],
    platformData: {
      shortDescription: hit.short_description || null,
      longDescription: null, // Not available in Algolia
      installationInstructions: null,
      pricing: hit.display_price || null,
      datePublished: hit.date_published || null,
      version: hit.version || null,
      categories,
      products: hit.products || [product],
      externalId: product,
      source: "algolia",
    },
  };
}
