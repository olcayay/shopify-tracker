import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Seed categories for the HubSpot App Marketplace — 6 top-level categories (hierarchical). */
export const HUBSPOT_SEED_CATEGORIES = [
  "sales",
  "marketing",
  "service",
  "commerce",
  "operations",
  "content",
] as const;

/** Display names for HubSpot categories (slug -> human-readable title). */
export const HUBSPOT_CATEGORY_NAMES: Record<string, string> = {
  sales: "Sales",
  marketing: "Marketing",
  service: "Service",
  commerce: "Commerce",
  operations: "Operations",
  content: "Content",
};

/** CHIRP API page size — always returns 100 cards per request regardless of limit param. */
export const HUBSPOT_PAGE_SIZE = 100;

export const HUBSPOT_CONSTANTS: PlatformConstants = {
  seedCategories: [...HUBSPOT_SEED_CATEGORIES],
  maxCategoryDepth: 1, // Hierarchical: 2 levels
  defaultPagesPerCategory: 22, // 100 apps/page via CHIRP API, ~2200 total apps
  trackedFields: [
    "shortDescription",
    "longDescription",
    "pricing",
    "categories",
    "authorName",
    "authorUrl",
    "version",
  ],
  rateLimit: { minDelayMs: 1000, maxDelayMs: 3000 },
};

export const HUBSPOT_SCORING: PlatformScoringConfig = {
  pageSize: HUBSPOT_PAGE_SIZE,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "hubspot", "crm", "marketing", "sales", "service",
    "integration", "connector", "marketplace", "app", "apps", "hub",
    "the", "and", "for", "your", "our",
  ]),
};
