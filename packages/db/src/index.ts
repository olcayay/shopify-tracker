import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
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
import * as developersSchema from "./schema/developers.js";
import * as deadLetterJobsSchema from "./schema/dead-letter-jobs.js";
import * as notificationsSchema from "./schema/notifications.js";
import * as emailSchema from "./schema/email.js";
import * as templatesSchema from "./schema/templates.js";
import * as aiSuggestionsSchema from "./schema/ai-suggestions.js";
import * as activityLogSchema from "./schema/activity-log.js";
import * as featureFlagsSchema from "./schema/feature-flags.js";

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
  ...developersSchema,
  ...deadLetterJobsSchema,
  ...notificationsSchema,
  ...emailSchema,
  ...templatesSchema,
  ...aiSuggestionsSchema,
  ...activityLogSchema,
  ...featureFlagsSchema,
};

export interface DbPoolOptions {
  /** Max connections in pool (default: 10) */
  max?: number;
  /** Idle timeout in seconds (default: 30) */
  idleTimeout?: number;
  /** Max connection lifetime in seconds (default: 1800 = 30 min) */
  maxLifetime?: number;
  /** Statement timeout in ms (default: 30000) */
  statementTimeout?: number;
}

export function createDb(databaseUrl: string, opts?: DbPoolOptions) {
  const client = postgres(databaseUrl, {
    max: opts?.max ?? 10,
    idle_timeout: opts?.idleTimeout ?? 20,
    max_lifetime: opts?.maxLifetime ?? 60 * 15,
    connection: {
      timezone: "UTC",
      statement_timeout: opts?.statementTimeout ?? 30000,
    },
    // Connection retry with exponential backoff
    connect_timeout: 10,
    backoff(retries: number) {
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      return Math.min(1000 * Math.pow(2, retries), 30000);
    },
  });
  const db = drizzle(client, { schema });
  // Expose raw postgres client for pool diagnostics
  (db as any).__pgClient = client;
  return db;
}

/**
 * Create a dedicated single-connection DB client for health checks.
 * This bypasses the main pool so /health never hangs when the pool is stuck.
 */
export function createHealthCheckDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 60,
    connect_timeout: 5,
    connection: {
      timezone: "UTC",
      statement_timeout: 5000,
    },
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

/**
 * Build a PostgreSQL ARRAY literal safe for use inside raw SQL.
 * Use this instead of `ANY(${jsArray})` which fails because Drizzle's
 * sql`` template does not auto-cast JS arrays to PG arrays.
 *
 * @example
 *   sql`WHERE id = ANY(${sqlArray(ids)})`              // integer[]
 *   sql`WHERE name = ANY(${sqlArray(names)})`           // text[]
 *   sql`WHERE account_id = ANY(${sqlArray(ids, 'uuid')})` // uuid[]
 */
export function sqlArray(arr: (number | string)[], pgType?: "uuid" | "text" | "integer"): ReturnType<typeof sql> {
  if (arr.length === 0) {
    const cast = pgType || "integer";
    return sql.raw(`ARRAY[]::${cast}[]`);
  }
  if (typeof arr[0] === "number") {
    const cast = pgType ? `::${pgType}[]` : "";
    return sql.raw(`ARRAY[${arr.join(",")}]${cast}`);
  }
  // String values — single-quote each, escaping embedded quotes
  const escaped = (arr as string[]).map(
    (s) => `'${s.replace(/'/g, "''")}'`
  );
  const cast = pgType ? `::${pgType}[]` : "";
  return sql.raw(`ARRAY[${escaped.join(",")}]${cast}`);
}

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
  passwordResetTokens,
  emailVerificationTokens,
} from "./schema/auth.js";
export {
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountStarredCategories,
  accountStarredDevelopers,
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
export {
  globalDevelopers,
  platformDevelopers,
} from "./schema/developers.js";
export { ensurePlatformDeveloper } from "./ensure-platform-developer.js";
export { platformRequests } from "./schema/platform-requests.js";
export { deadLetterJobs } from "./schema/dead-letter-jobs.js";
export {
  notifications,
  pushSubscriptions,
  notificationTypeConfigs,
  userNotificationPreferences,
  notificationDeliveryLog,
} from "./schema/notifications.js";
export {
  emailTypeConfigs,
  emailTypeAccountOverrides,
  emailLogs,
  emailCampaigns,
  emailProspects,
  userEmailPreferences,
  emailUnsubscribeTokens,
  userAppEmailPreferences,
  emailSuppressionList,
  emailHealthMetrics,
  emailDailyStats,
  emailAlertRules,
  emailAlertsLog,
} from "./schema/email.js";
export {
  notificationTemplates,
  emailTemplates,
} from "./schema/templates.js";
export {
  aiKeywordSuggestions,
  aiCompetitorSuggestions,
} from "./schema/ai-suggestions.js";

export { accountActivityLog } from "./schema/activity-log.js";
export { featureFlags, accountFeatureFlags } from "./schema/feature-flags.js";
