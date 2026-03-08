import { eq, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, appVisibilityScores, appPowerScores } from "@appranks/db";
import {
  createLogger,
  computeAppVisibility,
  computeAppPower,
  normalizeScore,
  PLATFORMS,
  type PlatformId,
} from "@appranks/shared";
import { enqueueScraperJob } from "../queue.js";

const log = createLogger("compute-app-scores");

const BASE_PREREQUISITE_TYPES = ["app_details", "category"] as const;
const CUTOFF_HOUR_UTC = 18;
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Build the list of prerequisite scraper types based on platform capabilities.
 */
function getPrerequisiteTypes(platform: PlatformId): string[] {
  const platformConfig = PLATFORMS[platform];
  const types: string[] = [...BASE_PREREQUISITE_TYPES];
  if (platformConfig.hasKeywordSearch) types.push("keyword_search");
  if (platformConfig.hasReviews) types.push("reviews");
  return types;
}

interface AppKeywordRow {
  app_id: number;
  keyword_id: number;
  position: number;
}

interface KeywordTotalRow {
  keyword_id: number;
  total_results: number;
}

interface AppCategoryRow {
  app_id: number;
  category_slug: string;
  position: number;
}

interface CategorySizeRow {
  category_slug: string;
  app_count: number;
}

interface AppInfoRow {
  id: number;
  average_rating: string | null;
  rating_count: number | null;
}

interface AppMomentumRow {
  app_id: number;
  acc_macro: string | null;
}

interface TrackedContextRow {
  account_id: string;
  tracked_app_id: number;
}

/**
 * Check if all prerequisite jobs have completed today.
 * Returns list of missing job types, or empty array if all present.
 */
async function checkPrerequisites(db: Database, prerequisiteTypes: string[]): Promise<string[]> {
  const typeList = sql.join(prerequisiteTypes.map((t) => sql`${t}`), sql`, `);
  const rows: { scraper_type: string }[] = await db
    .execute(
      sql`
      SELECT DISTINCT scraper_type
      FROM scrape_runs
      WHERE status = 'completed'
        AND started_at >= CURRENT_DATE
        AND scraper_type IN (${typeList})
    `
    )
    .then((res: any) => (res as any).rows ?? res);

  const completed = new Set(rows.map((r) => r.scraper_type));
  return prerequisiteTypes.filter((t) => !completed.has(t));
}

