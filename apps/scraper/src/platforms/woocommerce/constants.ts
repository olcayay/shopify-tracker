import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Seed categories for the WooCommerce Marketplace — 8 real categories (flat). */
export const WOOCOMMERCE_SEED_CATEGORIES = [
  "payment-gateways",
  "shipping-delivery-and-fulfillment",
  "conversion",
  "merchandising",
  "store-content-and-customizations",
  "operations",
  "marketing-extensions",
  "free-extensions",
] as const;

/** Curated/editorial sections treated as featured sightings, not real categories. */
export const WOOCOMMERCE_FEATURED_SECTION_SLUGS = [
  "_featured",
  "_all",
  "developed-by-woo",
] as const;

export const WOOCOMMERCE_PAGE_SIZE = 60;

export const WOOCOMMERCE_CONSTANTS: PlatformConstants = {
  seedCategories: [...WOOCOMMERCE_SEED_CATEGORIES],
  featuredSectionSlugs: [...WOOCOMMERCE_FEATURED_SECTION_SLUGS],
  maxCategoryDepth: 0, // Flat categories
  defaultPagesPerCategory: 6, // ~350 max per category / 60 per page
  trackedFields: [
    "shortDescription",
    "pricing",
    "categories",
    "vendorName",
    "vendorUrl",
  ],
  rateLimit: { minDelayMs: 300, maxDelayMs: 800 },
};

export const WOOCOMMERCE_SCORING: PlatformScoringConfig = {
  pageSize: WOOCOMMERCE_PAGE_SIZE,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "woocommerce", "woo", "wordpress", "plugin", "extension",
    "store", "shop", "ecommerce", "marketplace",
    "the", "and", "for", "your", "our",
  ]),
};
