import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

export const SALESFORCE_CONSTANTS: PlatformConstants = {
  seedCategories: [
    "marketing",
    "customerService",
    "fieldService",
    "sales",
    "productivity",
    "humanResources",
    "commerce",
    "caseManagement",
    "campaignManagement",
    "contractManagement",
    "documentGeneration",
    "processManagement",
    "dataManagement",
    "collaboration",
    "websites",
    "telephony",
  ],
  maxCategoryDepth: 0, // Flat structure, no subcategories
  defaultPagesPerCategory: 10,
  trackedFields: [
    "averageRating",
    "ratingCount",
    "description",
    "listingCategories",
    "publisher",
    "pricing",
  ],
  rateLimit: { minDelayMs: 500, maxDelayMs: 1500 },
};

/** Headers required for Salesforce AppExchange API to return correct search rankings */
export const SALESFORCE_API_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "x-use-new-search": "true",
  Origin: "https://appexchange.salesforce.com",
  Referer: "https://appexchange.salesforce.com/",
};

export const SALESFORCE_SCORING: PlatformScoringConfig = {
  pageSize: 12,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.35,
    feature: 0.0, // No feature taxonomy
    keyword: 0.35,
    text: 0.30,
  },
  stopWords: new Set([
    "salesforce", "app", "apps", "the", "and", "for",
    "with", "your", "this", "that", "from", "are", "all", "you",
    "can", "will", "has", "have", "not", "but", "they", "more",
    "their", "what", "when", "out", "also", "its", "our", "how",
    "get", "use", "new", "one", "just", "make", "any", "about",
    "data", "cloud", "platform", "solution",
  ]),
};
