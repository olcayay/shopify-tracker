import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/**
 * Salesforce category tree: parent slug → array of child slugs.
 * Source: files/salesforce/category-tree.json
 */
export const SALESFORCE_CATEGORY_CHILDREN: Record<string, string[]> = {
  sales: ["contractManagement", "forecasting", "geolocation", "leadAndOpportunityManagement", "partnerManagement", "quotesAndOrders", "salesIntelligence", "salesMethodologies", "salesProductivity"],
  marketing: ["accountBasedMarketing", "campaignManagement", "eventManagement", "feeds", "loyalty", "marketingAndIntelligence", "marketingAutomation", "massEmailsAndMessaging", "personalization", "socialChannels", "surveys", "testingAndSegmentation", "websites"],
  itAndAdministration: ["adminAndDeveloperTools", "auditAndCompliance", "dataManagement", "dataMigration", "developerTools", "informationManagement", "integration", "itManagement", "searchAndRecommendation", "security", "translation"],
  customerService: ["agentProductivity", "caseManagement", "fieldService", "routePlanning", "telephony"],
  finance: ["accounting", "compensationManagement", "grantManagement", "timeAndExpense"],
  analytics: ["analyticsAndSiteMonitoring", "dashboardsAndReports", "dataCleansing", "dataVisualization"],
  productivity: ["alerts", "documentGeneration", "documentManagement", "emailAndCalendarSync", "processManagement", "projectManagement", "timeAndDate"],
  commerce: ["eCommerce", "liveCommerce", "marketplace", "paymentsProcessing", "pointOfSaleAndInStore", "productInformationManagement", "ratingsAndReviews", "shippingFulfillmentAndLogistics", "subscriptions", "warrantyAndReturnsManagement"],
  collaboration: ["chatAndWebConferencing", "conversationalCommerce"],
  enterpriseResourcePlanning: ["humanResources", "orderAndInventoryManagement", "peopleManagement", "punchoutSystem", "warehouseManagementSystem"],
};

export const SALESFORCE_CONSTANTS: PlatformConstants = {
  seedCategories: Object.keys(SALESFORCE_CATEGORY_CHILDREN),
  maxCategoryDepth: 1, // Two-level tree (parent → children)
  defaultPagesPerCategory: 10,
  trackedFields: [
    "averageRating",
    "ratingCount",
    "description",
    "listingCategories",
    "publisher",
    "pricing",
  ],
  rateLimit: { minDelayMs: 200, maxDelayMs: 500 },
  concurrentSeedCategories: 5, // HTTP-only API with adaptive backoff as safety net
  // Salesforce category API returns every tracked field in the card JSON,
  // so we can refresh snapshots daily for the whole catalog at zero cost.
  refreshSnapshotFromCategoryCard: true,
  refreshSnapshotMaxAgeMs: 20 * 60 * 60 * 1000,
  // Per-app detail fetch: HTTP primary (partners/experience/listings endpoint),
  // browser as automatic fallback. Flip to "browser" here to revert.
  appDetailFetchMode: "http",
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
