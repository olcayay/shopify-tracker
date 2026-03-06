import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

export const SHOPIFY_CONSTANTS: PlatformConstants = {
  seedCategories: [
    "finding-products",
    "selling-products",
    "orders-and-shipping",
    "store-design",
    "marketing-and-conversion",
    "store-management",
  ],
  maxCategoryDepth: 4,
  defaultPagesPerCategory: 10,
  trackedFields: [
    "appIntroduction",
    "appDetails",
    "seoTitle",
    "seoMetaDescription",
    "features",
    "pricing",
    "averageRating",
    "ratingCount",
    "developer",
    "demoStoreUrl",
    "languages",
    "integrations",
    "categories",
    "pricingPlans",
    "support",
  ],
  rateLimit: { minDelayMs: 1500, maxDelayMs: 3000 },
};

export const SHOPIFY_SCORING: PlatformScoringConfig = {
  pageSize: 24,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.25,
    feature: 0.25,
    keyword: 0.25,
    text: 0.25,
  },
  stopWords: new Set([
    "shopify", "store", "shop", "app", "apps", "the", "and", "for",
    "with", "your", "this", "that", "from", "are", "all", "you",
    "can", "will", "has", "have", "not", "but", "they", "more",
    "their", "what", "when", "out", "also", "its", "our", "how",
    "get", "use", "new", "one", "just", "make", "any", "about",
  ]),
};