export async function computeAppScores(
  db: Database,
  triggeredBy: string,
  queue?: string,
  platform: PlatformId = "shopify",
): Promise<void> {
  const startTime = Date.now();

  // --- Prerequisite check ---
  const prerequisiteTypes = getPrerequisiteTypes(platform);
  const missing = await checkPrerequisites(db, prerequisiteTypes);
  if (missing.length > 0) {
    const nowUtc = new Date().getUTCHours();
    if (nowUtc < CUTOFF_HOUR_UTC) {
      log.info("prerequisites not met, re-enqueuing with delay", { missing, retryInMs: RETRY_DELAY_MS });
      await enqueueScraperJob(
        { type: "compute_app_scores", triggeredBy: `${triggeredBy}:retry` },
        { delay: RETRY_DELAY_MS, queue: (queue as "background" | "interactive") ?? "background" },
      );
      return;
    }
    // Past cutoff - fail
    const [run] = await db
      .insert(scrapeRuns)
      .values({
        scraperType: "compute_app_scores",
        platform,
        status: "failed",
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        triggeredBy,
        queue,
        error: `Prerequisites not met: ${missing.join(", ")}`,
      })
      .returning();
    log.error("prerequisites not met past cutoff, failing", { missing, runId: run.id });
    return;
  }

  // --- Create scrape run ---
  const [run] = await db
    .insert(scrapeRuns)
    .values({
      scraperType: "compute_app_scores",
      platform,
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
      queue,
    })
    .returning();

  try {
    // === SHARED DATA: Fetch all source data ===

    // 1a. Latest keyword rankings per (app, keyword) where position IS NOT NULL
    const appKeywordRows: AppKeywordRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (app_id, keyword_id)
          app_id, keyword_id, position
        FROM app_keyword_rankings
        WHERE position IS NOT NULL
        ORDER BY app_id, keyword_id, scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    // 1b. Latest totalResults per keyword
    const keywordTotalRows: KeywordTotalRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (keyword_id)
          keyword_id, total_results
        FROM keyword_snapshots
        WHERE total_results IS NOT NULL
        ORDER BY keyword_id, scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const keywordTotals = new Map<number, number>();
    for (const r of keywordTotalRows) {
      keywordTotals.set(r.keyword_id, r.total_results);
    }

    // 1c. Latest category rank per (app, category)
    const appCategoryRows: AppCategoryRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (app_id, category_slug)
          app_id, category_slug, position
        FROM app_category_rankings
        ORDER BY app_id, category_slug, scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    // 1d. Category sizes from latest categorySnapshots
    const categorySizeRows: CategorySizeRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (c.slug)
          c.slug AS category_slug, cs.app_count
        FROM category_snapshots cs
        JOIN categories c ON c.id = cs.category_id
        WHERE cs.app_count IS NOT NULL
        ORDER BY c.slug, cs.scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const categorySizes = new Map<string, number>();
    for (const r of categorySizeRows) {
      categorySizes.set(r.category_slug, r.app_count);
    }

    // 1e. App rating + review count (filtered by platform)
    const appInfoRows: AppInfoRow[] = await db
      .execute(
        sql`
        SELECT id, average_rating, rating_count
        FROM apps
        WHERE platform = ${platform}
          AND (average_rating IS NOT NULL OR rating_count IS NOT NULL)
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const appInfoMap = new Map<number, AppInfoRow>();
    for (const r of appInfoRows) {
      appInfoMap.set(r.id, r);
    }

    // 1f. Latest momentum (accMacro) from appReviewMetrics
    const momentumRows: AppMomentumRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (app_id)
          app_id, acc_macro
        FROM app_review_metrics
        ORDER BY app_id, computed_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const momentumMap = new Map<number, number | null>();
    for (const r of momentumRows) {
      momentumMap.set(r.app_id, r.acc_macro != null ? Number(r.acc_macro) : null);
    }

    // Build global keyword rankings per app: Map<appId, { keywordId, totalResults, position }[]>
    const globalAppKeywordRankings = new Map<number, { keywordId: number; totalResults: number; position: number }[]>();
    for (const r of appKeywordRows) {
      const totalResults = keywordTotals.get(r.keyword_id);
      if (totalResults == null || totalResults <= 0) continue;
      if (!globalAppKeywordRankings.has(r.app_id)) globalAppKeywordRankings.set(r.app_id, []);
      globalAppKeywordRankings.get(r.app_id)!.push({
        keywordId: r.keyword_id,
        totalResults,
        position: r.position,
      });
    }

    // Build category rankings per app: Map<appId, { categorySlug, position }[]>
    const appCatRankings = new Map<number, { categorySlug: string; position: number }[]>();
    for (const r of appCategoryRows) {
      if (!appCatRankings.has(r.app_id)) appCatRankings.set(r.app_id, []);
      appCatRankings.get(r.app_id)!.push({
        categorySlug: r.category_slug,
        position: r.position,
      });
    }

    // Build category -> apps mapping
    const categoryApps = new Map<string, Set<number>>();
    for (const r of appCategoryRows) {
      if (!categoryApps.has(r.category_slug)) categoryApps.set(r.category_slug, new Set());
      categoryApps.get(r.category_slug)!.add(r.app_id);
    }

    const today = new Date().toISOString().slice(0, 10);
    let visibilityUpserts = 0;
    let powerUpserts = 0;

    // ============================================================
    // PHASE A: Visibility (account-scoped, per tracked-app context)
    // ============================================================

    // Get all distinct (accountId, trackedAppId) contexts
    const trackedContexts: TrackedContextRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT account_id, tracked_app_id
        FROM account_tracked_keywords
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    log.info("phase A: computing visibility", { contexts: trackedContexts.length });

    for (const ctx of trackedContexts) {
      // Get keyword IDs for this context
      const kwRows: { keyword_id: number }[] = await db
        .execute(
          sql`
          SELECT DISTINCT keyword_id
          FROM account_tracked_keywords
          WHERE account_id = ${ctx.account_id}
            AND tracked_app_id = ${ctx.tracked_app_id}
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      const contextKeywordIds = new Set(kwRows.map((r) => r.keyword_id));
      if (contextKeywordIds.size === 0) continue;

      // Get competitor app IDs for this context + the tracked app itself
      const compRows: { competitor_app_id: number }[] = await db
        .execute(
          sql`
          SELECT DISTINCT competitor_app_id
          FROM account_competitor_apps
          WHERE account_id = ${ctx.account_id}
            AND tracked_app_id = ${ctx.tracked_app_id}
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      const appIdsInContext = new Set<number>([
        ctx.tracked_app_id,
        ...compRows.map((r) => r.competitor_app_id),
      ]);

      // Compute visibility for each app in this context using only context keywords
      const contextVisRaw = new Map<number, { keywordCount: number; visibilityRaw: number }>();
      let maxRaw = 0;

      for (const appId of appIdsInContext) {
        const allRankings = globalAppKeywordRankings.get(appId) || [];
        // Filter to only keywords in this context
        const filteredRankings = allRankings
          .filter((r) => contextKeywordIds.has(r.keywordId))
          .map((r) => ({ totalResults: r.totalResults, position: r.position }));

        const result = computeAppVisibility(filteredRankings);
        contextVisRaw.set(appId, result);
        if (result.visibilityRaw > maxRaw) maxRaw = result.visibilityRaw;
      }

      // Normalize and upsert
      for (const [appId, vis] of contextVisRaw) {
        const visScore = normalizeScore(vis.visibilityRaw, maxRaw);
        await db
          .insert(appVisibilityScores)
          .values({
            accountId: ctx.account_id,
            trackedAppId: ctx.tracked_app_id,
            appId,
            computedAt: today,
            scrapeRunId: run.id,
            keywordCount: vis.keywordCount,
            visibilityRaw: vis.visibilityRaw.toFixed(4),
            visibilityScore: visScore,
          })
          .onConflictDoUpdate({
            target: [
              appVisibilityScores.accountId,
              appVisibilityScores.trackedAppId,
              appVisibilityScores.appId,
              appVisibilityScores.computedAt,
            ],
            set: {
              scrapeRunId: run.id,
              keywordCount: vis.keywordCount,
              visibilityRaw: vis.visibilityRaw.toFixed(4),
              visibilityScore: visScore,
            },
          });
        visibilityUpserts++;
      }
    }

    // ============================================================
    // PHASE B: Power (leaf categories only)
    // ============================================================

    // Get leaf category slugs (filtered by platform)
    const leafCatRows: { slug: string }[] = await db
      .execute(
        sql`
        SELECT slug FROM categories WHERE is_listing_page = true AND platform = ${platform}
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const leafCategorySlugs = new Set(leafCatRows.map((r) => r.slug));

    log.info("phase B: computing power", { leafCategories: leafCategorySlugs.size });

    // Filter categoryApps to only leaf categories
    const leafCategoryApps = new Map<string, Set<number>>();
    for (const [catSlug, appIds] of categoryApps) {
      if (leafCategorySlugs.has(catSlug)) {
        leafCategoryApps.set(catSlug, appIds);
      }
    }

    // For power score normalization, we need max reviews and max accMacro per category
    const categoryMaxReviews = new Map<string, number>();
    const categoryMaxAccMacro = new Map<string, number>();

    for (const [catSlug, appIds] of leafCategoryApps) {
      let maxReviews = 0;
      let maxAccMacro = 0;
      for (const appId of appIds) {
        const info = appInfoMap.get(appId);
        if (info?.rating_count != null) {
          maxReviews = Math.max(maxReviews, info.rating_count);
        }
        const accMacro = momentumMap.get(appId);
        if (accMacro != null && accMacro > 0) {
          maxAccMacro = Math.max(maxAccMacro, accMacro);
        }
      }
      categoryMaxReviews.set(catSlug, maxReviews);
      categoryMaxAccMacro.set(catSlug, maxAccMacro);
    }

    // Compute raw power scores per (app, leafCategory)
    const appPowerRawByCategory = new Map<string, Map<number, ReturnType<typeof computeAppPower>>>();
    for (const [catSlug, appIds] of leafCategoryApps) {
      const catPowerMap = new Map<number, ReturnType<typeof computeAppPower>>();
      const maxReviews = categoryMaxReviews.get(catSlug) || 0;
      const maxAccMacro = categoryMaxAccMacro.get(catSlug) || 0;

      for (const appId of appIds) {
        const info = appInfoMap.get(appId);
        const catRankings = appCatRankings.get(appId) || [];

        const thisCatRanking = catRankings.find((r) => r.categorySlug === catSlug);
        const categoryRankingsInput = thisCatRanking
          ? [{ position: thisCatRanking.position, totalApps: categorySizes.get(catSlug) || 0 }]
          : [];

        const power = computeAppPower(
          {
            averageRating: info?.average_rating != null ? Number(info.average_rating) : null,
            ratingCount: info?.rating_count ?? null,
            categoryRankings: categoryRankingsInput,
            accMacro: momentumMap.get(appId) ?? null,
          },
          maxReviews,
          maxAccMacro,
        );

        catPowerMap.set(appId, power);
      }
      appPowerRawByCategory.set(catSlug, catPowerMap);
    }

    // Find max power raw per category for normalization
    const categoryMaxPower = new Map<string, number>();
    for (const [catSlug, catPowerMap] of appPowerRawByCategory) {
      let maxPow = 0;
      for (const power of catPowerMap.values()) {
        maxPow = Math.max(maxPow, power.powerRaw);
      }
      categoryMaxPower.set(catSlug, maxPow);
    }

    // Upsert power scores
    for (const [catSlug, catPowerMap] of appPowerRawByCategory) {
      const maxPow = categoryMaxPower.get(catSlug) || 0;

      for (const [appId, power] of catPowerMap) {
        const powScore = normalizeScore(power.powerRaw, maxPow);
        await db
          .insert(appPowerScores)
          .values({
            appId,
            categorySlug: catSlug,
            computedAt: today,
            scrapeRunId: run.id,
            ratingScore: power.ratingScore.toFixed(4),
            reviewScore: power.reviewScore.toFixed(4),
            categoryScore: power.categoryScore.toFixed(4),
            momentumScore: power.momentumScore.toFixed(4),
            powerRaw: power.powerRaw.toFixed(4),
            powerScore: powScore,
          })
          .onConflictDoUpdate({
            target: [
              appPowerScores.appId,
              appPowerScores.categorySlug,
              appPowerScores.computedAt,
            ],
            set: {
              scrapeRunId: run.id,
              ratingScore: power.ratingScore.toFixed(4),
              reviewScore: power.reviewScore.toFixed(4),
              categoryScore: power.categoryScore.toFixed(4),
              momentumScore: power.momentumScore.toFixed(4),
              powerRaw: power.powerRaw.toFixed(4),
              powerScore: powScore,
            },
          });
        powerUpserts++;
      }
    }

    const durationMs = Date.now() - startTime;
    log.info("app scores computed", {
      platform,
      visibilityUpserts,
      powerUpserts,
      trackedContexts: trackedContexts.length,
      leafCategories: leafCategorySlugs.size,
      durationMs,
    });

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          platform,
          visibility_upserts: visibilityUpserts,
          power_upserts: powerUpserts,
          tracked_contexts: trackedContexts.length,
          leaf_categories: leafCategorySlugs.size,
          duration_ms: durationMs,
        },
      })
      .where(eq(scrapeRuns.id, run.id));
  } catch (error) {
    log.error("failed to compute app scores", { error: String(error) });
    await db
      .update(scrapeRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: String(error),
      })
      .where(eq(scrapeRuns.id, run.id));
    throw error;
  }
}
