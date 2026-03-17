import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Seed categories — popular WordPress plugin tags + browse sections.
 *
 * Tags come from the `hot_tags` API endpoint.
 * Browse sections use a `_browse_` prefix and map to `browse=<type>` API param.
 */
export const WORDPRESS_SEED_CATEGORIES = [
  // Original 12 popular tags
  "contact-form",
  "woocommerce",
  "seo",
  "ecommerce",
  "social",
  "security",
  "email",
  "gallery",
  "analytics",
  "admin",
  "widget",
  "page-builder",
  // Additional tags from hot_tags API
  "post",
  "gutenberg",
  "block",
  "payment",
  "elementor",
  "ai",
  "payment-gateway",
  "slider",
  "spam",
  "form",
  "search",
  "editor",
  "performance",
  "menu",
  "embed",
  "chat",
  "shipping",
  "marketing",
  "popup",
  "events",
  "calendar",
  "newsletter",
  "redirect",
  "cache",
  "products",
  "automation",
  "login",
  "video",
  // Browse sections (curated lists)
  "_browse_popular",
  "_browse_featured",
  "_browse_blocks",
] as const;

/** Prefix used for browse-section slugs */
export const BROWSE_PREFIX = "_browse_";

export const WORDPRESS_CONSTANTS: PlatformConstants = {
  seedCategories: [...WORDPRESS_SEED_CATEGORIES],
  maxCategoryDepth: 0,              // Flat tags, no hierarchy
  defaultPagesPerCategory: 2,       // API returns up to 250 per page → 500 plugins/tag
  trackedFields: [
    "shortDescription",
    "description",
    "version",
    "testedUpTo",
    "requiresWP",
    "requiresPHP",
    "activeInstalls",
    "downloaded",
    "lastUpdated",
    "added",
    "contributors",
    "tags",
    "supportThreads",
    "supportThreadsResolved",
    "businessModel",
  ],
  rateLimit: { minDelayMs: 500, maxDelayMs: 1000 },
};

export const WORDPRESS_SCORING: PlatformScoringConfig = {
  pageSize: 250,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "wordpress", "wp", "plugin", "plugins", "widget",
    "app", "apps", "the", "and", "for", "your", "our",
  ]),
};
