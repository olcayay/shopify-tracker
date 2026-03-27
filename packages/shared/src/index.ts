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

// Constants
export { SEED_CATEGORY_SLUGS, MAX_CATEGORY_DEPTH } from "./constants/seed-categories.js";
export { urls } from "./constants/urls.js";
export {
  PLATFORMS,
  PLATFORM_IDS,
  isPlatformId,
  getPlatform,
  buildExternalAppUrl,
  buildExternalCategoryUrl,
} from "./constants/platforms.js";
export type {
  PlatformId,
  PlatformConfig,
  PlatformCapabilities,
} from "./constants/platforms.js";

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

// Logger
export { Logger, createLogger } from "./logger.js";
export type { LogLevel, LogContext } from "./logger.js";
