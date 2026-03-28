import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import { eq, sql, and, asc, desc, inArray } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  accounts,
  apps,
  appSnapshots,
  trackedKeywords,
  keywordSnapshots,
  keywordToSlug,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  appKeywordRankings,
  keywordAutoSuggestions,
  featuredAppSightings,
  keywordAdSightings,
  similarAppSightings,
  keywordTags,
  keywordTagAssignments,
  appCategoryRankings,
  appReviewMetrics,
  appVisibilityScores,
  appPowerScores,
  categories,
  categorySnapshots,
} from "@appranks/db";
import { computeWeightedPowerScore } from "@appranks/shared";
import { requireRole } from "../middleware/authorize.js";
import { requireIdempotencyKey } from "../middleware/idempotency.js";
import { getPlatformFromQuery } from "../utils/platform.js";
import {
  addTrackedAppSchema,
  addTrackedKeywordSchema,
  addCompetitorSchema,
  reorderCompetitorsSchema,
  addKeywordToAppSchema,
} from "../schemas/account.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../constants.js";

const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";

function getMinPaidPrice(plans: any[] | null | undefined): number | null {
  if (!plans || plans.length === 0) return null;
  const prices = plans
    .filter((p: any) => p.price != null && parseFloat(p.price) > 0)
    .map((p: any) => parseFloat(p.price));
  return prices.length > 0 ? Math.min(...prices) : null;
}

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (times: number) => (times > 1 ? null : 1000),
  };
}

let scraperQueue: Queue | null = null;

function getScraperQueue(): Queue {
  if (!scraperQueue) {
    scraperQueue = new Queue(INTERACTIVE_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scraperQueue;
}

/** Enqueue app_details + reviews jobs for a single app after it's tracked */
async function enqueueAppScrapeJobs(slug: string, platform: string, requestId?: string): Promise<boolean> {
  try {
    const queue = getScraperQueue();
    await queue.add("scrape:app_details", {
      type: "app_details",
      slug,
      platform,
      triggeredBy: "api:track",
      requestId,
    });
    await queue.add("scrape:reviews", {
      type: "reviews",
      slug,
      platform,
      triggeredBy: "api:track",
      requestId,
    });
    return true;
  } catch {
    return false;
  }
}


/** After adding/removing a tracked app, sync the global isTracked flag */
async function syncAppTrackedFlag(db: FastifyInstance["db"], appId: number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountTrackedApps)
    .where(eq(accountTrackedApps.appId, appId));

  const [{ countComp }] = await db
    .select({ countComp: sql<number>`count(*)::int` })
    .from(accountCompetitorApps)
    .where(eq(accountCompetitorApps.competitorAppId, appId));

  await db
    .update(apps)
    .set({
      isTracked: count + countComp > 0,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appId));
}

/** After adding/removing a tracked keyword, sync the global isActive flag */
async function syncKeywordActiveFlag(db: FastifyInstance["db"], keywordId: number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountTrackedKeywords)
    .where(eq(accountTrackedKeywords.keywordId, keywordId));

  await db
    .update(trackedKeywords)
    .set({
      isActive: count > 0,
      updatedAt: new Date(),
    })
    .where(eq(trackedKeywords.id, keywordId));
}

