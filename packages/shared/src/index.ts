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
} from "./types/app.js";

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

// Keyword extraction
export {
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
  STOP_WORDS,
  SIMILARITY_WEIGHTS,
  jaccard,
  tokenize,
  extractCategorySlugs,
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

// Logger
export { Logger, createLogger } from "./logger.js";
export type { LogLevel, LogContext } from "./logger.js";
