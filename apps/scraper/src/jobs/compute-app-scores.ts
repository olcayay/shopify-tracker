import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, appVisibilityScores, appPowerScores } from "@shopify-tracking/db";
import {
  createLogger,
  computeAppVisibility,
  computeAppPower,
  normalizeScore,
} from "@shopify-tracking/shared";
import { enqueueScraperJob } from "../queue.js";

const log = createLogger("compute-app-scores");

const PREREQUISITE_TYPES = ["app_details", "keyword_search", "reviews", "category"] as const;
const CUTOFF_HOUR_UTC = 18;
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

interface AppKeywordRow {
  app_slug: string;
  keyword_id: number;
  position: number;
}

interface KeywordTotalRow {
  keyword_id: number;
  total_results: number;
}

interface AppCategoryRow {
  app_slug: string;
  category_slug: string;
  position: number;
}

interface CategorySizeRow {
  category_slug: string;
  app_count: number;
}

interface AppInfoRow {
  slug: string;
  average_rating: string | null;
  rating_count: number | null;
}

interface AppMomentumRow {
  app_slug: string;
  acc_macro: string | null;
}

/**
 * Check if all prerequisite jobs have completed today.
 * Returns list of missing job types, or empty array if all present.
 */
async function checkPrerequisites(db: Database): Promise<string[]> {
  const rows: { scraper_type: string }[] = await db
    .execute(
      sql`
      SELECT DISTINCT scraper_type
      FROM scrape_runs
      WHERE status = 'completed'
        AND started_at >= CURRENT_DATE
        AND scraper_type IN ('app_details', 'keyword_search', 'reviews', 'category')
    `
    )
    .then((res: any) => (res as any).rows ?? res);

  const completed = new Set(rows.map((r) => r.scraper_type));
  return PREREQUISITE_TYPES.filter((t) => !completed.has(t));
}

