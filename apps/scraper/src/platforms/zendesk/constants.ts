import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/** Seed categories for the Zendesk Marketplace — 16 flat categories. */
export const ZENDESK_SEED_CATEGORIES = [
  "ai-and-bots",
  "agent-productivity",
  "contact-center",
  "crm-and-marketing",
  "ecommerce-and-payments",
  "it-and-hr",
  "knowledge-and-content-management",
  "messaging",
  "product-and-project-management",
  "reporting-and-analytics",
  "security-risk-and-compliance",
  "surveys-and-reviews",
  "translations",
  "video",
  "wem",
  "workflows",
] as const;

/** Display names for Zendesk categories (slug → human-readable title). */
export const ZENDESK_CATEGORY_NAMES: Record<string, string> = {
  "ai-and-bots": "AI and Bots",
  "agent-productivity": "Agent Productivity",
  "contact-center": "Contact Center",
  "crm-and-marketing": "CRM and Marketing",
  "ecommerce-and-payments": "E-Commerce and Payments",
  "it-and-hr": "IT and HR",
  "knowledge-and-content-management": "Knowledge and Content Management",
  "messaging": "Messaging",
  "product-and-project-management": "Product and Project Management",
  "reporting-and-analytics": "Reporting and Analytics",
  "security-risk-and-compliance": "Security, Risk and Compliance",
  "surveys-and-reviews": "Surveys and Reviews",
  "translations": "Translations",
  "video": "Video",
  "wem": "Workforce Engagement Management",
  "workflows": "Workflows",
};

export const ZENDESK_CONSTANTS: PlatformConstants = {
  seedCategories: [...ZENDESK_SEED_CATEGORIES],
  maxCategoryDepth: 0, // Flat: no subcategories
  defaultPagesPerCategory: 1, // Pagination via scroll; initial page
  trackedFields: [
    "shortDescription",
    "longDescription",
    "installationInstructions",
    "pricing",
    "datePublished",
    "version",
    "categories",
    "products",
    "authorName",
    "authorUrl",
  ],
  rateLimit: { minDelayMs: 2000, maxDelayMs: 5000 },
};

export const ZENDESK_SCORING: PlatformScoringConfig = {
  pageSize: 24,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0,
    keyword: 0.30,
    text: 0.35,
  },
  stopWords: new Set([
    "zendesk", "support", "ticket", "tickets", "agent", "agents",
    "customer", "customers", "marketplace", "app", "apps", "helpdesk",
    "the", "and", "for", "your", "our",
  ]),
};
