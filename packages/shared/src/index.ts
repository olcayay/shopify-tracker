// Types
export type {
  FirstPageApp,
  FirstPageMetrics,
  CategoryNode,
  CategoryPageData,
} from "./types/category.js";

export type {
  AppDeveloper,
  AppFeature,
  AppSubcategoryGroup,
  AppCategory,
  PricingPlan,
  AppSupport,
  AppDetails,
  CommonAppDetails,
} from "./types/app.js";

export type {
  CommonApp,
  CommonSearchResult,
  CommonCategory,
} from "./types/common.js";

export type { Review, ReviewPageData } from "./types/review.js";

export type {
  KeywordSearchApp,
  SearchPageData,
} from "./types/keyword.js";

export type {
  ScraperType,
  ScrapeRunStatus,
  ScrapeRunMetadata,
} from "./types/scraper.js";

// Platform data types
export type {
  PlatformDataMap,
  PlatformData,
  AnyPlatformData,
  ShopifyPlatformData,
  SalesforcePlatformData,
  CanvaPlatformData,
  WixPlatformData,
  WordPressPlatformData,
  GoogleWorkspacePlatformData,
  AtlassianPlatformData,
  ZoomPlatformData,
  ZohoPlatformData,
  ZendeskPlatformData,
  HubSpotPlatformData,
} from "./types/platform-data/index.js";
export { getPlatformData } from "./types/platform-data/index.js";
export { validatePlatformData } from "./types/platform-data/schemas.js";

// Constants
export { SEED_CATEGORY_SLUGS, MAX_CATEGORY_DEPTH } from "./constants/seed-categories.js";
export { urls } from "./constants/urls.js";
export {
  PLATFORMS,
  PLATFORM_IDS,
  BROWSER_REQUIREMENTS,
  needsBrowser,
  isPlatformId,
  getPlatform,
  buildExternalAppUrl,
  buildExternalCategoryUrl,
  buildExternalSearchUrl,
} from "./constants/platforms.js";
export type {
  PlatformId,
  PlatformConfig,
  PlatformCapabilities,
} from "./constants/platforms.js";

// Field Labels
export { getFieldLabels } from "./constants/field-labels.js";
export type { PlatformFieldLabels } from "./constants/field-labels.js";

// Keyword extraction
export {
  COMMON_STOP_WORDS,
  getStopWords,
  KEYWORD_STOP_WORDS,
  FIELD_WEIGHTS,
  generateNgrams,
  extractKeywordsFromAppMetadata,
} from "./keyword-extraction.js";
export type {
  AppMetadataInput,
  KeywordSource,
  ScoredKeyword,
} from "./keyword-extraction.js";

// Similarity
export {
  COMMON_SIMILARITY_STOP_WORDS,
  getSimilarityStopWords,
  STOP_WORDS,
  SIMILARITY_WEIGHTS,
  getSimilarityWeights,
  jaccard,
  tokenize,
  extractCategorySlugs,
  extractCategorySlugsFromPlatformData,
  extractFeatureHandles,
  computeSimilarityBetween,
} from "./similarity.js";
export type {
  AppSimilarityData,
  SimilarityResult,
} from "./similarity.js";

// Keyword opportunity
export {
  OPPORTUNITY_WEIGHTS,
  computeKeywordOpportunity,
} from "./keyword-opportunity.js";
export type {
  TopAppInfo,
  KeywordOpportunityStats,
  KeywordOpportunityScores,
  KeywordOpportunityMetrics,
} from "./keyword-opportunity.js";

// App Visibility
export {
  PAGE_SIZE,
  PAGE_DECAY,
  computeRankWeight,
  computeAppVisibility,
  normalizeScore,
} from "./app-visibility.js";
export type {
  KeywordRankingInput,
  VisibilityResult,
} from "./app-visibility.js";

// App Power
export {
  POWER_WEIGHTS,
  computeCategoryRankScore,
  computeAppPower,
  computeWeightedPowerScore,
} from "./app-power.js";
export type {
  CategoryRankInput,
  PowerInput,
  PowerComponents,
} from "./app-power.js";

// Scraper Schedules
export {
  SCRAPER_SCHEDULES,
  getNextRunFromCron,
  getScheduleIntervalMs,
  findSchedule,
} from "./constants/scraper-schedules.js";
export type { ScraperSchedule } from "./constants/scraper-schedules.js";

// Smoke Test
export {
  SMOKE_CHECKS,
  SMOKE_PLATFORMS,
  BROWSER_PLATFORMS,
  getSmokeCheck,
  getSmokePlatform,
  countTotalSmokeChecks,
} from "./constants/smoke-test.js";
export type {
  SmokeCheckName,
  SmokeCheck,
  SmokePlatform,
} from "./constants/smoke-test.js";

// Parse Utilities
export { safeParseFloat, clampRating, clampCount, clampPosition } from "./parse-utils.js";

// Developer Name
export {
  stripCorporateSuffix,
  developerNameToSlug,
  normalizeDeveloperName,
} from "./developer-name.js";

// Logger
export { Logger, createLogger } from "./logger.js";
export type { LogLevel, LogContext } from "./logger.js";

// Environment validation
export { validateEnv, API_REQUIRED_ENV, SCRAPER_REQUIRED_ENV } from "./env.js";
export type { EnvValidationError } from "./env.js";

// Notifications
export { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, NOTIFICATION_TYPE_IDS } from "./notification-types.js";
export type { NotificationType, NotificationCategory } from "./notification-types.js";
export { buildNotificationContent } from "./notifications/templates.js";
export type { NotificationContent, NotificationEventData } from "./notifications/templates.js";
export { emitNotification } from "./notifications/engine.js";
export type { NotificationStore, NotificationRecipient, NotificationRecord, EmitResult } from "./notifications/engine.js";
