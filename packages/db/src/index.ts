import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as scrapeRunsSchema from "./schema/scrape-runs.js";
import * as categoriesSchema from "./schema/categories.js";
import * as appsSchema from "./schema/apps.js";
import * as reviewsSchema from "./schema/reviews.js";
import * as keywordsSchema from "./schema/keywords.js";
import * as authSchema from "./schema/auth.js";
import * as accountTrackingSchema from "./schema/account-tracking.js";
import * as similarAppsSchema from "./schema/similar-apps.js";
import * as featuredAppsSchema from "./schema/featured-apps.js";
import * as keywordTagsSchema from "./schema/keyword-tags.js";
import * as categoryAdSightingsSchema from "./schema/category-ad-sightings.js";
import * as appReviewMetricsSchema from "./schema/app-review-metrics.js";
import * as appSimilarityScoresSchema from "./schema/app-similarity-scores.js";
import * as impersonationAuditLogsSchema from "./schema/impersonation-audit-logs.js";
import * as appScoresSchema from "./schema/app-scores.js";
import * as researchProjectsSchema from "./schema/research-projects.js";
import * as accountPlatformsSchema from "./schema/account-platforms.js";
import * as platformVisibilitySchema from "./schema/platform-visibility.js";
import * as researchVirtualAppsSchema from "./schema/research-virtual-apps.js";
import * as aiLogsSchema from "./schema/ai-logs.js";
import * as categoryParentsSchema from "./schema/category-parents.js";
import * as smokeTestResultsSchema from "./schema/smoke-test-results.js";
import * as scrapeItemErrorsSchema from "./schema/scrape-item-errors.js";

export const schema = {
  ...scrapeRunsSchema,
  ...categoriesSchema,
  ...appsSchema,
  ...reviewsSchema,
  ...keywordsSchema,
  ...authSchema,
  ...accountTrackingSchema,
  ...similarAppsSchema,
  ...featuredAppsSchema,
  ...keywordTagsSchema,
  ...categoryAdSightingsSchema,
  ...appReviewMetricsSchema,
  ...appSimilarityScoresSchema,
  ...impersonationAuditLogsSchema,
  ...appScoresSchema,
  ...researchProjectsSchema,
  ...accountPlatformsSchema,
  ...platformVisibilitySchema,
  ...researchVirtualAppsSchema,
  ...aiLogsSchema,
  ...categoryParentsSchema,
  ...smokeTestResultsSchema,
  ...scrapeItemErrorsSchema,
};

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 20,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
    connection: { timezone: "UTC" },
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

// Re-export schema tables for convenience
export {
  scrapeRuns,
  scraperTypeEnum,
  scrapeRunStatusEnum,
} from "./schema/scrape-runs.js";
export { categories, categorySnapshots } from "./schema/categories.js";
export {
  apps,
  appSnapshots,
  appFieldChanges,
  appCategoryRankings,
} from "./schema/apps.js";
export { reviews } from "./schema/reviews.js";
export {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
  keywordAdSightings,
  keywordAutoSuggestions,
  keywordToSlug,
} from "./schema/keywords.js";
export {
  packages,
  accounts,
  accountRoleEnum,
  users,
  invitations,
  refreshTokens,
} from "./schema/auth.js";
export {
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountStarredCategories,
  accountTrackedFeatures,
} from "./schema/account-tracking.js";
export { similarAppSightings } from "./schema/similar-apps.js";
export { featuredAppSightings } from "./schema/featured-apps.js";
export {
  keywordTags,
  keywordTagAssignments,
} from "./schema/keyword-tags.js";
export { categoryAdSightings } from "./schema/category-ad-sightings.js";
export { appReviewMetrics } from "./schema/app-review-metrics.js";
export { appSimilarityScores } from "./schema/app-similarity-scores.js";
export { impersonationAuditLogs } from "./schema/impersonation-audit-logs.js";
export { appVisibilityScores, appPowerScores } from "./schema/app-scores.js";
export {
  researchProjects,
  researchProjectKeywords,
  researchProjectCompetitors,
} from "./schema/research-projects.js";
export { accountPlatforms } from "./schema/account-platforms.js";
export { platformVisibility } from "./schema/platform-visibility.js";
export { researchVirtualApps } from "./schema/research-virtual-apps.js";
export { aiLogs } from "./schema/ai-logs.js";
export { categoryParents } from "./schema/category-parents.js";
export { smokeTestResults } from "./schema/smoke-test-results.js";
export { scrapeItemErrors } from "./schema/scrape-item-errors.js";
