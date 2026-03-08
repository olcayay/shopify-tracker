import { eq, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, appSimilarityScores, accountCompetitorApps, apps } from "@appranks/db";
import {
  createLogger,
  SIMILARITY_WEIGHTS,
  jaccard,
  tokenize,
  extractCategorySlugs,
  extractFeatureHandles,
  type PlatformId,
} from "@appranks/shared";

const log = createLogger("compute-similarity-scores");

export async function computeSimilarityScores(db: Database, triggeredBy: string, queue?: string, platform: PlatformId = "shopify"): Promise<void> {
  const startTime = Date.now();

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      scraperType: "compute_similarity_scores",
      platform,
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
      queue,
    })
    .returning();

  try {
    // Collect all unique (trackedAppId, competitorAppId) pairs across all accounts
    // Filter by platform: only include pairs where the tracked app belongs to this platform
    const pairRows = await db
      .selectDistinct({
        trackedAppId: accountCompetitorApps.trackedAppId,
        competitorAppId: accountCompetitorApps.competitorAppId,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.id, accountCompetitorApps.trackedAppId))
      .where(eq(apps.platform, platform));

    if (pairRows.length === 0) {
      log.info("no competitor pairs found");
      await db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: { pairs_computed: 0, duration_ms: Date.now() - startTime },
        })
        .where(eq(scrapeRuns.id, run.id));
      return;
    }

    // Collect all unique app IDs
    const allAppIds = new Set<number>();
    for (const p of pairRows) {
      allAppIds.add(p.trackedAppId);
      allAppIds.add(p.competitorAppId);
    }
    const idArray = [...allAppIds];
    const idList = sql.join(idArray.map((id) => sql`${id}`), sql`, `);

    // Batch-fetch latest snapshots (categories + appIntroduction)
    const snapshotRows: any[] = await db
      .execute(
        sql`
      SELECT DISTINCT ON (app_id)
        app_id, categories, app_introduction
      FROM app_snapshots
      WHERE app_id IN (${idList})
      ORDER BY app_id, scraped_at DESC
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    // Batch-fetch app info (name + subtitle), filtered by platform
    const appInfoRows: any[] = await db
      .execute(
        sql`
      SELECT id, name, app_card_subtitle
      FROM apps
      WHERE id IN (${idList})
        AND platform = ${platform}
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    // Build lookup maps
    const snapshotMap = new Map<number, any>();
    for (const r of snapshotRows) snapshotMap.set(r.app_id, r);

    const appInfoMap = new Map<number, { name: string; subtitle: string | null }>();
    for (const r of appInfoRows) appInfoMap.set(r.id, { name: r.name, subtitle: r.app_card_subtitle });

    // Batch-fetch keyword rankings: latest per (appId, keywordId) where position IS NOT NULL
    const kwRows: any[] = await db
      .execute(
        sql`
      SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id
      FROM app_keyword_rankings
      WHERE app_id IN (${idList})
        AND position IS NOT NULL
      ORDER BY app_id, keyword_id, scraped_at DESC
    `
      )
      .then((res: any) => (res as any).rows ?? res);

    const keywordMap = new Map<number, Set<string>>();
    for (const r of kwRows) {
      if (!keywordMap.has(r.app_id)) keywordMap.set(r.app_id, new Set());
      keywordMap.get(r.app_id)!.add(String(r.keyword_id));
    }

    // Pre-compute per-app derived data
    const categorySlugMap = new Map<number, Set<string>>();
    const featureHandleMap = new Map<number, Set<string>>();
    const tokenMap = new Map<number, Set<string>>();

    for (const appId of idArray) {
      const snap = snapshotMap.get(appId);
      const info = appInfoMap.get(appId);
      const cats = snap?.categories ?? [];

      categorySlugMap.set(appId, extractCategorySlugs(cats));
      featureHandleMap.set(appId, extractFeatureHandles(cats));

      const textParts = [info?.name ?? "", info?.subtitle ?? "", snap?.app_introduction ?? ""].join(" ");
      tokenMap.set(appId, tokenize(textParts));
    }

    // Compute similarity for each pair
    const today = new Date().toISOString().slice(0, 10);
    let computed = 0;

    // Deduplicate: if (A,B) and (B,A) both exist as competitor pairs, only compute once
    const seen = new Set<string>();

    for (const pair of pairRows) {
      const idA = pair.trackedAppId;
      const idB = pair.competitorAppId;
      const [canonA, canonB] = idA < idB ? [idA, idB] : [idB, idA];
      const pairKey = `${canonA}:${canonB}`;

      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const catScore = jaccard(categorySlugMap.get(idA) ?? new Set(), categorySlugMap.get(idB) ?? new Set());
      const featScore = jaccard(featureHandleMap.get(idA) ?? new Set(), featureHandleMap.get(idB) ?? new Set());
      const kwScore = jaccard(keywordMap.get(idA) ?? new Set(), keywordMap.get(idB) ?? new Set());
      const txtScore = jaccard(tokenMap.get(idA) ?? new Set(), tokenMap.get(idB) ?? new Set());

      const overall = SIMILARITY_WEIGHTS.category * catScore + SIMILARITY_WEIGHTS.feature * featScore + SIMILARITY_WEIGHTS.keyword * kwScore + SIMILARITY_WEIGHTS.text * txtScore;

      await db
        .insert(appSimilarityScores)
        .values({
          appIdA: canonA,
          appIdB: canonB,
          overallScore: overall.toFixed(4),
          categoryScore: catScore.toFixed(4),
          featureScore: featScore.toFixed(4),
          keywordScore: kwScore.toFixed(4),
          textScore: txtScore.toFixed(4),
          computedAt: today,
        })
        .onConflictDoUpdate({
          target: [appSimilarityScores.appIdA, appSimilarityScores.appIdB],
          set: {
            overallScore: overall.toFixed(4),
            categoryScore: catScore.toFixed(4),
            featureScore: featScore.toFixed(4),
            keywordScore: kwScore.toFixed(4),
            textScore: txtScore.toFixed(4),
            computedAt: today,
          },
        });

      computed++;
    }

    const durationMs = Date.now() - startTime;
    log.info("similarity scores computed", { platform, computed, durationMs });

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: { platform, pairs_computed: computed, duration_ms: durationMs },
      })
      .where(eq(scrapeRuns.id, run.id));
  } catch (error) {
    log.error("failed to compute similarity scores", { error: String(error) });
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
