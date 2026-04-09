import { createLogger, normalizePricingModel } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("salesforce:search-app-parser");

/**
 * Parse basic app details from a Salesforce search API result card.
 *
 * This is a fallback when browser-based SPA scraping fails.
 * Search API cards provide core fields but lack full description,
 * highlights, detailed publisher info, media, and pricing plans.
 */
export function parseAppFromSearchResult(card: Record<string, any>, slug: string): NormalizedAppDetails {
  log.info("parsing app details from search API card", { slug, title: card.title });

  // Find best logo URL
  const logos = card.logos || [];
  const logo = logos.find((l: any) => l.logoType === "Logo")
    || logos.find((l: any) => l.logoType === "Big Logo")
    || logos[0];
  const iconUrl = logo?.mediaId || null;

  return {
    name: card.title || slug,
    slug: card.oafId || slug,
    averageRating: card.averageRating ?? null,
    ratingCount: card.reviewsAmount ?? null,
    pricingHint: card.pricing || null,
    pricingModel: normalizePricingModel(card.pricing || null),
    iconUrl,
    developer: card.publisher ? { name: card.publisher } : null,
    badges: [],
    platformData: {
      description: card.description || null,
      fullDescription: null, // Not available in search results
      highlights: [],
      publishedDate: null,
      languages: [],
      listingCategories: card.listingCategories || [],
      productsSupported: [],
      productsRequired: [],
      pricingModelType: card.pricing || null,
      pricingPlans: [],
      publisher: card.publisher ? { name: card.publisher } : null,
      technology: card.type || undefined,
      editions: [],
      supportedIndustries: [],
      targetUserPersona: [],
      solution: null,
      businessNeeds: [],
      plugins: null,
      sponsored: card.sponsored || false,
      source: "search-api",
    },
  };
}
