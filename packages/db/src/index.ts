import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as scrapeRunsSchema from "./schema/scrape-runs.js";
import * as categoriesSchema from "./schema/categories.js";
import * as appsSchema from "./schema/apps.js";
import * as reviewsSchema from "./schema/reviews.js";
import * as keywordsSchema from "./schema/keywords.js";
import * as authSchema from "./schema/auth.js";
import * as accountTrackingSchema from "./schema/account-tracking.js";

export const schema = {
  ...scrapeRunsSchema,
  ...categoriesSchema,
  ...appsSchema,
  ...reviewsSchema,
  ...keywordsSchema,
  ...authSchema,
  ...accountTrackingSchema,
};

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
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
  appCategoryRankings,
} from "./schema/apps.js";
export { reviews } from "./schema/reviews.js";
export {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
  keywordAdSightings,
  keywordToSlug,
} from "./schema/keywords.js";
export {
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
