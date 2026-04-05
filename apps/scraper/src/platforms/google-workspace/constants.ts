import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Real taxonomy category slugs used as seeds for category scraping. */
export const GOOGLE_WORKSPACE_SEED_CATEGORIES = [
  "business-tools",
  "communication",
  "productivity",
  "education",
  "utilities",
  "enterprise-apps",
] as const;

/** Curated/editorial sections that look like categories but are featured app lists.
 * These are scraped via the category flow but recorded as featured_app_sightings. */
export const GOOGLE_WORKSPACE_FEATURED_SECTIONS = [
  "apps-to-discover",
  "business-essentials",
  "featured-partner-apps",
  "google-apps",
  "popular-apps",
  "recommended",
  "top-rated",
  "work-from-everywhere",
] as const;

export const GOOGLE_WORKSPACE_CONSTANTS: PlatformConstants = {
  seedCategories: [...GOOGLE_WORKSPACE_SEED_CATEGORIES, ...GOOGLE_WORKSPACE_FEATURED_SECTIONS],
  featuredSectionSlugs: [...GOOGLE_WORKSPACE_FEATURED_SECTIONS],
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
  rateLimit: { minDelayMs: 500, maxDelayMs: 1500 }, // REST API
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
