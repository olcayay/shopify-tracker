import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/**
 * Wix App Market seed categories.
 * Compound slugs use -- separator (e.g. booking--events maps to /category/booking/events).
 */
export const WIX_SEED_CATEGORIES = [
  "marketing",
  "ecommerce",
  "booking--events",
  "media--content",
  "design-elements",
  "communication",
] as const;

export const WIX_CONSTANTS: PlatformConstants = {
  seedCategories: [...WIX_SEED_CATEGORIES],
  maxCategoryDepth: 1, // Parent → subcategories
  defaultPagesPerCategory: 1, // All apps loaded on one page
  trackedFields: [
    "tagline",
    "description",
    "fullDescription",
    "developer",
    "categories",
    "collections",
    "pricingPlans",
    "languages",
    "availability",
  ],
  rateLimit: { minDelayMs: 1000, maxDelayMs: 2000 }, // No Cloudflare, simple HTTP
};

export const WIX_SCORING: PlatformScoringConfig = {
  pageSize: 50,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,  // No feature taxonomy
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "wix", "app", "apps", "the", "and", "for",
    "with", "your", "this", "that", "from", "are", "all", "you",
    "can", "will", "has", "have", "not", "but", "they", "more",
    "their", "what", "when", "out", "also", "its", "our", "how",
    "get", "use", "new", "one", "just", "make", "any", "about",
    "website", "site", "sites", "web",
  ]),
};