export async function computeAppScores(
  db: Database,
  triggeredBy: string,
  queue?: string,
): Promise<void> {
  const startTime = Date.now();

  // --- Prerequisite check ---
  const missing = await checkPrerequisites(db);
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
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
      queue,
    })
    .returning();

  try {
    // === STEP 1: Fetch all source data ===

    // 1a. Latest keyword rankings per (app, keyword) where position IS NOT NULL
    const appKeywordRows: AppKeywordRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (app_slug, keyword_id)
          app_slug, keyword_id, position
        FROM app_keyword_rankings
        WHERE position IS NOT NULL
        ORDER BY app_slug, keyword_id, scraped_at DESC
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
        SELECT DISTINCT ON (app_slug, category_slug)
          app_slug, category_slug, position
        FROM app_category_rankings
        ORDER BY app_slug, category_slug, scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    // 1d. Category sizes from latest categorySnapshots
    const categorySizeRows: CategorySizeRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (category_slug)
          category_slug, app_count
        FROM category_snapshots
        WHERE app_count IS NOT NULL
        ORDER BY category_slug, scraped_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const categorySizes = new Map<string, number>();
    for (const r of categorySizeRows) {
      categorySizes.set(r.category_slug, r.app_count);
    }

    // 1e. App rating + review count
    const appInfoRows: AppInfoRow[] = await db
      .execute(
        sql`
        SELECT slug, average_rating, rating_count
        FROM apps
        WHERE is_tracked = true
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const appInfoMap = new Map<string, AppInfoRow>();
    for (const r of appInfoRows) {
      appInfoMap.set(r.slug, r);
    }

    // 1f. Latest momentum (accMacro) from appReviewMetrics
    const momentumRows: AppMomentumRow[] = await db
      .execute(
        sql`
        SELECT DISTINCT ON (app_slug)
          app_slug, acc_macro
        FROM app_review_metrics
        ORDER BY app_slug, computed_at DESC
      `
      )
      .then((res: any) => (res as any).rows ?? res);

    const momentumMap = new Map<string, number | null>();
    for (const r of momentumRows) {
      momentumMap.set(r.app_slug, r.acc_macro != null ? Number(r.acc_macro) : null);
    }

    // === STEP 2: Build per-app structures ===

    // Build keyword rankings per app: Map<appSlug, KeywordRankingInput[]>
    const appKeywordRankings = new Map<string, { totalResults: number; position: number }[]>();
    for (const r of appKeywordRows) {
      const totalResults = keywordTotals.get(r.keyword_id);
      if (totalResults == null || totalResults <= 0) continue;
      if (!appKeywordRankings.has(r.app_slug)) appKeywordRankings.set(r.app_slug, []);
      appKeywordRankings.get(r.app_slug)!.push({
        totalResults,
        position: r.position,
      });
    }

    // Build category rankings per app: Map<appSlug, { categorySlug, position }[]>
    const appCatRankings = new Map<string, { categorySlug: string; position: number }[]>();
    for (const r of appCategoryRows) {
      if (!appCatRankings.has(r.app_slug)) appCatRankings.set(r.app_slug, []);
      appCatRankings.get(r.app_slug)!.push({
        categorySlug: r.category_slug,
        position: r.position,
      });
    }

    // Collect all unique app slugs that have either keyword or category data
    const allAppSlugs = new Set<string>();
    for (const slug of appKeywordRankings.keys()) allAppSlugs.add(slug);
    for (const slug of appCatRankings.keys()) allAppSlugs.add(slug);

    // Build category -> apps mapping for normalization
    const categoryApps = new Map<string, Set<string>>();
    for (const r of appCategoryRows) {
      if (!categoryApps.has(r.category_slug)) categoryApps.set(r.category_slug, new Set());
      categoryApps.get(r.category_slug)!.add(r.app_slug);
    }

    // === STEP 3: Compute raw visibility per app ===

    const appVisibilityRaw = new Map<string, { keywordCount: number; visibilityRaw: number }>();
    for (const slug of allAppSlugs) {
      const rankings = appKeywordRankings.get(slug) || [];
      const result = computeAppVisibility(rankings);
      appVisibilityRaw.set(slug, result);
    }

    // === STEP 4: Compute raw power components per (app, category) ===

    // For power score normalization, we need max reviews and max accMacro per category
    const categoryMaxReviews = new Map<string, number>();
    const categoryMaxAccMacro = new Map<string, number>();

    for (const [catSlug, appSlugs] of categoryApps) {
      let maxReviews = 0;
      let maxAccMacro = 0;
      for (const slug of appSlugs) {
        const info = appInfoMap.get(slug);
        if (info?.rating_count != null) {
          maxReviews = Math.max(maxReviews, info.rating_count);
        }
        const accMacro = momentumMap.get(slug);
        if (accMacro != null && accMacro > 0) {
          maxAccMacro = Math.max(maxAccMacro, accMacro);
        }
      }
      categoryMaxReviews.set(catSlug, maxReviews);
      categoryMaxAccMacro.set(catSlug, maxAccMacro);
    }

    // === STEP 5: Normalize and upsert per (app, category) ===

    const today = new Date().toISOString().slice(0, 10);
    let appsComputed = 0;
    let categoriesProcessed = 0;
    const processedCategories = new Set<string>();

    // Compute max visibility raw per category for normalization
    const categoryMaxVisibility = new Map<string, number>();
    for (const [catSlug, appSlugs] of categoryApps) {
      let maxVis = 0;
      for (const slug of appSlugs) {
        const vis = appVisibilityRaw.get(slug);
        if (vis) maxVis = Math.max(maxVis, vis.visibilityRaw);
      }
      categoryMaxVisibility.set(catSlug, maxVis);
    }

    // Compute max power raw per category for normalization
    // First pass: compute all raw power scores, then find max per category
    const appPowerRawByCategory = new Map<string, Map<string, ReturnType<typeof computeAppPower>>>();
    for (const [catSlug, appSlugs] of categoryApps) {
      const catPowerMap = new Map<string, ReturnType<typeof computeAppPower>>();
      const maxReviews = categoryMaxReviews.get(catSlug) || 0;
      const maxAccMacro = categoryMaxAccMacro.get(catSlug) || 0;

      for (const slug of appSlugs) {
        const info = appInfoMap.get(slug);
        const catRankings = appCatRankings.get(slug) || [];

        // Filter to this category's ranking for category score
        const thisCatRanking = catRankings.find((r) => r.categorySlug === catSlug);
        const categoryRankingsInput = thisCatRanking
          ? [{ position: thisCatRanking.position, totalApps: categorySizes.get(catSlug) || 0 }]
          : [];

        const power = computeAppPower(
          {
            averageRating: info?.average_rating != null ? Number(info.average_rating) : null,
            ratingCount: info?.rating_count ?? null,
            categoryRankings: categoryRankingsInput,
            accMacro: momentumMap.get(slug) ?? null,
          },
          maxReviews,
          maxAccMacro,
        );

        catPowerMap.set(slug, power);
      }
      appPowerRawByCategory.set(catSlug, catPowerMap);
    }

    // Find max power raw per category
    const categoryMaxPower = new Map<string, number>();
    for (const [catSlug, catPowerMap] of appPowerRawByCategory) {
      let maxPow = 0;
      for (const power of catPowerMap.values()) {
        maxPow = Math.max(maxPow, power.powerRaw);
      }
      categoryMaxPower.set(catSlug, maxPow);
    }

    // Upsert all scores
    for (const [catSlug, appSlugs] of categoryApps) {
      const maxVis = categoryMaxVisibility.get(catSlug) || 0;
      const maxPow = categoryMaxPower.get(catSlug) || 0;
      const catPowerMap = appPowerRawByCategory.get(catSlug)!;

      for (const slug of appSlugs) {
        const vis = appVisibilityRaw.get(slug) || { keywordCount: 0, visibilityRaw: 0 };
        const visScore = normalizeScore(vis.visibilityRaw, maxVis);

        // Upsert visibility score
        await db
          .insert(appVisibilityScores)
          .values({
            appSlug: slug,
            categorySlug: catSlug,
            computedAt: today,
            scrapeRunId: run.id,
            keywordCount: vis.keywordCount,
            visibilityRaw: vis.visibilityRaw.toFixed(4),
            visibilityScore: visScore,
          })
          .onConflictDoUpdate({
            target: [
              appVisibilityScores.appSlug,
              appVisibilityScores.categorySlug,
              appVisibilityScores.computedAt,
            ],
            set: {
              scrapeRunId: run.id,
              keywordCount: vis.keywordCount,
              visibilityRaw: vis.visibilityRaw.toFixed(4),
              visibilityScore: visScore,
            },
          });

        // Upsert power score
        const power = catPowerMap.get(slug);
        if (power) {
          const powScore = normalizeScore(power.powerRaw, maxPow);
          await db
            .insert(appPowerScores)
            .values({
              appSlug: slug,
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
                appPowerScores.appSlug,
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
        }

        appsComputed++;
      }

      if (!processedCategories.has(catSlug)) {
        processedCategories.add(catSlug);
        categoriesProcessed++;
      }
    }

    const durationMs = Date.now() - startTime;
    log.info("app scores computed", { appsComputed, categoriesProcessed, durationMs });

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          apps_computed: appsComputed,
          categories_processed: categoriesProcessed,
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