export const accountTrackingRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // --- Tracked Apps ---

  // GET /api/account/tracked-apps
  app.get("/tracked-apps", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({
        appSlug: apps.slug,
        createdAt: accountTrackedApps.createdAt,
        appName: apps.name,
        iconUrl: apps.iconUrl,
        isBuiltForShopify: apps.isBuiltForShopify,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
      .where(and(eq(accountTrackedApps.accountId, accountId), eq(apps.platform, platform)));

    return rows;
  });

  // POST /api/account/tracked-apps
  app.post(
    "/tracked-apps",
    { preHandler: [requireRole("owner", "editor"), requireIdempotencyKey()] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = addTrackedAppSchema.parse(request.body);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Check limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.accountId, accountId));

      if (count >= account.maxTrackedApps) {
        return reply.code(403).send({
          error: "Tracked apps limit reached",
          current: count,
          max: account.maxTrackedApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply
          .code(404)
          .send({ error: "App not found. Only existing apps can be tracked." });
      }

      // Mark as tracked
      await db
        .update(apps)
        .set({ isTracked: true, updatedAt: new Date() })
        .where(eq(apps.id, existingApp.id));

      // Add to account tracking
      const [result] = await db
        .insert(accountTrackedApps)
        .values({ accountId, appId: existingApp.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "App already tracked" });
      }

      const scraperEnqueued = await enqueueAppScrapeJobs(slug, existingApp.platform, request.id);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug
  app.delete<{ Params: { slug: string } }>(
    "/tracked-apps/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug
      const [appRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Check if tracked app exists
      const [existing] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, appRow.id)
          )
        );

      if (!existing) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Cascade: collect affected competitors and keywords before deleting
      const affectedCompetitors = await db
        .select({ competitorAppId: accountCompetitorApps.competitorAppId })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, appRow.id)
          )
        );

      const affectedKeywords = await db
        .select({ keywordId: accountTrackedKeywords.keywordId })
        .from(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppId, appRow.id)
          )
        );

      // Delete associated competitors and keywords
      await db
        .delete(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, appRow.id)
          )
        );

      await db
        .delete(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppId, appRow.id)
          )
        );

      // Delete the tracked app itself
      await db
        .delete(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, appRow.id)
          )
        );

      // Sync flags for the tracked app and all removed competitors
      await syncAppTrackedFlag(db, appRow.id);
      for (const c of affectedCompetitors) {
        await syncAppTrackedFlag(db, c.competitorAppId);
      }
      for (const k of affectedKeywords) {
        await syncKeywordActiveFlag(db, k.keywordId);
      }

      return { message: "App removed from tracking" };
    }
  );

  // --- Tracked Keywords ---

  // GET /api/account/tracked-keywords
  app.get("/tracked-keywords", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        trackedAppSlug: apps.slug,
        createdAt: accountTrackedKeywords.createdAt,
        keyword: trackedKeywords.keyword,
      })
      .from(accountTrackedKeywords)
      .innerJoin(
        trackedKeywords,
        eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
      )
      .innerJoin(apps, eq(apps.id, accountTrackedKeywords.trackedAppId))
      .where(eq(accountTrackedKeywords.accountId, accountId));

    return rows;
  });

  // POST /api/account/tracked-keywords
  app.post(
    "/tracked-keywords",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { keyword, trackedAppSlug } = addTrackedKeywordSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug
      const [trackedAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      if (!trackedAppRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      // Verify the tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, trackedAppRow.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      // Check limit (unique keywords across all my-apps)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({
          count: sql<number>`count(distinct ${accountTrackedKeywords.keywordId})::int`,
        })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.accountId, accountId));

      if (count >= account.maxTrackedKeywords) {
        return reply.code(403).send({
          error: "Tracked keywords limit reached",
          current: count,
          max: account.maxTrackedKeywords,
        });
      }

      // Ensure keyword exists in global table
      const slug = keywordToSlug(keyword);
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword, slug, platform })
        .onConflictDoUpdate({
          target: [trackedKeywords.platform, trackedKeywords.keyword],
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      // Add to account tracking with trackedAppId
      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppId: trackedAppRow.id, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Keyword already tracked for this app" });
      }

      // If keyword has no snapshots yet, enqueue a scraper job
      const [existingSnapshot] = await db
        .select({ id: keywordSnapshots.id })
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, kw.id))
        .limit(1);

      let scraperEnqueued = false;
      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:keyword_search", {
            type: "keyword_search",
            keyword: kw.keyword,
            platform,
            triggeredBy: "api",
            requestId: request.id,
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable — scraper will pick it up on next scheduled run
        }
      }

      return { ...result, keyword: kw.keyword, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-keywords/:id
  app.delete<{ Params: { id: string } }>(
    "/tracked-keywords/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const keywordId = parseInt(request.params.id, 10);
      const { trackedAppSlug } = request.query as {
        trackedAppSlug?: string;
      };

      const whereConditions = [
        eq(accountTrackedKeywords.accountId, accountId),
        eq(accountTrackedKeywords.keywordId, keywordId),
      ];
      if (trackedAppSlug) {
        const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
        const [appRow] = await db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
          .limit(1);
        if (appRow) {
          whereConditions.push(
            eq(accountTrackedKeywords.trackedAppId, appRow.id)
          );
        }
      }

      const deleted = await db
        .delete(accountTrackedKeywords)
        .where(and(...whereConditions))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tracked keyword not found" });
      }

      await syncKeywordActiveFlag(db, keywordId);

      return { message: "Keyword removed from tracking" };
    }
  );

  // --- Competitor Apps ---

  // GET /api/account/competitors — aggregate view (all competitors with trackedAppSlug)
  app.get("/competitors", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Need to join twice: once for competitor app, once for tracked app slug
    const competitorAppsAlias = apps;
    const rows = await db
      .select({
        appSlug: apps.slug,
        trackedAppSlug: sql<string>`ta.slug`,
        sortOrder: accountCompetitorApps.sortOrder,
        createdAt: accountCompetitorApps.createdAt,
        appName: apps.name,
        isBuiltForShopify: apps.isBuiltForShopify,
        launchedDate: apps.launchedDate,
        iconUrl: apps.iconUrl,
        _appId: apps.id,
        _trackedAppId: accountCompetitorApps.trackedAppId,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
      .innerJoin(sql`apps ta`, sql`ta.id = ${accountCompetitorApps.trackedAppId}`)
      .where(and(eq(accountCompetitorApps.accountId, accountId), eq(apps.platform, platform)))
      .orderBy(asc(accountCompetitorApps.sortOrder));

    if (rows.length === 0) return [];

    // Get account's tracked keyword IDs (deduplicated)
    const accountKeywords = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));
    const trackedKeywordIds = [...new Set(accountKeywords.map((k) => k.keywordId))];

    // Count distinct keywords each competitor is ranked in (latest ranking per keyword, non-null position)
    const competitorSlugs = [...new Set(rows.map((r) => r.appSlug))];
    const competitorAppIds = [...new Set(rows.map((r) => r._appId))];
    // Build id->slug map for competitors
    const compIdToSlug = new Map<number, string>();
    for (const r of rows) compIdToSlug.set(r._appId, r.appSlug);

    let rankedKeywordMap = new Map<string, number>();
    if (trackedKeywordIds.length > 0 && competitorAppIds.length > 0) {
      const appIdList = sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `);
      const idList = sql.join(trackedKeywordIds.map((id) => sql`${id}`), sql`, `);
      const rankedRows = await db.execute(sql`
        SELECT a.slug AS app_slug, COUNT(DISTINCT keyword_id)::int AS ranked_keywords
        FROM (
          SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position
          FROM app_keyword_rankings
          WHERE app_id IN (${appIdList})
            AND keyword_id IN (${idList})
          ORDER BY app_id, keyword_id, scraped_at DESC
        ) latest
        INNER JOIN apps a ON a.id = latest.app_id
        WHERE position IS NOT NULL
        GROUP BY a.slug
      `);
      const rankedData: any[] = (rankedRows as any).rows ?? rankedRows;
      for (const r of rankedData) {
        rankedKeywordMap.set(r.app_slug, r.ranked_keywords);
      }
    }

    // Ad keyword counts (last 30 days)
    const adKeywordMap = new Map<string, number>();
    const adSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    if (competitorAppIds.length > 0) {
      const adCounts = await db
        .select({
          appSlug: apps.slug,
          count: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
        })
        .from(keywordAdSightings)
        .innerJoin(apps, eq(apps.id, keywordAdSightings.appId))
        .where(
          and(
            inArray(keywordAdSightings.appId, competitorAppIds),
            sql`${keywordAdSightings.seenDate} >= ${adSinceStr}`
          )
        )
        .groupBy(apps.slug);
      for (const ac of adCounts) {
        adKeywordMap.set(ac.appSlug, ac.count);
      }
    }

    // Batch-fetch featured section counts (last 30 days)
    const featuredCountMap = new Map<string, number>();
    if (competitorAppIds.length > 0) {
      const featuredSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const featuredCounts = await db
        .select({
          appSlug: apps.slug,
          sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
        })
        .from(featuredAppSightings)
        .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
        .where(
          and(
            inArray(featuredAppSightings.appId, competitorAppIds),
            sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
          )
        )
        .groupBy(apps.slug);
      for (const fc of featuredCounts) {
        featuredCountMap.set(fc.appSlug, fc.sectionCount);
      }
    }

    // Latest category rankings for each competitor (with previous position + app count for percentile)
    const categoryRankingMap = new Map<string, { categorySlug: string; categoryTitle: string; position: number; prevPosition: number | null; appCount: number | null }[]>();
    if (competitorAppIds.length > 0) {
      const catRankRows: any[] = await db.execute(sql`
        SELECT
          a.slug AS app_slug, sub.category_slug, c.title AS category_title,
          sub.position, sub.prev_position, cs.app_count
        FROM (
          SELECT
            r.app_id,
            r.category_slug,
            r.position,
            LAG(r.position) OVER (
              PARTITION BY r.app_id, r.category_slug
              ORDER BY r.scraped_at DESC
            ) AS prev_position,
            ROW_NUMBER() OVER (
              PARTITION BY r.app_id, r.category_slug
              ORDER BY r.scraped_at DESC
            ) AS rn
          FROM app_category_rankings r
          WHERE r.app_id IN (${sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `)})
        ) sub
        INNER JOIN apps a ON a.id = sub.app_id
        JOIN categories c ON c.slug = sub.category_slug AND c.platform = ${platform}
        LEFT JOIN LATERAL (
          SELECT s.app_count
          FROM category_snapshots s
          WHERE s.category_id = c.id
          ORDER BY s.scraped_at DESC
          LIMIT 1
        ) cs ON true
        WHERE sub.rn = 1
          AND c.is_listing_page = true
          AND sub.position > 0
      `).then((res: any) => (res as any).rows ?? res);
      for (const r of catRankRows) {
        const arr = categoryRankingMap.get(r.app_slug) ?? [];
        arr.push({
          categorySlug: r.category_slug,
          categoryTitle: r.category_title,
          position: r.position,
          prevPosition: r.prev_position ?? null,
          appCount: r.app_count ?? null,
        });
        categoryRankingMap.set(r.app_slug, arr);
      }
    }

    // Batch-fetch reverse similar counts
    const reverseSimilarMap = new Map<string, number>();
    if (competitorAppIds.length > 0) {
      const rsCounts = await db
        .select({
          appSlug: apps.slug,
          count: sql<number>`count(distinct ${similarAppSightings.appId})::int`,
        })
        .from(similarAppSightings)
        .innerJoin(apps, eq(apps.id, similarAppSightings.similarAppId))
        .where(inArray(similarAppSightings.similarAppId, competitorAppIds))
        .groupBy(apps.slug);
      for (const r of rsCounts) {
        reverseSimilarMap.set(r.appSlug, r.count);
      }
    }

    // Batch-fetch similarity scores per (trackedApp, competitor) pair
    const similarityMap = new Map<string, Map<string, { overall: string; category: string; feature: string; keyword: string; text: string }>>();
    if (competitorAppIds.length > 0) {
      try {
        const trackedAppIds = [...new Set(rows.map((r) => r._trackedAppId))];
        const allPairIds = [...new Set([...trackedAppIds, ...competitorAppIds])];
        const idList = sql.join(allPairIds.map((id) => sql`${id}`), sql`, `);
        const simRows: any[] = await db.execute(sql`
          SELECT a1.slug AS app_slug_a, a2.slug AS app_slug_b,
            s.overall_score, s.category_score, s.feature_score, s.keyword_score, s.text_score
          FROM app_similarity_scores s
          INNER JOIN apps a1 ON a1.id = s.app_id_a
          INNER JOIN apps a2 ON a2.id = s.app_id_b
          WHERE s.app_id_a IN (${idList}) AND s.app_id_b IN (${idList})
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of simRows) {
          // Store both directions for easy lookup
          for (const [tracked, comp] of [[r.app_slug_a, r.app_slug_b], [r.app_slug_b, r.app_slug_a]]) {
            if (!similarityMap.has(tracked)) similarityMap.set(tracked, new Map());
            similarityMap.get(tracked)!.set(comp, {
              overall: r.overall_score,
              category: r.category_score,
              feature: r.feature_score,
              keyword: r.keyword_score,
              text: r.text_score,
            });
          }
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch review velocity metrics (graceful if table not yet migrated)
    const velocityMap = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();
    if (competitorAppIds.length > 0) {
      try {
        const velRows: any[] = await db.execute(sql`
          SELECT DISTINCT ON (m.app_id)
            a.slug AS app_slug, m.v7d, m.v30d, m.v90d, m.momentum
          FROM app_review_metrics m
          INNER JOIN apps a ON a.id = m.app_id
          WHERE m.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
          ORDER BY m.app_id, m.computed_at DESC
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of velRows) {
          velocityMap.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch visibility scores per (trackedAppId, competitorId) for this account
    const visibilityMap = new Map<string, { visibilityScore: number; keywordCount: number; visibilityRaw: number }>(); // key: "trackedAppSlug:competitorSlug"
    if (competitorAppIds.length > 0) {
      try {
        const visRows = await db
          .select({
            trackedAppSlug: sql<string>`ta.slug`,
            appSlug: sql<string>`ca.slug`,
            visibilityScore: appVisibilityScores.visibilityScore,
            keywordCount: appVisibilityScores.keywordCount,
            visibilityRaw: appVisibilityScores.visibilityRaw,
          })
          .from(appVisibilityScores)
          .innerJoin(sql`apps ta`, sql`ta.id = ${appVisibilityScores.trackedAppId}`)
          .innerJoin(sql`apps ca`, sql`ca.id = ${appVisibilityScores.appId}`)
          .where(
            and(
              eq(appVisibilityScores.accountId, accountId),
              inArray(appVisibilityScores.appId, competitorAppIds),
              sql`${appVisibilityScores.computedAt} = (
                SELECT MAX(v2.computed_at) FROM app_visibility_scores v2
                WHERE v2.account_id = ${appVisibilityScores.accountId}
                  AND v2.tracked_app_id = ${appVisibilityScores.trackedAppId}
                  AND v2.app_id = ${appVisibilityScores.appId}
              )`,
            )
          );
        for (const r of visRows) {
          visibilityMap.set(`${r.trackedAppSlug}:${r.appSlug}`, {
            visibilityScore: r.visibilityScore,
            keywordCount: r.keywordCount,
            visibilityRaw: parseFloat(String(r.visibilityRaw)),
          });
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch weighted power scores per competitor
    const weightedPowerMap = new Map<string, number>();
    const powerCategoriesMap = new Map<string, { title: string; powerScore: number; appCount: number; position: number | null; ratingScore: number; reviewScore: number; categoryScore: number; momentumScore: number }[]>();
    if (competitorAppIds.length > 0) {
      try {
        const powRows: any[] = await db.execute(sql`
          SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                 cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
          FROM app_power_scores p
          INNER JOIN apps a ON a.id = p.app_id
          INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
          LEFT JOIN LATERAL (
            SELECT s.app_count FROM category_snapshots s
            WHERE s.category_id = c.id
            ORDER BY s.scraped_at DESC LIMIT 1
          ) cs ON true
          LEFT JOIN LATERAL (
            SELECT r.position FROM app_category_rankings r
            WHERE r.app_id = p.app_id AND r.category_slug = p.category_slug AND r.position IS NOT NULL
            ORDER BY r.scraped_at DESC LIMIT 1
          ) rk ON true
          WHERE p.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
            AND p.computed_at = (
              SELECT MAX(p2.computed_at) FROM app_power_scores p2
              WHERE p2.app_id = p.app_id AND p2.category_slug = p.category_slug
            )
        `).then((res: any) => (res as any).rows ?? res);

        // Group by app, compute weighted average
        const appPowerInputs = new Map<string, { powerScore: number; appCount: number }[]>();
        for (const r of powRows) {
          if (!appPowerInputs.has(r.app_slug)) appPowerInputs.set(r.app_slug, []);
          appPowerInputs.get(r.app_slug)!.push({
            powerScore: r.power_score,
            appCount: r.app_count ?? 1,
          });
          if (!powerCategoriesMap.has(r.app_slug)) powerCategoriesMap.set(r.app_slug, []);
          powerCategoriesMap.get(r.app_slug)!.push({
            title: r.category_title || r.category_slug,
            powerScore: r.power_score,
            appCount: r.app_count ?? 1,
            position: r.rank_position ?? null,
            ratingScore: parseFloat(r.rating_score) || 0,
            reviewScore: parseFloat(r.review_score) || 0,
            categoryScore: parseFloat(r.category_score) || 0,
            momentumScore: parseFloat(r.momentum_score) || 0,
          });
        }
        for (const [appSlug, inputs] of appPowerInputs) {
          weightedPowerMap.set(appSlug, computeWeightedPowerScore(inputs));
        }
      } catch { /* table may not exist yet */ }
    }

    // Attach latest snapshot summary for each competitor
    const result = await Promise.all(
      rows.map(async (row) => {
        const [snapshot] = await db
          .select({
            averageRating: appSnapshots.averageRating,
            ratingCount: appSnapshots.ratingCount,
            pricing: appSnapshots.pricing,
            pricingPlans: appSnapshots.pricingPlans,
            categories: appSnapshots.categories,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, row._appId))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        const [change] = await db
          .select({ detectedAt: sql<string | null>`max(detected_at)` })
          .from(sql`app_field_changes`)
          .where(sql`app_id = ${row._appId}`);

        const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
        const { pricingPlans: _, categories: cats, ...snapshotRest } = snapshot || ({} as any);
        const appCategories = (cats as any[]) || [];

        return {
          ...row,
          latestSnapshot: snapshot ? snapshotRest : null,
          minPaidPrice,
          lastChangeAt: change?.detectedAt || null,
          rankedKeywords: rankedKeywordMap.get(row.appSlug) ?? 0,
          adKeywords: adKeywordMap.get(row.appSlug) ?? 0,
          featuredSections: featuredCountMap.get(row.appSlug) ?? 0,
          reverseSimilarCount: reverseSimilarMap.get(row.appSlug) ?? 0,
          visibilityScore: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityScore ?? null,
          visibilityKeywordCount: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.keywordCount ?? null,
          visibilityRaw: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityRaw ?? null,
          weightedPowerScore: weightedPowerMap.get(row.appSlug) ?? null,
          powerCategories: powerCategoriesMap.get(row.appSlug) ?? [],
          categories: appCategories.map((c: any) => {
            const slug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
            return { type: c.type || "primary", title: c.title, slug };
          }),
          categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
          reviewVelocity: velocityMap.get(row.appSlug) ?? null,
          similarityScore: similarityMap.get(row.trackedAppSlug)?.get(row.appSlug) ?? null,
        };
      })
    );

    return result;
  });

  // POST /api/account/competitors — add competitor (requires trackedAppSlug)
  app.post(
    "/competitors",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug, trackedAppSlug } = addCompetitorSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [trackedAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      if (!trackedAppRow) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Verify the tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, trackedAppRow.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      // Check limit (unique competitors across all my-apps)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({
          count: sql<number>`count(distinct ${accountCompetitorApps.competitorAppId})::int`,
        })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId));

      if (count >= account.maxCompetitorApps) {
        return reply.code(403).send({
          error: "Competitor apps limit reached",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
        });
      }

      // Mark as tracked
      await db
        .update(apps)
        .set({ isTracked: true, updatedAt: new Date() })
        .where(eq(apps.id, existingApp.id));

      // Determine next sortOrder for this (account, trackedApp) group
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${accountCompetitorApps.sortOrder}), 0)` })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, trackedAppRow.id)
          )
        );

      // Add to account competitors with trackedAppId
      const [result] = await db
        .insert(accountCompetitorApps)
        .values({ accountId, trackedAppId: trackedAppRow.id, competitorAppId: existingApp.id, sortOrder: maxOrder + 1 })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Competitor already added for this app" });
      }

      const scraperEnqueued = await enqueueAppScrapeJobs(slug, existingApp.platform, request.id);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/competitors/:slug
  app.delete<{ Params: { slug: string } }>(
    "/competitors/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { trackedAppSlug } = request.query as {
        trackedAppSlug?: string;
      };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up competitor app ID from slug
      const [compAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!compAppRow) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      const whereConditions = [
        eq(accountCompetitorApps.accountId, accountId),
        eq(accountCompetitorApps.competitorAppId, compAppRow.id),
      ];
      if (trackedAppSlug) {
        const [trackedAppRow] = await db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
          .limit(1);
        if (trackedAppRow) {
          whereConditions.push(
            eq(accountCompetitorApps.trackedAppId, trackedAppRow.id)
          );
        }
      }

      const deleted = await db
        .delete(accountCompetitorApps)
        .where(and(...whereConditions))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      await syncAppTrackedFlag(db, compAppRow.id);

      return { message: "Competitor removed" };
    }
  );

  // --- Per-app nested routes ---

  // GET /api/account/tracked-apps/:slug/competitors
  app.get<{ Params: { slug: string }; Querystring: { platform?: string; includeSelf?: string } }>(
    "/tracked-apps/:slug/competitors",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [trackedAppRow] = await db
        .select({ id: apps.id, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!trackedAppRow) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, trackedAppRow.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      const includeSelf = request.query.includeSelf === "true";

      const rows = await db
        .select({
          appSlug: apps.slug,
          _appId: apps.id,
          sortOrder: accountCompetitorApps.sortOrder,
          createdAt: accountCompetitorApps.createdAt,
          appName: apps.name,
          isBuiltForShopify: apps.isBuiltForShopify,
          launchedDate: apps.launchedDate,
          iconUrl: apps.iconUrl,
          externalId: apps.externalId,
        })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, trackedAppRow.id)
          )
        )
        .orderBy(asc(accountCompetitorApps.sortOrder));

      // Optionally prepend the tracked app itself for side-by-side comparison
      let allRows: typeof rows = [...rows];
      if (includeSelf) {
        const [selfApp] = await db
          .select({
            _appId: apps.id,
            appName: apps.name,
            isBuiltForShopify: apps.isBuiltForShopify,
            launchedDate: apps.launchedDate,
            iconUrl: apps.iconUrl,
          })
          .from(apps)
          .where(eq(apps.id, trackedAppRow.id));
        if (selfApp) {
          allRows = [{ appSlug: slug, sortOrder: -1, createdAt: new Date(), ...selfApp } as any, ...rows];
        }
      }

      // Batch-fetch featured section counts (last 30 days)
      const competitorSlugs = allRows.map((r) => r.appSlug);
      const competitorAppIds = allRows.map((r) => (r as any)._appId as number);
      const idToSlug = new Map<number, string>();
      for (const r of allRows) idToSlug.set((r as any)._appId, r.appSlug);
      const featuredSince = new Date();
      featuredSince.setDate(featuredSince.getDate() - 30);
      const featuredSinceStr = featuredSince.toISOString().slice(0, 10);

      const featuredCountMap = new Map<string, number>();
      if (competitorAppIds.length > 0) {
        const featuredCounts = await db
          .select({
            appSlug: apps.slug,
            sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
          })
          .from(featuredAppSightings)
          .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
          .where(
            and(
              inArray(featuredAppSightings.appId, competitorAppIds),
              sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
            )
          )
          .groupBy(apps.slug);

        for (const fc of featuredCounts) {
          featuredCountMap.set(fc.appSlug, fc.sectionCount);
        }
      }

      // Batch-fetch ad keyword counts (last 30 days)
      const adKeywordCountMap = new Map<string, number>();
      if (competitorAppIds.length > 0) {
        const adKeywordCounts = await db
          .select({
            appSlug: apps.slug,
            keywordCount: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
          })
          .from(keywordAdSightings)
          .innerJoin(apps, eq(apps.id, keywordAdSightings.appId))
          .where(
            and(
              inArray(keywordAdSightings.appId, competitorAppIds),
              sql`${keywordAdSightings.seenDate} >= ${featuredSinceStr}`
            )
          )
          .groupBy(apps.slug);

        for (const ac of adKeywordCounts) {
          adKeywordCountMap.set(ac.appSlug, ac.keywordCount);
        }
      }

      // Latest category rankings for each competitor (with previous position + app count for percentile)
      const categoryRankingMap = new Map<string, { categorySlug: string; categoryTitle: string; position: number; prevPosition: number | null; appCount: number | null }[]>();
      if (competitorAppIds.length > 0) {
        const catRankRows: any[] = await db.execute(sql`
          SELECT
            a.slug AS app_slug, sub.category_slug, c.title AS category_title,
            sub.position, sub.prev_position, cs.app_count
          FROM (
            SELECT
              r.app_id,
              r.category_slug,
              r.position,
              LAG(r.position) OVER (
                PARTITION BY r.app_id, r.category_slug
                ORDER BY r.scraped_at DESC
              ) AS prev_position,
              ROW_NUMBER() OVER (
                PARTITION BY r.app_id, r.category_slug
                ORDER BY r.scraped_at DESC
              ) AS rn
            FROM app_category_rankings r
            WHERE r.app_id IN (${sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `)})
          ) sub
          INNER JOIN apps a ON a.id = sub.app_id
          JOIN categories c ON c.slug = sub.category_slug AND c.platform = ${platform}
          LEFT JOIN LATERAL (
            SELECT s.app_count
            FROM category_snapshots s
            WHERE s.category_id = c.id
            ORDER BY s.scraped_at DESC
            LIMIT 1
          ) cs ON true
          WHERE sub.rn = 1
            AND c.is_listing_page = true
            AND sub.position > 0
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of catRankRows) {
          const arr = categoryRankingMap.get(r.app_slug) ?? [];
          arr.push({
            categorySlug: r.category_slug,
            categoryTitle: r.category_title,
            position: r.position,
            prevPosition: r.prev_position ?? null,
            appCount: r.app_count ?? null,
          });
          categoryRankingMap.set(r.app_slug, arr);
        }
      }

      // Batch-fetch reverse similar counts (how many apps list each competitor as similar)
      const reverseSimilarMap = new Map<string, number>();
      if (competitorAppIds.length > 0) {
        const rsCounts = await db
          .select({
            appSlug: apps.slug,
            count: sql<number>`count(distinct ${similarAppSightings.appId})::int`,
          })
          .from(similarAppSightings)
          .innerJoin(apps, eq(apps.id, similarAppSightings.similarAppId))
          .where(inArray(similarAppSightings.similarAppId, competitorAppIds))
          .groupBy(apps.slug);
        for (const r of rsCounts) {
          reverseSimilarMap.set(r.appSlug, r.count);
        }
      }

      // Batch-fetch review velocity metrics (graceful if table not yet migrated)
      const velocityMap2 = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();
      if (competitorAppIds.length > 0) {
        try {
          const velRows: any[] = await db.execute(sql`
            SELECT DISTINCT ON (m.app_id)
              a.slug AS app_slug, m.v7d, m.v30d, m.v90d, m.momentum
            FROM app_review_metrics m
            INNER JOIN apps a ON a.id = m.app_id
            WHERE m.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
            ORDER BY m.app_id, m.computed_at DESC
          `).then((res: any) => (res as any).rows ?? res);
          for (const r of velRows) {
            velocityMap2.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
          }
        } catch { /* table may not exist yet */ }
      }

      // Batch-fetch similarity scores
      const similarityMap2 = new Map<string, { overall: string; category: string; feature: string; keyword: string; text: string }>();
      if (competitorAppIds.length > 0) {
        try {
          const trackedId = trackedAppRow.id;
          const compIdList = sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `);
          const simRows: any[] = await db.execute(sql`
            SELECT a1.slug AS app_slug_a, a2.slug AS app_slug_b,
              s.overall_score, s.category_score, s.feature_score, s.keyword_score, s.text_score
            FROM app_similarity_scores s
            INNER JOIN apps a1 ON a1.id = s.app_id_a
            INNER JOIN apps a2 ON a2.id = s.app_id_b
            WHERE (s.app_id_a = ${trackedId} AND s.app_id_b IN (${compIdList}))
               OR (s.app_id_b = ${trackedId} AND s.app_id_a IN (${compIdList}))
          `).then((res: any) => (res as any).rows ?? res);
          for (const r of simRows) {
            const compSlug = r.app_slug_a === slug ? r.app_slug_b : r.app_slug_a;
            similarityMap2.set(compSlug, {
              overall: r.overall_score,
              category: r.category_score,
              feature: r.feature_score,
              keyword: r.keyword_score,
              text: r.text_score,
            });
          }
        } catch { /* table may not exist yet */ }
      }

      // Batch-fetch ranked keyword counts per competitor
      const rankedKeywordMap = new Map<string, number>();
      if (competitorAppIds.length > 0) {
        const kwRows = await db
          .select({ keywordId: accountTrackedKeywords.keywordId })
          .from(accountTrackedKeywords)
          .where(
            and(
              eq(accountTrackedKeywords.accountId, accountId),
              eq(accountTrackedKeywords.trackedAppId, trackedAppRow.id)
            )
          );
        if (kwRows.length > 0) {
          const kwIds = kwRows.map((r) => r.keywordId);
          const kwIdList = sql.join(kwIds.map((id) => sql`${id}`), sql`,`);
          const appIdList = sql.join(competitorAppIds.map((id) => sql`${id}`), sql`,`);
          const rankedRows: any[] = await db.execute(sql`
            SELECT a.slug AS app_slug, COUNT(DISTINCT latest.keyword_id)::int AS cnt
            FROM (
              SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position
              FROM app_keyword_rankings
              WHERE app_id IN (${appIdList})
                AND keyword_id IN (${kwIdList})
              ORDER BY app_id, keyword_id, scraped_at DESC
            ) latest
            INNER JOIN apps a ON a.id = latest.app_id
            WHERE position IS NOT NULL
            GROUP BY a.slug
          `).then((res: any) => (res as any).rows ?? res);
          for (const r of rankedRows) {
            rankedKeywordMap.set(r.app_slug, r.cnt);
          }
        }
      }

      // Batch-fetch visibility scores for this tracked-app context
      const visibilityMap2 = new Map<string, { visibilityScore: number; keywordCount: number; visibilityRaw: number }>();
      if (competitorAppIds.length > 0) {
        try {
          // Look up tracked app ID from slug
          const [visTrackedAppRow] = await db
            .select({ id: apps.id })
            .from(apps)
            .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
            .limit(1);
          if (visTrackedAppRow) {
            const visRows = await db
              .select({
                appSlug: sql<string>`ca.slug`,
                visibilityScore: appVisibilityScores.visibilityScore,
                keywordCount: appVisibilityScores.keywordCount,
                visibilityRaw: appVisibilityScores.visibilityRaw,
              })
              .from(appVisibilityScores)
              .innerJoin(sql`apps ca`, sql`ca.id = ${appVisibilityScores.appId}`)
              .where(
                and(
                  eq(appVisibilityScores.accountId, accountId),
                  eq(appVisibilityScores.trackedAppId, visTrackedAppRow.id),
                  inArray(appVisibilityScores.appId, competitorAppIds),
                  sql`${appVisibilityScores.computedAt} = (
                    SELECT MAX(v2.computed_at) FROM app_visibility_scores v2
                    WHERE v2.account_id = ${appVisibilityScores.accountId}
                      AND v2.tracked_app_id = ${appVisibilityScores.trackedAppId}
                      AND v2.app_id = ${appVisibilityScores.appId}
                  )`,
                )
              );
            for (const r of visRows) {
              visibilityMap2.set(r.appSlug, {
                visibilityScore: r.visibilityScore,
                keywordCount: r.keywordCount,
                visibilityRaw: parseFloat(String(r.visibilityRaw)),
              });
            }
          }
        } catch { /* table may not exist yet */ }
      }

      // Batch-fetch weighted power scores per competitor
      const weightedPowerMap2 = new Map<string, number>();
      const powerCategoriesMap2 = new Map<string, { title: string; powerScore: number; appCount: number; position: number | null; ratingScore: number; reviewScore: number; categoryScore: number; momentumScore: number }[]>();
      if (competitorAppIds.length > 0) {
        try {
          const powRows: any[] = await db.execute(sql`
            SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                   cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
            FROM app_power_scores p
            INNER JOIN apps a ON a.id = p.app_id
            INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
            LEFT JOIN LATERAL (
              SELECT s.app_count FROM category_snapshots s
              WHERE s.category_id = c.id
              ORDER BY s.scraped_at DESC LIMIT 1
            ) cs ON true
            LEFT JOIN LATERAL (
              SELECT r.position FROM app_category_rankings r
              WHERE r.app_id = p.app_id AND r.category_slug = p.category_slug AND r.position IS NOT NULL
              ORDER BY r.scraped_at DESC LIMIT 1
            ) rk ON true
            WHERE p.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
              AND p.computed_at = (
                SELECT MAX(p2.computed_at) FROM app_power_scores p2
                WHERE p2.app_id = p.app_id AND p2.category_slug = p.category_slug
              )
          `).then((res: any) => (res as any).rows ?? res);

          const appPowerInputs = new Map<string, { powerScore: number; appCount: number }[]>();
          for (const r of powRows) {
            if (!appPowerInputs.has(r.app_slug)) appPowerInputs.set(r.app_slug, []);
            appPowerInputs.get(r.app_slug)!.push({
              powerScore: r.power_score,
              appCount: r.app_count ?? 1,
            });
            if (!powerCategoriesMap2.has(r.app_slug)) powerCategoriesMap2.set(r.app_slug, []);
            powerCategoriesMap2.get(r.app_slug)!.push({
              title: r.category_title || r.category_slug,
              powerScore: r.power_score,
              appCount: r.app_count ?? 1,
              position: r.rank_position ?? null,
              ratingScore: parseFloat(r.rating_score) || 0,
              reviewScore: parseFloat(r.review_score) || 0,
              categoryScore: parseFloat(r.category_score) || 0,
              momentumScore: parseFloat(r.momentum_score) || 0,
            });
          }
          for (const [appSlug, inputs] of appPowerInputs) {
            weightedPowerMap2.set(appSlug, computeWeightedPowerScore(inputs));
          }
        } catch { /* table may not exist yet */ }
      }

      const result = await Promise.all(
        allRows.map(async (row) => {
          const [snapshot] = await db
            .select({
              averageRating: appSnapshots.averageRating,
              ratingCount: appSnapshots.ratingCount,
              pricing: appSnapshots.pricing,
              pricingPlans: appSnapshots.pricingPlans,
              categories: appSnapshots.categories,
            })
            .from(appSnapshots)
            .where(eq(appSnapshots.appId, (row as any)._appId))
            .orderBy(desc(appSnapshots.scrapedAt))
            .limit(1);

          const [change] = await db
            .select({ detectedAt: sql<string | null>`max(detected_at)` })
            .from(sql`app_field_changes`)
            .where(sql`app_id = ${(row as any)._appId}`);

          const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
          const { pricingPlans: _, categories: cats, ...snapshotRest } = snapshot || ({} as any);
          const appCategories = (cats as any[]) || [];

          return {
            ...row,
            latestSnapshot: snapshot ? snapshotRest : null,
            minPaidPrice,
            lastChangeAt: change?.detectedAt || null,
            featuredSections: featuredCountMap.get(row.appSlug) ?? 0,
            adKeywords: adKeywordCountMap.get(row.appSlug) ?? 0,
            visibilityScore: visibilityMap2.get(row.appSlug)?.visibilityScore ?? null,
            visibilityKeywordCount: visibilityMap2.get(row.appSlug)?.keywordCount ?? null,
            visibilityRaw: visibilityMap2.get(row.appSlug)?.visibilityRaw ?? null,
            weightedPowerScore: weightedPowerMap2.get(row.appSlug) ?? null,
            powerCategories: powerCategoriesMap2.get(row.appSlug) ?? [],
            categories: appCategories.map((c: any) => {
              const catSlug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
              return { type: c.type || "primary", title: c.title, slug: catSlug };
            }),
            categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
            reverseSimilarCount: reverseSimilarMap.get(row.appSlug) ?? 0,
            rankedKeywordCount: rankedKeywordMap.get(row.appSlug) ?? 0,
            reviewVelocity: velocityMap2.get(row.appSlug) ?? null,
            similarityScore: similarityMap2.get(row.appSlug) ?? null,
            isSelf: includeSelf && row.appSlug === slug,
          };
        })
      );

      return result;
    }
  );

  // POST /api/account/tracked-apps/:slug/competitors
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { slug: competitorSlug } = addTrackedAppSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [trackedAppRow2] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      if (!trackedAppRow2) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, trackedAppRow2.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      // Check limit (unique competitors across all my-apps)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({
          count: sql<number>`count(distinct ${accountCompetitorApps.competitorAppId})::int`,
        })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId));

      if (count >= account.maxCompetitorApps) {
        return reply.code(403).send({
          error: "Competitor apps limit reached",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, competitorSlug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
        });
      }

      // Mark as tracked globally
      await db
        .update(apps)
        .set({ isTracked: true, updatedAt: new Date() })
        .where(eq(apps.id, existingApp.id));

      // Determine next sortOrder for this (account, trackedApp) group
      const [{ maxOrder: maxOrd }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${accountCompetitorApps.sortOrder}), 0)` })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, trackedAppRow2.id)
          )
        );

      const [result] = await db
        .insert(accountCompetitorApps)
        .values({
          accountId,
          trackedAppId: trackedAppRow2.id,
          competitorAppId: existingApp.id,
          sortOrder: maxOrd + 1,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Competitor already added for this app" });
      }

      const scraperEnqueued = await enqueueAppScrapeJobs(competitorSlug, existingApp.platform, request.id);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug/competitors/:competitorSlug
  app.delete<{ Params: { slug: string; competitorSlug: string } }>(
    "/tracked-apps/:slug/competitors/:competitorSlug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const competitorSlug = decodeURIComponent(
        request.params.competitorSlug
      );
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [delTrackedAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      const [delCompAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, competitorSlug), eq(apps.platform, platform)))
        .limit(1);

      if (!delTrackedAppRow || !delCompAppRow) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      const deleted = await db
        .delete(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, delTrackedAppRow.id),
            eq(accountCompetitorApps.competitorAppId, delCompAppRow.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      await syncAppTrackedFlag(db, delCompAppRow.id);

      return { message: "Competitor removed" };
    }
  );

  // PATCH /api/account/tracked-apps/:slug/competitors/reorder
  app.patch<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors/reorder",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { slugs } = reorderCompetitorsSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [reorderTrackedAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      if (!reorderTrackedAppRow) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Look up all competitor app IDs from slugs
      const compAppRows = await db
        .select({ id: apps.id, slug: apps.slug })
        .from(apps)
        .where(inArray(apps.slug, slugs));
      const slugToId = new Map(compAppRows.map((r) => [r.slug, r.id]));

      // Update sort_order for each slug based on array index
      await Promise.all(
        slugs.map((slug, index) => {
          const compId = slugToId.get(slug);
          if (!compId) return Promise.resolve();
          return db
            .update(accountCompetitorApps)
            .set({ sortOrder: index + 1 })
            .where(
              and(
                eq(accountCompetitorApps.accountId, accountId),
                eq(accountCompetitorApps.trackedAppId, reorderTrackedAppRow.id),
                eq(accountCompetitorApps.competitorAppId, compId)
              )
            );
        })
      );

      return { message: "Competitors reordered" };
    }
  );

  // GET /api/account/tracked-apps/:slug/keywords?appSlugs=slug1,slug2
  app.get<{ Params: { slug: string }; Querystring: { appSlugs?: string } }>(
    "/tracked-apps/:slug/keywords",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { appSlugs: appSlugsParam } = request.query;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [kwAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!kwAppRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, kwAppRow.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      const rows = await db
        .select({
          keywordId: accountTrackedKeywords.keywordId,
          createdAt: accountTrackedKeywords.createdAt,
          keyword: trackedKeywords.keyword,
          keywordSlug: trackedKeywords.slug,
        })
        .from(accountTrackedKeywords)
        .innerJoin(
          trackedKeywords,
          eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
        )
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppId, kwAppRow.id)
          )
        );

      // Enrich with latest snapshot
      const result = await Promise.all(
        rows.map(async (row) => {
          const [snapshot] = await db
            .select({
              totalResults: keywordSnapshots.totalResults,
              scrapedAt: keywordSnapshots.scrapedAt,
            })
            .from(keywordSnapshots)
            .where(eq(keywordSnapshots.keywordId, row.keywordId))
            .orderBy(desc(keywordSnapshots.scrapedAt))
            .limit(1);

          return {
            ...row,
            latestSnapshot: snapshot || null,
          };
        })
      );

      // Batch-fetch tags for all keywords
      const keywordIds = rows.map((r) => r.keywordId);
      const tagMap = new Map<
        number,
        Array<{ id: string; name: string; color: string }>
      >();
      if (keywordIds.length > 0) {
        const tagRows = await db
          .select({
            keywordId: keywordTagAssignments.keywordId,
            tagId: keywordTags.id,
            tagName: keywordTags.name,
            tagColor: keywordTags.color,
          })
          .from(keywordTagAssignments)
          .innerJoin(
            keywordTags,
            eq(keywordTags.id, keywordTagAssignments.tagId)
          )
          .where(
            and(
              eq(keywordTags.accountId, accountId),
              inArray(keywordTagAssignments.keywordId, keywordIds)
            )
          );
        for (const tr of tagRows) {
          const list = tagMap.get(tr.keywordId) || [];
          list.push({
            id: tr.tagId,
            name: tr.tagName,
            color: tr.tagColor,
          });
          tagMap.set(tr.keywordId, list);
        }
      }

      // Optionally enrich with latest ranking position per app
      const slugList = appSlugsParam?.split(",").filter(Boolean) || [];

      // Check which keywords have auto-suggestions
      let suggestionSet = new Set<number>();
      if (keywordIds.length > 0) {
        const suggRows = await db
          .select({ keywordId: keywordAutoSuggestions.keywordId })
          .from(keywordAutoSuggestions)
          .where(and(
            inArray(keywordAutoSuggestions.keywordId, keywordIds),
            sql`jsonb_array_length(${keywordAutoSuggestions.suggestions}) > 0`
          ));
        suggestionSet = new Set(suggRows.map((r) => r.keywordId));
      }

      if (slugList.length > 0 && keywordIds.length > 0) {
        // Look up app IDs from slugs
        const appIdRows = await db
          .select({ id: apps.id, slug: apps.slug })
          .from(apps)
          .where(inArray(apps.slug, slugList));
        const rankAppIds = appIdRows.map((r) => r.id);

        if (rankAppIds.length > 0) {
        const appIdSql = sql.join(rankAppIds.map((id) => sql`${id}`), sql`, `);
        const idSql = sql.join(keywordIds.map((id) => sql`${id}`), sql`, `);
        const rawResult = await db.execute(sql`
            SELECT DISTINCT ON (r.app_id, r.keyword_id)
              a.slug AS app_slug, r.keyword_id, r.position
            FROM app_keyword_rankings r
            INNER JOIN apps a ON a.id = r.app_id
            WHERE r.app_id IN (${appIdSql})
              AND r.keyword_id IN (${idSql})
            ORDER BY r.app_id, r.keyword_id, r.scraped_at DESC
          `);
        const rankingRows: any[] = (rawResult as any).rows ?? rawResult;

        // Build lookup: appSlug -> keywordId -> position
        const lookup = new Map<string, Map<number, number | null>>();
        for (const r of rankingRows) {
          if (!lookup.has(r.app_slug)) lookup.set(r.app_slug, new Map());
          lookup.get(r.app_slug)!.set(r.keyword_id, r.position);
        }

        return result.map((row) => ({
          ...row,
          tags: tagMap.get(row.keywordId) || [],
          hasSuggestions: suggestionSet.has(row.keywordId),
          rankings: Object.fromEntries(
            slugList.map((s) => [s, lookup.get(s)?.get(row.keywordId) ?? null])
          ),
        }));
        } // end if (rankAppIds.length > 0)
      }

      return result.map((row) => ({
        ...row,
        tags: tagMap.get(row.keywordId) || [],
        hasSuggestions: suggestionSet.has(row.keywordId),
      }));
    }
  );

  // POST /api/account/tracked-apps/:slug/keywords
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/keywords",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { keyword } = addKeywordToAppSchema.parse(request.body);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [postKwAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      if (!postKwAppRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, postKwAppRow.id)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      // Check limit (unique keywords across all my-apps)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({
          count: sql<number>`count(distinct ${accountTrackedKeywords.keywordId})::int`,
        })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.accountId, accountId));

      if (count >= account.maxTrackedKeywords) {
        return reply.code(403).send({
          error: "Tracked keywords limit reached",
          current: count,
          max: account.maxTrackedKeywords,
        });
      }

      // Ensure keyword exists in global table
      const kwSlug = keywordToSlug(keyword);
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword, slug: kwSlug, platform })
        .onConflictDoUpdate({
          target: [trackedKeywords.platform, trackedKeywords.keyword],
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppId: postKwAppRow.id, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Keyword already tracked for this app" });
      }

      // Enqueue scraper if no snapshots
      const [existingSnapshot] = await db
        .select({ id: keywordSnapshots.id })
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, kw.id))
        .limit(1);

      let scraperEnqueued = false;
      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:keyword_search", {
            type: "keyword_search",
            keyword: kw.keyword,
            platform,
            triggeredBy: "api",
            requestId: request.id,
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable
        }
      }

      return { ...result, keyword: kw.keyword, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug/keywords/:keywordId
  app.delete<{ Params: { slug: string; keywordId: string } }>(
    "/tracked-apps/:slug/keywords/:keywordId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const keywordId = parseInt(request.params.keywordId, 10);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [delKwAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);

      const deleteWhereConditions = [
        eq(accountTrackedKeywords.accountId, accountId),
        eq(accountTrackedKeywords.keywordId, keywordId),
      ];
      if (delKwAppRow) {
        deleteWhereConditions.push(eq(accountTrackedKeywords.trackedAppId, delKwAppRow.id));
      }

      const deleted = await db
        .delete(accountTrackedKeywords)
        .where(and(...deleteWhereConditions))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tracked keyword not found" });
      }

      await syncKeywordActiveFlag(db, keywordId);

      return { message: "Keyword removed from tracking" };
    }
  );

  // GET /api/account/tracked-apps/:slug/keyword-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/keyword-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = String(PAGINATION_DEFAULT_LIMIT), debug = "false" } = request.query as {
        limit?: string;
        debug?: string;
      };
      const isDebug = debug === "true";
      const maxResults = Math.min(parseInt(limitStr, 10) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app from slug
      const [appRow] = await db
        .select({
          id: apps.id,
          name: apps.name,
          subtitle: apps.appCardSubtitle,
        })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!appRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      // Verify app is tracked by this account
      const [tracked] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, appRow.id)
          )
        )
        .limit(1);

      if (!tracked) {
        return reply.code(404).send({ error: "App not tracked by this account" });
      }

      const [snapshot] = await db
        .select({
          appIntroduction: appSnapshots.appIntroduction,
          appDetails: appSnapshots.appDetails,
          features: appSnapshots.features,
          categories: appSnapshots.categories,
        })
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, appRow.id))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(1);

      // Get already-tracked keywords for this app+account
      const trackedKws = await db
        .select({ keyword: trackedKeywords.keyword })
        .from(accountTrackedKeywords)
        .innerJoin(
          trackedKeywords,
          eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
        )
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppId, appRow.id)
          )
        );

      const trackedSet = new Set(
        trackedKws.map((k) => k.keyword.toLowerCase())
      );

      // Extract keyword suggestions
      const { extractKeywordsFromAppMetadata } = await import(
        "@appranks/shared"
      );

      const allSuggestions = extractKeywordsFromAppMetadata({
        name: appRow.name ?? "",
        subtitle: appRow.subtitle,
        introduction: snapshot?.appIntroduction ?? null,
        description: snapshot?.appDetails ?? null,
        features: (snapshot?.features as string[]) ?? [],
        categories: (snapshot?.categories as any[]) ?? [],
      });

      const suggestions = allSuggestions.slice(0, maxResults).map((s: any) => ({
        keyword: s.keyword,
        score: Math.round(s.score * 10) / 10,
        count: s.count,
        tracked: trackedSet.has(s.keyword.toLowerCase()),
        ...(isDebug && {
          sources: s.sources.map((src: any) => ({
            field: src.field,
            weight: src.weight,
          })),
        }),
      }));

      return {
        suggestions,
        ...(isDebug && {
          weights: (await import("@appranks/shared")).FIELD_WEIGHTS,
          metadata: {
            appName: appRow.name,
            totalCandidates: allSuggestions.length,
            afterFiltering: suggestions.length,
          },
        }),
      };
    }
  );

  // GET /api/account/tracked-apps/:slug/competitor-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitor-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = "20" } = request.query as { limit?: string };
      const maxResults = Math.min(parseInt(limitStr, 10) || 20, 48);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // 1. Verify tracked app belongs to account
      const [compSugAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!compSugAppRow) {
        return reply.code(404).send({ error: "App not found" });
      }

      const [tracked] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, compSugAppRow.id)
          )
        )
        .limit(1);

      if (!tracked) {
        return reply.code(404).send({ error: "App not tracked by this account" });
      }

      // 2. Get tracked app's categories from actual rankings (not snapshot URLs,
      //    which may contain subcategory slugs that don't exist in appCategoryRankings)
      const trackedCatRows: any[] = await db
        .execute(
          sql`
          SELECT DISTINCT ON (category_slug) category_slug
          FROM app_category_rankings
          WHERE app_id = ${compSugAppRow.id}
          ORDER BY category_slug, scraped_at DESC
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      const trackedCatSlugs = new Set(trackedCatRows.map((r: any) => r.category_slug as string));

      if (trackedCatSlugs.size === 0) {
        return { suggestions: [] };
      }

      // Also get latest snapshot for similarity computation
      const [trackedSnapshot] = await db
        .select({ categories: appSnapshots.categories, platformData: appSnapshots.platformData, appIntroduction: appSnapshots.appIntroduction })
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, compSugAppRow.id))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(1);

      const { extractCategorySlugs, extractCategorySlugsFromPlatformData, extractFeatureHandles, tokenize, computeSimilarityBetween, getSimilarityStopWords } =
        await import("@appranks/shared");

      const trackedCategories = (trackedSnapshot?.categories as any[]) ?? [];
      const trackedPlatformData = (trackedSnapshot?.platformData ?? {}) as Record<string, unknown>;

      // 3. Get existing competitors for this (account, trackedAppSlug) pair
      const existingComps = await db
        .select({ appSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppId, compSugAppRow.id)
          )
        );
      const existingCompSlugs = new Set(existingComps.map((c) => c.appSlug));

      // 4. Gather candidate apps — top 24 per category from appCategoryRankings
      const catSlugArray = [...trackedCatSlugs];
      const catSlugList = sql.join(catSlugArray.map((s) => sql`${s}`), sql`, `);

      const candidateRows: any[] = await db
        .execute(
          sql`
          WITH latest_positions AS (
            SELECT DISTINCT ON (r.app_id, r.category_slug)
              a.slug AS app_slug, r.category_slug, r.position
            FROM app_category_rankings r
            INNER JOIN apps a ON a.id = r.app_id
            WHERE r.category_slug IN (${catSlugList})
              AND r.app_id != ${compSugAppRow.id}
            ORDER BY r.app_id, r.category_slug, r.scraped_at DESC
          ),
          ranked AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY category_slug ORDER BY position) AS rn
            FROM latest_positions
          )
          SELECT app_slug, category_slug, position FROM ranked WHERE rn <= 24
        `
        )
        .then((res: any) => (res as any).rows ?? res);

      if (candidateRows.length === 0) {
        return { suggestions: [] };
      }

      // Build candidate slug → category ranks map
      const candidateCatRanks = new Map<string, Array<{ categorySlug: string; position: number }>>();
      const candidateSlugs = new Set<string>();
      for (const row of candidateRows) {
        candidateSlugs.add(row.app_slug);
        if (!candidateCatRanks.has(row.app_slug)) candidateCatRanks.set(row.app_slug, []);
        candidateCatRanks.get(row.app_slug)!.push({ categorySlug: row.category_slug, position: row.position });
      }

      // 5. Batch-fetch data for all candidates + tracked app
      const allSlugs = [...candidateSlugs, slug];
      const slugListSql = sql.join(allSlugs.map((s) => sql`${s}`), sql`, `);

      // Fetch snapshots, app info, and keywords in parallel
      const [snapshotRows, appInfoRows, kwRows] = await Promise.all([
        db
          .execute(
            sql`
            SELECT DISTINCT ON (s.app_id)
              a.slug AS app_slug, s.categories, s.platform_data, s.app_introduction
            FROM app_snapshots s
            INNER JOIN apps a ON a.id = s.app_id
            WHERE a.slug IN (${slugListSql})
            ORDER BY s.app_id, s.scraped_at DESC
          `
          )
          .then((res: any) => (res as any).rows ?? res) as Promise<any[]>,

        db
          .execute(
            sql`
            SELECT slug, name, app_card_subtitle, icon_url, average_rating, rating_count,
                   pricing_hint, is_built_for_shopify, external_id
            FROM apps
            WHERE slug IN (${slugListSql})
              AND platform = ${platform}
          `
          )
          .then((res: any) => (res as any).rows ?? res) as Promise<any[]>,

        db
          .execute(
            sql`
            SELECT DISTINCT ON (r.app_id, r.keyword_id) a.slug AS app_slug, r.keyword_id
            FROM app_keyword_rankings r
            INNER JOIN apps a ON a.id = r.app_id
            WHERE a.slug IN (${slugListSql})
              AND r.position IS NOT NULL
            ORDER BY r.app_id, r.keyword_id, r.scraped_at DESC
          `
          )
          .then((res: any) => (res as any).rows ?? res) as Promise<any[]>,
      ]);

      // Build lookup maps
      const snapshotMap = new Map<string, any>();
      for (const r of snapshotRows) snapshotMap.set(r.app_slug, r);

      const appInfoMap = new Map<string, any>();
      for (const r of appInfoRows) appInfoMap.set(r.slug, r);

      const keywordMap = new Map<string, Set<string>>();
      for (const r of kwRows) {
        if (!keywordMap.has(r.app_slug)) keywordMap.set(r.app_slug, new Set());
        keywordMap.get(r.app_slug)!.add(String(r.keyword_id));
      }

      // 6. Prepare tracked app's similarity data
      const trackedAppInfo = appInfoMap.get(slug);
      const stopWords = getSimilarityStopWords(platform);
      const trackedTextParts = [
        trackedAppInfo?.name ?? "",
        trackedAppInfo?.app_card_subtitle ?? "",
        trackedSnapshot?.appIntroduction ?? "",
      ].join(" ");

      const trackedData = {
        categorySlugs: platform !== "shopify"
          ? extractCategorySlugsFromPlatformData(trackedPlatformData, platform)
          : trackedCatSlugs,
        featureHandles: extractFeatureHandles(trackedCategories, platform),
        keywordIds: keywordMap.get(slug) ?? new Set<string>(),
        textTokens: tokenize(trackedTextParts, stopWords),
      };

      // 7. Check similarAppSightings for bonus signal
      const candidateSlugArray = [...candidateSlugs];
      // Look up candidate app IDs for similar_app_sightings query
      const candidateAppIdRows = await db
        .select({ id: apps.id, slug: apps.slug })
        .from(apps)
        .where(inArray(apps.slug, candidateSlugArray));
      const candidateAppIdList = candidateAppIdRows.map((r) => r.id);
      const candidateIdToSlug = new Map(candidateAppIdRows.map((r) => [r.id, r.slug]));

      let shopifySimilarSlugs = new Set<string>();
      if (candidateAppIdList.length > 0) {
        const candidateIdSql = sql.join(candidateAppIdList.map((id) => sql`${id}`), sql`, `);
        const similarRows: any[] = await db
          .execute(
            sql`
            SELECT DISTINCT sa.similar_app_id
            FROM similar_app_sightings sa
            WHERE sa.app_id = ${compSugAppRow.id}
              AND sa.similar_app_id IN (${candidateIdSql})
          `
          )
          .then((res: any) => (res as any).rows ?? res);
        shopifySimilarSlugs = new Set(
          similarRows
            .map((r: any) => candidateIdToSlug.get(r.similar_app_id))
            .filter((s): s is string => !!s)
        );
      }

      // 8. Compute similarity for each candidate
      const suggestions: any[] = [];
      for (const candidateSlug of candidateSlugs) {
        const snap = snapshotMap.get(candidateSlug);
        const info = appInfoMap.get(candidateSlug);
        if (!info) continue;

        const cats = snap?.categories ?? [];
        const candidatePd = (snap?.platform_data ?? {}) as Record<string, unknown>;
        let candidateCatSlugsSet: Set<string>;
        if (platform !== "shopify" && snap) {
          candidateCatSlugsSet = extractCategorySlugsFromPlatformData(candidatePd, platform);
        } else if (cats.length > 0) {
          candidateCatSlugsSet = extractCategorySlugs(cats);
        } else {
          candidateCatSlugsSet = new Set(candidateCatRanks.get(candidateSlug)?.map((cr) => cr.categorySlug) ?? []);
        }

        const candidateTextParts = [
          info.name ?? "",
          info.app_card_subtitle ?? "",
          snap?.app_introduction ?? "",
        ].join(" ");

        const candidateData = {
          categorySlugs: candidateCatSlugsSet,
          featureHandles: snap ? extractFeatureHandles(cats, platform) : new Set<string>(),
          keywordIds: keywordMap.get(candidateSlug) ?? new Set<string>(),
          textTokens: tokenize(candidateTextParts, stopWords),
        };

        const similarity = computeSimilarityBetween(trackedData, candidateData, platform);

        // Bonus for Shopify-listed similar apps (add 5% to overall, capped at 1)
        if (shopifySimilarSlugs.has(candidateSlug)) {
          similarity.overall = Math.min(1, similarity.overall + 0.05);
        }

        const isAlreadyCompetitor = existingCompSlugs.has(candidateSlug);

        suggestions.push({
          appSlug: candidateSlug,
          appName: info.name,
          iconUrl: info.icon_url ?? null,
          averageRating: info.average_rating ?? null,
          ratingCount: info.rating_count != null ? Number(info.rating_count) : null,
          pricingHint: info.pricing_hint ?? null,
          isBuiltForShopify: info.is_built_for_shopify ?? false,
          externalId: info.external_id ?? null,
          isAlreadyCompetitor,
          similarity: {
            overall: Math.round(similarity.overall * 10000) / 10000,
            category: Math.round(similarity.category * 10000) / 10000,
            feature: Math.round(similarity.feature * 10000) / 10000,
            keyword: Math.round(similarity.keyword * 10000) / 10000,
            text: Math.round(similarity.text * 10000) / 10000,
          },
          categoryRanks: candidateCatRanks.get(candidateSlug) ?? [],
          isShopifySimilar: shopifySimilarSlugs.has(candidateSlug),
        });
      }

      // 9. Sort by overall score descending, return top N
      suggestions.sort((a, b) => b.similarity.overall - a.similarity.overall);

      return { suggestions: suggestions.slice(0, maxResults) };
    }
  );
};
