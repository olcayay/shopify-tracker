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

// Email job types
export type {
  InstantEmailJobType,
  InstantEmailJobData,
  BulkEmailJobType,
  BulkEmailJobData,
} from "./types/email-job.js";

// Notification job types
export type {
  NotificationJobType,
  NotificationJobData,
} from "./types/notification-job.js";

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
  WooCommercePlatformData,
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
  platformFeatureFlagSlug,
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

// Pricing normalization
export { PRICING_MODELS, normalizePricingModel } from "./normalize-pricing.js";
export type { PricingModel } from "./normalize-pricing.js";

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

// AI Service
export {
  AI_MODEL_PRICING,
  computeCost,
  callAI,
  logAICall,
  isRateLimitOrQuota,
} from "./ai-service.js";
export type {
  ModelPricing,
  AIClient,
  AICompletionResponse,
  CallAIOptions,
  CallAIResult,
  LogAICallParams,
} from "./ai-service.js";

// Template Registry
export {
  NOTIFICATION_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATE_VARIABLES,
  renderTemplate,
  buildNotificationSampleData,
  buildEmailSampleData,
} from "./template-registry.js";
export type {
  TemplateVariable,
  EmailType,
} from "./template-registry.js";

// AI Competitor Suggestions
export {
  COMPETITOR_DIMENSION_WEIGHTS,
  HYBRID_WEIGHTS,
  COMPETITOR_RESPONSE_SCHEMA,
  preFilterCandidates,
  buildCompetitorSuggestionInput,
  generateCompetitorSuggestions,
  mergeCompetitorScores,
} from "./ai-competitor-suggestions.js";
export type {
  CompetitorType,
  AICompetitorScore,
  AICompetitorResponse,
  CompetitorCandidate,
  CompetitorSuggestionInput,
  MergedCompetitor,
  JaccardScore,
  GenerateCompetitorSuggestionsOptions,
  GenerateCompetitorSuggestionsResult,
} from "./ai-competitor-suggestions.js";

// AI Keyword Suggestions
export {
  ASO_WEIGHTS,
  KEYWORD_TIERS,
  KEYWORD_RESPONSE_SCHEMA,
  buildKeywordSuggestionInput,
  generateKeywordSuggestions,
  mergeKeywords,
} from "./ai-keyword-suggestions.js";
export type {
  KeywordTier,
  SearchIntent,
  Competitiveness,
  AIKeywordSuggestion,
  AIKeywordResponse,
  KeywordSuggestionInput,
  MergedKeyword,
  NgramKeyword,
  GenerateKeywordSuggestionsOptions,
  GenerateKeywordSuggestionsResult,
} from "./ai-keyword-suggestions.js";

// Notifications
export { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, NOTIFICATION_TYPE_IDS } from "./notification-types.js";
export type { NotificationType, NotificationCategory } from "./notification-types.js";
export { buildNotificationContent } from "./notifications/templates.js";
export type { NotificationContent, NotificationEventData, DbNotificationTemplate } from "./notifications/templates.js";
export { emitNotification } from "./notifications/engine.js";
export type { NotificationStore, NotificationRecipient, NotificationRecord, EmitResult } from "./notifications/engine.js";

// AI Rate Limiting
export { checkAiRateLimit, checkMonthlyBudget, DEFAULT_AI_RATE_LIMITS } from "./ai-rate-limiter.js";
export type { AiRateLimitConfig, RateLimitCheck } from "./ai-rate-limiter.js";

// Metadata Limits
export { getMetadataLimits } from "./metadata-limits.js";
export type { MetadataLimits } from "./metadata-limits.js";

// Audit Engine
export {
  computeAudit,
  computeSectionScore,
  computeOverallScore,
  collectRecommendations,
  DEFAULT_SECTION_WEIGHTS,
} from "./audit/index.js";
export type {
  AuditReport,
  AuditSection,
  AuditCheck,
  AuditRecommendation,
  AuditAppMeta,
  AuditStatus,
  AuditImpact,
  SectionWeights,
} from "./audit/index.js";
