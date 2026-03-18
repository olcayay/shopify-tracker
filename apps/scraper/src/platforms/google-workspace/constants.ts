import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Top-level category slugs used as seeds for category scraping.
 * Discovered from live sidebar navigation. */
export const GOOGLE_WORKSPACE_SEED_CATEGORIES = [
  "business-tools",
  "communication",
  "productivity",
  "education",
  "utilities",
  "enterprise-apps",
  "featured-partner-apps",
  "google-apps",
  "popular-apps",
  "top-rated",
  "recommended",
  "apps-to-discover",
  "business-essentials",
  "work-from-everywhere",
] as const;

export const GOOGLE_WORKSPACE_CONSTANTS: PlatformConstants = {
  seedCategories: [...GOOGLE_WORKSPACE_SEED_CATEGORIES],
  maxCategoryDepth: 1, // Two-level: parent categories → child sub-categories
  defaultPagesPerCategory: 1,
  trackedFields: [
    "shortDescription",
    "detailedDescription",
    "developer",
    "category",
    "pricingModel",
    "screenshots",
    "worksWithApps",
    "casaCertified",
    "installCount",
  ],
  rateLimit: { minDelayMs: 3000, maxDelayMs: 5000 }, // Conservative for Google
};

export const GOOGLE_WORKSPACE_SCORING: PlatformScoringConfig = {
  pageSize: 20,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "google", "workspace", "marketplace", "sheets", "docs", "drive", "gmail",
    "addon", "add-on", "app", "apps", "the", "and", "for",
    "with", "your", "this", "that", "from", "are", "all", "you",
    "can", "will", "has", "have", "not", "but", "they", "more",
    "their", "what", "when", "out", "also", "its", "our", "how",
  ]),
};
