import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Seed categories for the Atlassian Marketplace.
 *  These are the 10 official categories shown on marketplace.atlassian.com/categories */
export const ATLASSIAN_SEED_CATEGORIES = [
  "project-management",
  "admin-tools",
  "content-communication",
  "data-analytics",
  "software-development",
  "it-support-service",
  "design-diagramming",
  "security-compliance",
  "hr-team-building",
  "sales-customer-relations",
] as const;

export const ATLASSIAN_CONSTANTS: PlatformConstants = {
  seedCategories: [...ATLASSIAN_SEED_CATEGORIES],
  maxCategoryDepth: 0,               // Flat categories
  defaultPagesPerCategory: 1,        // HTML SSR: only page 1 available (~18 apps), SPA pagination via internal GraphQL
  trackedFields: [
    "tagLine",
    "summary",
    "description",
    "fullDescription",
    "hostingVisibility",
    "totalInstalls",
    "downloads",
    "categories",
    "cloudFortified",
    "topVendor",
    "vendorName",
    "appId",
    "version",
    "paymentModel",
    "releaseDate",
    "licenseType",
    "compatibilities",
    "highlights",
    "vendorLinks",
    "supportEmail",
    "supportUrl",
  ],
  rateLimit: { minDelayMs: 300, maxDelayMs: 800 },
};

export const ATLASSIAN_SCORING: PlatformScoringConfig = {
  pageSize: 50,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "atlassian", "jira", "confluence", "bitbucket", "marketplace",
    "plugin", "addon", "app", "apps", "cloud", "server", "datacenter",
    "the", "and", "for", "your", "our",
  ]),
};

/** Featured collection section handles */
export const ATLASSIAN_FEATURED_SECTIONS = [
  { marketingLabel: "Spotlight", sectionHandle: "_collection_spotlight", sectionTitle: "Spotlight" },
  { marketingLabel: "Bestseller", sectionHandle: "_collection_bestseller", sectionTitle: "Bestseller" },
  { marketingLabel: "Rising Star", sectionHandle: "_collection_risingstar", sectionTitle: "Rising Star" },
] as const;
