import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("salesforce-app-parser");

/**
 * Parse Salesforce AppExchange app detail page.
 *
 * Phase 1 stub: attempts best-effort regex extraction of `window.stores.LISTING.listing`
 * from the HTML. If extraction fails, returns minimal data (name/slug only).
 * Full implementation requires Playwright for SPA rendering (Phase 2).
 */
export function parseSalesforceAppPage(html: string, slug: string): NormalizedAppDetails {
  // Try to extract window.stores JSON
  const storesMatch = html.match(/window\.stores\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (storesMatch) {
    try {
      const stores = JSON.parse(storesMatch[1]);
      const listing = stores?.LISTING?.listing;
      if (listing) {
        return {
          name: listing.title || slug,
          slug,
          averageRating: listing.averageRating ?? null,
          ratingCount: listing.reviewsAmount ?? null,
          pricingHint: listing.pricing || null,
          iconUrl: extractLogoUrl(listing.logos),
          developer: listing.publisher
            ? { name: typeof listing.publisher === "string" ? listing.publisher : listing.publisher.name || "" }
            : null,
          badges: [],
          platformData: {
            description: listing.description,
            listingCategories: listing.listingCategories,
            type: listing.type,
            publisher: listing.publisher,
          },
        };
      }
    } catch (err) {
      log.warn("failed to parse window.stores JSON", { slug, error: String(err) });
    }
  }

  // Fallback: try to get title from HTML <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const name = titleMatch
    ? titleMatch[1].replace(/\s*[-|]\s*Salesforce AppExchange.*$/i, "").trim()
    : slug;

  log.info("app page parsed with minimal data (stub)", { slug });

  return {
    name,
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

function extractLogoUrl(logos?: { mediaId: string; logoType: string }[]): string | null {
  if (!logos || logos.length === 0) return null;
  const logo = logos.find((l) => l.logoType === "Logo");
  return (logo || logos[0]).mediaId || null;
}
