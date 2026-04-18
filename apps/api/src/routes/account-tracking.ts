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
  appFieldChanges,
  categories,
  categorySnapshots,
  sqlArray,
  aiKeywordSuggestions,
  aiCompetitorSuggestions,
  aiLogs,
} from "@appranks/db";
import {
  computeWeightedPowerScore,
  callAI,
  logAICall,
  isRateLimitOrQuota,
  generateKeywordSuggestions,
  mergeKeywords,
  generateCompetitorSuggestions,
  mergeCompetitorScores,
  preFilterCandidates,
} from "@appranks/shared";
import type { AIClient, NgramKeyword, CompetitorCandidate, JaccardScore } from "@appranks/shared";
import OpenAI from "openai";
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
import { cacheGet, cacheDel } from "../utils/cache.js";
import { PLATFORMS } from "@appranks/shared";

const PLATFORM_STATS_TTL_SECONDS = 30;

function platformStatsCacheKey(accountId: string, platform?: string): string {
  return platform ? `platform-stats:${accountId}:${platform}` : `platform-stats:${accountId}`;
}

async function invalidatePlatformStats(accountId: string, platform?: string): Promise<void> {
  await cacheDel(platformStatsCacheKey(accountId));
  if (platform) await cacheDel(platformStatsCacheKey(accountId, platform));
}

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

  // --- Platform Stats (lightweight badge counts) ---

  // GET /api/account/platform-stats — fast counts for the platform badge.
  // Cached for ~30s to avoid repeated aggregation on page navigation.
  // Accepts optional ?platform=<id> to scope to a single platform.
  app.get("/platform-stats", async (request) => {
    const { accountId } = request.user;
    const rawPlatform = (request.query as Record<string, unknown> | undefined)?.platform;
    const platformFilter =
      typeof rawPlatform === "string" && rawPlatform in PLATFORMS ? rawPlatform : undefined;

    return cacheGet(
      platformStatsCacheKey(accountId, platformFilter),
      async () => {
        // 3 simple COUNT queries — no joins with snapshots/rankings
        const appsWhere = platformFilter
          ? and(eq(accountTrackedApps.accountId, accountId), eq(apps.platform, platformFilter))
          : eq(accountTrackedApps.accountId, accountId);
        const keywordsWhere = platformFilter
          ? and(
              eq(accountTrackedKeywords.accountId, accountId),
              sql`COALESCE(${apps.platform}, ${trackedKeywords.platform}) = ${platformFilter}`
            )
          : eq(accountTrackedKeywords.accountId, accountId);
        const competitorsWhere = platformFilter
          ? and(
              eq(accountCompetitorApps.accountId, accountId),
              eq(apps.platform, platformFilter)
            )
          : eq(accountCompetitorApps.accountId, accountId);

        const [appCounts, keywordCounts, competitorCounts] = await Promise.all([
          db
            .select({ platform: apps.platform, count: sql<number>`count(*)::int` })
            .from(accountTrackedApps)
            .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
            .where(appsWhere)
            .groupBy(apps.platform),
          db
            .select({ platform: sql<string>`COALESCE(${apps.platform}, ${trackedKeywords.platform})`, count: sql<number>`count(distinct ${accountTrackedKeywords.keywordId})::int` })
            .from(accountTrackedKeywords)
            .leftJoin(apps, eq(apps.id, accountTrackedKeywords.trackedAppId))
            .innerJoin(trackedKeywords, eq(trackedKeywords.id, accountTrackedKeywords.keywordId))
            .where(keywordsWhere)
            .groupBy(sql`COALESCE(${apps.platform}, ${trackedKeywords.platform})`),
          db
            .select({ platform: apps.platform, count: sql<number>`count(distinct ${accountCompetitorApps.competitorAppId})::int` })
            .from(accountCompetitorApps)
            .innerJoin(apps, eq(apps.id, accountCompetitorApps.trackedAppId))
            .where(competitorsWhere)
            .groupBy(apps.platform),
        ]);

        const stats: Record<string, { apps: number; keywords: number; competitors: number }> = {};
        for (const row of appCounts) {
          if (!stats[row.platform]) stats[row.platform] = { apps: 0, keywords: 0, competitors: 0 };
          stats[row.platform].apps = row.count;
        }
        for (const row of keywordCounts) {
          if (!stats[row.platform]) stats[row.platform] = { apps: 0, keywords: 0, competitors: 0 };
          stats[row.platform].keywords = row.count;
        }
        for (const row of competitorCounts) {
          if (!stats[row.platform]) stats[row.platform] = { apps: 0, keywords: 0, competitors: 0 };
          stats[row.platform].competitors = row.count;
        }

        return stats;
      },
      PLATFORM_STATS_TTL_SECONDS
    );
  });

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

  // GET /api/account/tracked-apps/sidebar — lightweight list for sidebar navigation
  app.get("/tracked-apps/sidebar", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        platform: apps.platform,
        slug: apps.slug,
        name: apps.name,
        iconUrl: apps.iconUrl,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
      .where(eq(accountTrackedApps.accountId, accountId))
      .orderBy(apps.platform, apps.name);

    return rows;
  });

  // POST /api/account/tracked-apps
  app.post(
    "/tracked-apps",
    { preHandler: [requireRole("owner", "admin", "editor"), requireIdempotencyKey()] },
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
          error: "Tracked apps limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
          current: count,
          max: account.maxTrackedApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform, name: apps.name })
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

      await invalidatePlatformStats(accountId, platform);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "app_tracked", "app", slug, { platform, slug, appName: existingApp.name })).catch(() => {});
      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug
  app.delete<{ Params: { slug: string } }>(
    "/tracked-apps/:slug",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug
      const [appRow] = await db
        .select({ id: apps.id, name: apps.name })
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

      await invalidatePlatformStats(accountId, platform);
      // Activity log (fire-and-forget)
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "app_untracked", "app", slug, { platform, slug, appName: appRow.name })).catch(() => {});
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
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { keyword, trackedAppSlug } = addTrackedKeywordSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug (optional — null for research mode)
      let trackedAppIdValue: number | null = null;
      if (trackedAppSlug) {
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
        trackedAppIdValue = trackedAppRow.id;
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
          error: "Tracked keywords limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
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

      // Add to account tracking (trackedAppId is null for research mode)
      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppId: trackedAppIdValue, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: trackedAppSlug ? "Keyword already tracked for this app" : "Keyword already tracked" });
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

      await invalidatePlatformStats(accountId, platform);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "keyword_tracked", "keyword", String(kw.id), { keyword: kw.keyword, platform, appSlug: trackedAppSlug || null })).catch(() => {});
      return { ...result, keyword: kw.keyword, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-keywords/:id
  app.delete<{ Params: { id: string } }>(
    "/tracked-keywords/:id",
    { preHandler: [requireRole("owner", "admin", "editor")] },
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

      await invalidatePlatformStats(accountId);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "keyword_untracked", "keyword", String(keywordId), { keywordId })).catch(() => {});
      return { message: "Keyword removed from tracking" };
    }
  );

  // --- Competitor Apps ---

  // GET /api/account/competitors — aggregate view (all competitors with trackedAppSlug)
  app.get("/competitors", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Per-phase timing instrumentation for Phase 1 measurement (PLA-1105).
    // Each request issues ~12 DB round-trips grouped into 4 parallel waves; the
    // slowest query in each wave bounds the wall time. Enabling DEBUG_SLOW_QUERIES
    // surfaces which wave dominates so we can target Phase 2 fixes at the real
    // offender instead of guessing. Zero cost when the flag is off.
    const debugSlow = process.env.DEBUG_SLOW_QUERIES === "1" || process.env.DEBUG_SLOW_QUERIES === "true";
    const t0 = Date.now();
    const phaseTimings: Record<string, number> = {};
    const mark = (phase: string, start: number) => {
      if (debugSlow) phaseTimings[phase] = Date.now() - start;
    };

    // Need to join twice: once for competitor app, once for tracked app slug
    const competitorAppsAlias = apps;
    const t_main = Date.now();
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
    mark("main", t_main);

    if (rows.length === 0) return [];

    // Derive competitor IDs and fetch tracked keywords in parallel (independent)
    const competitorSlugs = [...new Set(rows.map((r) => r.appSlug))];
    const competitorAppIds = [...new Set(rows.map((r) => r._appId))];
    const compIdToSlug = new Map<number, string>();
    for (const r of rows) compIdToSlug.set(r._appId, r.appSlug);

    const t_keywords = Date.now();
    const accountKeywords = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));
    const trackedKeywordIds = [...new Set(accountKeywords.map((k) => k.keywordId))];
    mark("keywords", t_keywords);

    // Run ranked keywords, ad counts, and featured counts in parallel
    const rankedKeywordMap = new Map<string, number>();
    const adKeywordMap = new Map<string, number>();
    const featuredCountMap = new Map<string, number>();
    const adSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    if (competitorAppIds.length > 0) {
      const appIdList = sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `);

      const t_wave1 = Date.now();
      const [rankedData, adCounts, featuredCounts] = await Promise.all([
        // Ranked keyword counts
        (trackedKeywordIds.length > 0
          ? db.execute(sql`
              SELECT a.slug AS app_slug, COUNT(DISTINCT keyword_id)::int AS ranked_keywords
              FROM (
                SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position
                FROM app_keyword_rankings
                WHERE app_id IN (${appIdList})
                  AND keyword_id IN (${sql.join(trackedKeywordIds.map((id) => sql`${id}`), sql`, `)})
                ORDER BY app_id, keyword_id, scraped_at DESC
              ) latest
              INNER JOIN apps a ON a.id = latest.app_id
              WHERE position IS NOT NULL
              GROUP BY a.slug
            `).then((res: any) => ((res as any).rows ?? res) as any[])
          : Promise.resolve([] as any[])
        ),
        // Ad keyword counts (last 30 days)
        db.select({
          appSlug: apps.slug,
          count: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
        })
          .from(keywordAdSightings)
          .innerJoin(apps, eq(apps.id, keywordAdSightings.appId))
          .where(and(
            inArray(keywordAdSightings.appId, competitorAppIds),
            sql`${keywordAdSightings.seenDate} >= ${adSinceStr}`
          ))
          .groupBy(apps.slug),
        // Featured section counts (last 30 days)
        db.select({
          appSlug: apps.slug,
          sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
        })
          .from(featuredAppSightings)
          .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
          .where(and(
            inArray(featuredAppSightings.appId, competitorAppIds),
            sql`${featuredAppSightings.seenDate} >= ${adSinceStr}`
          ))
          .groupBy(apps.slug),
      ]);

      mark("wave1_ranked_ads_featured", t_wave1);
      for (const r of rankedData) rankedKeywordMap.set(r.app_slug, r.ranked_keywords);
      for (const ac of adCounts) adKeywordMap.set(ac.appSlug, ac.count);
      for (const fc of featuredCounts) featuredCountMap.set(fc.appSlug, fc.sectionCount);
    }

    // Run category rankings, reverse similar, similarity, velocity in parallel
    const categoryRankingMap = new Map<string, { categorySlug: string; categoryTitle: string; position: number; prevPosition: number | null; appCount: number | null }[]>();
    const reverseSimilarMap = new Map<string, number>();
    const similarityMap = new Map<string, Map<string, { overall: string; category: string; feature: string; keyword: string; text: string }>>();
    const velocityMap = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();

    if (competitorAppIds.length > 0) {
      const trackedAppIds = [...new Set(rows.map((r) => r._trackedAppId))];
      const allPairIds = [...new Set([...trackedAppIds, ...competitorAppIds])];
      const compIdList = sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `);
      const pairIdList = sql.join(allPairIds.map((id) => sql`${id}`), sql`, `);

      const t_wave2 = Date.now();
      const [catRankRows, rsCounts, simRows, velRows] = await Promise.all([
        // Category rankings
        db.execute(sql`
          WITH latest_snapshots AS (
            SELECT DISTINCT ON (category_id)
              category_id, app_count
            FROM category_snapshots
            ORDER BY category_id, scraped_at DESC
          )
          SELECT
            a.slug AS app_slug, sub.category_slug, c.title AS category_title,
            sub.position, sub.prev_position, cs.app_count
          FROM (
            SELECT
              r.app_id, r.category_slug, r.position,
              LAG(r.position) OVER (PARTITION BY r.app_id, r.category_slug ORDER BY r.scraped_at DESC) AS prev_position,
              ROW_NUMBER() OVER (PARTITION BY r.app_id, r.category_slug ORDER BY r.scraped_at DESC) AS rn
            FROM app_category_rankings r
            WHERE r.app_id IN (${compIdList})
          ) sub
          INNER JOIN apps a ON a.id = sub.app_id
          JOIN categories c ON c.slug = sub.category_slug AND c.platform = ${platform}
          LEFT JOIN latest_snapshots cs ON cs.category_id = c.id
          WHERE sub.rn = 1 AND c.is_listing_page = true AND sub.position > 0
        `).then((res: any) => ((res as any).rows ?? res) as any[]),
        // Reverse similar counts
        db.select({
          appSlug: apps.slug,
          count: sql<number>`count(distinct ${similarAppSightings.appId})::int`,
        })
          .from(similarAppSightings)
          .innerJoin(apps, eq(apps.id, similarAppSightings.similarAppId))
          .where(inArray(similarAppSightings.similarAppId, competitorAppIds))
          .groupBy(apps.slug),
        // Similarity scores
        db.execute(sql`
          SELECT a1.slug AS app_slug_a, a2.slug AS app_slug_b,
            s.overall_score, s.category_score, s.feature_score, s.keyword_score, s.text_score
          FROM app_similarity_scores s
          INNER JOIN apps a1 ON a1.id = s.app_id_a
          INNER JOIN apps a2 ON a2.id = s.app_id_b
          WHERE s.app_id_a IN (${pairIdList}) AND s.app_id_b IN (${pairIdList})
        `).then((res: any) => ((res as any).rows ?? res) as any[]).catch(() => [] as any[]),
        // Review velocity metrics
        db.execute(sql`
          SELECT DISTINCT ON (m.app_id)
            a.slug AS app_slug, m.v7d, m.v30d, m.v90d, m.momentum
          FROM app_review_metrics m
          INNER JOIN apps a ON a.id = m.app_id
          WHERE m.app_id IN (${compIdList})
          ORDER BY m.app_id, m.computed_at DESC
        `).then((res: any) => ((res as any).rows ?? res) as any[]).catch(() => [] as any[]),
      ]);

      mark("wave2_catrank_revsim_sim_vel", t_wave2);
      for (const r of catRankRows) {
        const arr = categoryRankingMap.get(r.app_slug) ?? [];
        arr.push({ categorySlug: r.category_slug, categoryTitle: r.category_title, position: r.position, prevPosition: r.prev_position ?? null, appCount: r.app_count ?? null });
        categoryRankingMap.set(r.app_slug, arr);
      }
      for (const r of rsCounts) reverseSimilarMap.set(r.appSlug, r.count);
      for (const r of simRows) {
        for (const [tracked, comp] of [[r.app_slug_a, r.app_slug_b], [r.app_slug_b, r.app_slug_a]]) {
          if (!similarityMap.has(tracked)) similarityMap.set(tracked, new Map());
          similarityMap.get(tracked)!.set(comp, { overall: r.overall_score, category: r.category_score, feature: r.feature_score, keyword: r.keyword_score, text: r.text_score });
        }
      }
      for (const r of velRows) velocityMap.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
    }

    // Run visibility, power scores, snapshots, and changes all in parallel
    const visibilityMap = new Map<string, { visibilityScore: number; keywordCount: number; visibilityRaw: number }>();
    const weightedPowerMap = new Map<string, number>();
    const powerCategoriesMap = new Map<string, { title: string; powerScore: number; appCount: number; position: number | null; ratingScore: number; reviewScore: number; categoryScore: number; momentumScore: number }[]>();
    const compAppIdsForBatch = rows.map((r) => r._appId).filter((id): id is number => id != null);
    const compIdListForBatch = compAppIdsForBatch.length > 0 ? sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `) : null;

    const t_wave3 = Date.now();
    const [visRows, powRows, snapshotRows, changeRows] = await Promise.all([
      // Visibility scores
      (compIdListForBatch
        ? db.execute(sql`
            SELECT ta.slug AS tracked_app_slug, ca.slug AS app_slug,
                   v.visibility_score, v.keyword_count, v.visibility_raw
            FROM (
              SELECT DISTINCT ON (account_id, tracked_app_id, app_id)
                account_id, tracked_app_id, app_id, visibility_score, keyword_count, visibility_raw
              FROM app_visibility_scores
              WHERE account_id = ${accountId}
                AND app_id IN (${compIdListForBatch})
              ORDER BY account_id, tracked_app_id, app_id, computed_at DESC
            ) v
            INNER JOIN apps ta ON ta.id = v.tracked_app_id
            INNER JOIN apps ca ON ca.id = v.app_id
          `).then((res: any) => ((res as any).rows ?? res) as any[]).catch(() => [] as any[])
        : Promise.resolve([] as any[])
      ),
      // Power scores
      (compIdListForBatch
        ? db.execute(sql`
            WITH latest_power AS (
              SELECT DISTINCT ON (app_id, category_slug)
                app_id, category_slug, power_score, rating_score, review_score, category_score, momentum_score
              FROM app_power_scores
              WHERE app_id IN (${compIdListForBatch})
              ORDER BY app_id, category_slug, computed_at DESC
            ),
            latest_cat_snapshots AS (
              SELECT DISTINCT ON (category_id) category_id, app_count
              FROM category_snapshots ORDER BY category_id, scraped_at DESC
            ),
            latest_cat_rankings AS (
              SELECT DISTINCT ON (app_id, category_slug) app_id, category_slug, position
              FROM app_category_rankings
              WHERE app_id IN (${compIdListForBatch}) AND position IS NOT NULL
              ORDER BY app_id, category_slug, scraped_at DESC
            )
            SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                   cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
            FROM latest_power p
            INNER JOIN apps a ON a.id = p.app_id
            INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
            LEFT JOIN latest_cat_snapshots cs ON cs.category_id = c.id
            LEFT JOIN latest_cat_rankings rk ON rk.app_id = p.app_id AND rk.category_slug = p.category_slug
          `).then((res: any) => ((res as any).rows ?? res) as any[]).catch(() => [] as any[])
        : Promise.resolve([] as any[])
      ),
      // Snapshots
      (compAppIdsForBatch.length > 0
        ? db.execute(sql`
            SELECT DISTINCT ON (app_id)
              app_id, average_rating, rating_count, pricing, pricing_plans, categories
            FROM app_snapshots
            WHERE app_id = ANY(${sqlArray(compAppIdsForBatch)})
            ORDER BY app_id, scraped_at DESC
          `)
        : Promise.resolve([])
      ),
      // Changes
      (compAppIdsForBatch.length > 0
        ? db.execute(sql`
            SELECT afc.app_id, max(afc.detected_at) AS detected_at
            FROM app_field_changes afc
            WHERE afc.app_id = ANY(${sqlArray(compAppIdsForBatch)})
              AND NOT EXISTS (
                SELECT 1 FROM app_update_label_assignments ula
                JOIN app_update_labels aul ON aul.id = ula.label_id
                WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
              )
            GROUP BY afc.app_id
          `)
        : Promise.resolve([])
      ),
    ]);

    mark("wave3_vis_power_snap_changes", t_wave3);
    for (const r of visRows) {
      visibilityMap.set(`${r.tracked_app_slug}:${r.app_slug}`, {
        visibilityScore: r.visibility_score, keywordCount: r.keyword_count, visibilityRaw: parseFloat(String(r.visibility_raw)),
      });
    }
    const appPowerInputs = new Map<string, { powerScore: number; appCount: number }[]>();
    for (const r of powRows) {
      if (!appPowerInputs.has(r.app_slug)) appPowerInputs.set(r.app_slug, []);
      appPowerInputs.get(r.app_slug)!.push({ powerScore: r.power_score, appCount: r.app_count ?? 1 });
      if (!powerCategoriesMap.has(r.app_slug)) powerCategoriesMap.set(r.app_slug, []);
      powerCategoriesMap.get(r.app_slug)!.push({
        title: r.category_title || r.category_slug, powerScore: r.power_score, appCount: r.app_count ?? 1,
        position: r.rank_position ?? null, ratingScore: parseFloat(r.rating_score) || 0,
        reviewScore: parseFloat(r.review_score) || 0, categoryScore: parseFloat(r.category_score) || 0,
        momentumScore: parseFloat(r.momentum_score) || 0,
      });
    }
    for (const [appSlug, inputs] of appPowerInputs) {
      weightedPowerMap.set(appSlug, computeWeightedPowerScore(inputs));
    }

    const snapshotMap = new Map((snapshotRows as any[]).map((s: any) => [s.app_id, s]));
    const changeMap = new Map((changeRows as any[]).map((c: any) => [c.app_id, c.detected_at]));

    const result = rows.map((row) => {
      const snapshot = snapshotMap.get(row._appId) || null;
      const minPaidPrice = getMinPaidPrice(snapshot?.pricing_plans ?? snapshot?.pricingPlans);
      const cats = (snapshot?.categories as any[]) || [];

      return {
        ...row,
        latestSnapshot: snapshot ? {
          averageRating: snapshot.average_rating ?? snapshot.averageRating,
          ratingCount: snapshot.rating_count ?? snapshot.ratingCount,
          pricing: snapshot.pricing,
        } : null,
        minPaidPrice,
        lastChangeAt: changeMap.get(row._appId) || null,
        rankedKeywords: rankedKeywordMap.get(row.appSlug) ?? 0,
        adKeywords: adKeywordMap.get(row.appSlug) ?? 0,
        featuredSections: featuredCountMap.get(row.appSlug) ?? 0,
        reverseSimilarCount: reverseSimilarMap.get(row.appSlug) ?? 0,
        visibilityScore: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityScore ?? null,
        visibilityKeywordCount: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.keywordCount ?? null,
        visibilityRaw: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityRaw ?? null,
        weightedPowerScore: weightedPowerMap.get(row.appSlug) ?? null,
        powerCategories: powerCategoriesMap.get(row.appSlug) ?? [],
        categories: cats.map((c: any) => {
          const slug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
          return { type: c.type || "primary", title: c.title, slug };
        }),
        categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
        reviewVelocity: velocityMap.get(row.appSlug) ?? null,
        similarityScore: similarityMap.get(row.trackedAppSlug)?.get(row.appSlug) ?? null,
      };
    });

    if (debugSlow) {
      request.log.info(
        { accountId, platform, totalMs: Date.now() - t0, phases: phaseTimings, competitorCount: rows.length },
        "GET /api/account/competitors timing"
      );
    }

    return result;
  });

  // POST /api/account/competitors — add competitor (requires trackedAppSlug)
  app.post(
    "/competitors",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug, trackedAppSlug } = addCompetitorSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [trackedAppRow] = await db
        .select({ id: apps.id, name: apps.name })
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
          error: "Competitor apps limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform, name: apps.name })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
        });
      }

      // Prevent adding an account's own tracked app as a competitor
      const [selfTracked] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, existingApp.id)
          )
        )
        .limit(1);
      if (selfTracked) {
        return reply.code(400).send({
          error: "This app is already one of your tracked apps — it can't also be a competitor.",
          code: "APP_ALREADY_TRACKED_AS_SELF",
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

      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "competitor_added", "competitor", slug, { competitorSlug: slug, platform, trackedAppSlug, competitorName: existingApp.name, trackedAppName: trackedAppRow.name })).catch(() => {});
      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/competitors/:slug
  app.delete<{ Params: { slug: string } }>(
    "/competitors/:slug",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { trackedAppSlug } = request.query as {
        trackedAppSlug?: string;
      };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up competitor app ID from slug
      const [compAppRow] = await db
        .select({ id: apps.id, name: apps.name })
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
      let trackedAppName: string | null = null;
      if (trackedAppSlug) {
        const [trackedAppRow] = await db
          .select({ id: apps.id, name: apps.name })
          .from(apps)
          .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
          .limit(1);
        if (trackedAppRow) {
          whereConditions.push(
            eq(accountCompetitorApps.trackedAppId, trackedAppRow.id)
          );
          trackedAppName = trackedAppRow.name;
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

      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "competitor_removed", "competitor", slug, { competitorSlug: slug, platform, trackedAppSlug: trackedAppSlug || null, competitorName: compAppRow.name, trackedAppName })).catch(() => {});
      return { message: "Competitor removed" };
    }
  );

  // --- Per-app nested routes ---

  // GET /api/account/tracked-apps/:slug/competitors
  app.get<{ Params: { slug: string }; Querystring: { platform?: string; includeSelf?: string; includeChanges?: string } }>(
    "/tracked-apps/:slug/competitors",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
      const includeChanges = request.query.includeChanges === "true";

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
            const visRows: any[] = await db.execute(sql`
              SELECT ca.slug AS app_slug, v.visibility_score, v.keyword_count, v.visibility_raw
              FROM (
                SELECT DISTINCT ON (account_id, tracked_app_id, app_id)
                  account_id, tracked_app_id, app_id, visibility_score, keyword_count, visibility_raw
                FROM app_visibility_scores
                WHERE account_id = ${accountId}
                  AND tracked_app_id = ${visTrackedAppRow.id}
                  AND app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
                ORDER BY account_id, tracked_app_id, app_id, computed_at DESC
              ) v
              INNER JOIN apps ca ON ca.id = v.app_id
            `).then((res: any) => (res as any).rows ?? res);
            for (const r of visRows) {
              visibilityMap2.set(r.app_slug, {
                visibilityScore: r.visibility_score,
                keywordCount: r.keyword_count,
                visibilityRaw: parseFloat(String(r.visibility_raw)),
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
            WITH latest_power AS (
              SELECT DISTINCT ON (app_id, category_slug)
                app_id, category_slug, power_score, rating_score, review_score, category_score, momentum_score
              FROM app_power_scores
              WHERE app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
              ORDER BY app_id, category_slug, computed_at DESC
            ),
            latest_cat_snapshots AS (
              SELECT DISTINCT ON (category_id)
                category_id, app_count
              FROM category_snapshots
              ORDER BY category_id, scraped_at DESC
            ),
            latest_cat_rankings AS (
              SELECT DISTINCT ON (app_id, category_slug)
                app_id, category_slug, position
              FROM app_category_rankings
              WHERE app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
                AND position IS NOT NULL
              ORDER BY app_id, category_slug, scraped_at DESC
            )
            SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                   cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
            FROM latest_power p
            INNER JOIN apps a ON a.id = p.app_id
            INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
            LEFT JOIN latest_cat_snapshots cs ON cs.category_id = c.id
            LEFT JOIN latest_cat_rankings rk ON rk.app_id = p.app_id AND rk.category_slug = p.category_slug
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

      // Batch-fetch recent changes for each competitor (when includeChanges=true)
      const changesMap = new Map<string, any[]>();
      if (includeChanges && competitorAppIds.length > 0) {
        const changeRows = await db.execute(sql`
          SELECT c.*, a.slug AS app_slug
          FROM (
            SELECT afc.*, ROW_NUMBER() OVER (PARTITION BY afc.app_id ORDER BY afc.detected_at DESC) AS rn
            FROM app_field_changes afc
            WHERE afc.app_id = ANY(${sqlArray(competitorAppIds)})
              AND NOT EXISTS (
                SELECT 1 FROM app_update_label_assignments ula
                JOIN app_update_labels aul ON aul.id = ula.label_id
                WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
              )
          ) c
          INNER JOIN apps a ON a.id = c.app_id
          WHERE c.rn <= 3
          ORDER BY c.detected_at DESC
        `);
        const changeData: any[] = (changeRows as any).rows ?? changeRows;
        for (const r of changeData) {
          const list = changesMap.get(r.app_slug) ?? [];
          list.push({
            id: r.id,
            appId: r.app_id,
            fieldName: r.field_name,
            oldValue: r.old_value,
            newValue: r.new_value,
            detectedAt: r.detected_at,
          });
          changesMap.set(r.app_slug, list);
        }
      }

      // Batch-fetch latest snapshot per competitor (replaces N+1 per-competitor queries)
      const compSnapshotMap = new Map<number, { averageRating: number | null; ratingCount: number | null; pricing: string | null; pricingPlans: any; categories: any }>();
      if (competitorAppIds.length > 0) {
        const snapRows: any[] = await db.execute(sql`
          SELECT DISTINCT ON (app_id)
            app_id, average_rating, rating_count, pricing, pricing_plans, categories
          FROM app_snapshots
          WHERE app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
          ORDER BY app_id, scraped_at DESC
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of snapRows) {
          compSnapshotMap.set(r.app_id, {
            averageRating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count,
            pricing: r.pricing,
            pricingPlans: r.pricing_plans,
            categories: r.categories,
          });
        }
      }

      // Batch-fetch last change date per competitor (replaces N+1 per-competitor queries)
      const lastChangeMap = new Map<number, string | null>();
      if (competitorAppIds.length > 0) {
        const changeRows: any[] = await db.execute(sql`
          SELECT afc.app_id, max(afc.detected_at) AS detected_at
          FROM app_field_changes afc
          WHERE afc.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
            AND NOT EXISTS (
              SELECT 1 FROM app_update_label_assignments ula
              JOIN app_update_labels aul ON aul.id = ula.label_id
              WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
            )
          GROUP BY afc.app_id
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of changeRows) {
          lastChangeMap.set(r.app_id, r.detected_at);
        }
      }

      const result = allRows.map((row) => {
        const snapshot = compSnapshotMap.get((row as any)._appId) || null;
        const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
        const { pricingPlans: _, categories: cats, ...snapshotRest } = snapshot || ({} as any);
        const appCategories = (cats as any[]) || [];

        return {
          ...row,
          latestSnapshot: snapshot ? snapshotRest : null,
          minPaidPrice,
          lastChangeAt: lastChangeMap.get((row as any)._appId) || null,
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
          ...(includeChanges ? { recentChanges: changesMap.get(row.appSlug) ?? [] } : {}),
        };
      });

      return result;
    }
  );

  // POST /api/account/tracked-apps/:slug/competitors
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { slug: competitorSlug } = addTrackedAppSchema.parse(request.body);

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [trackedAppRow2] = await db
        .select({ id: apps.id, name: apps.name })
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
          error: "Competitor apps limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform, name: apps.name })
        .from(apps)
        .where(and(eq(apps.slug, competitorSlug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
        });
      }

      // Prevent adding an account's own tracked app as a competitor
      const [selfTracked2] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appId, existingApp.id)
          )
        )
        .limit(1);
      if (selfTracked2) {
        return reply.code(400).send({
          error: "This app is already one of your tracked apps — it can't also be a competitor.",
          code: "APP_ALREADY_TRACKED_AS_SELF",
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

      await invalidatePlatformStats(accountId, platform);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "competitor_added", "competitor", competitorSlug, { competitorSlug, platform, trackedAppSlug, competitorName: existingApp.name, trackedAppName: trackedAppRow2.name })).catch(() => {});
      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug/competitors/:competitorSlug
  app.delete<{ Params: { slug: string; competitorSlug: string } }>(
    "/tracked-apps/:slug/competitors/:competitorSlug",
    { preHandler: [requireRole("owner", "admin", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const competitorSlug = decodeURIComponent(
        request.params.competitorSlug
      );
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [delTrackedAppRow] = await db
        .select({ id: apps.id, name: apps.name })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      const [delCompAppRow] = await db
        .select({ id: apps.id, name: apps.name })
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

      await invalidatePlatformStats(accountId, platform);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "competitor_removed", "competitor", competitorSlug, { competitorSlug, platform: getPlatformFromQuery(request.query as Record<string, unknown>), trackedAppSlug, competitorName: delCompAppRow.name, trackedAppName: delTrackedAppRow.name })).catch(() => {});
      return { message: "Competitor removed" };
    }
  );

  // PATCH /api/account/tracked-apps/:slug/competitors/reorder
  app.patch<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors/reorder",
    { preHandler: [requireRole("owner", "admin", "editor")] },
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

      // Extract keyword IDs for batch operations
      const keywordIds = rows.map((r) => r.keywordId);

      // Batch-fetch latest snapshot per keyword (replaces N+1 per-keyword queries)
      const snapshotMap = new Map<number, { totalResults: number | null; scrapedAt: Date | null }>();
      if (keywordIds.length > 0) {
        const snapRows: any[] = await db.execute(sql`
          SELECT DISTINCT ON (keyword_id)
            keyword_id, total_results, scraped_at
          FROM keyword_snapshots
          WHERE keyword_id IN (${sql.join(keywordIds.map((id: number) => sql`${id}`), sql`, `)})
          ORDER BY keyword_id, scraped_at DESC
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of snapRows) {
          snapshotMap.set(r.keyword_id, { totalResults: r.total_results, scrapedAt: r.scraped_at });
        }
      }
      const result = rows.map((row) => ({
        ...row,
        latestSnapshot: snapshotMap.get(row.keywordId) || null,
      }));

      // Batch-fetch tags for all keywords
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
    { preHandler: [requireRole("owner", "admin", "editor")] },
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
          error: "Tracked keywords limit reached", code: "PLAN_LIMIT_REACHED", upgradeUrl: "/pricing",
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
    { preHandler: [requireRole("owner", "admin", "editor")] },
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

      await invalidatePlatformStats(accountId);
      import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, "keyword_untracked", "keyword", String(keywordId), { keywordId })).catch(() => {});
      return { message: "Keyword removed from tracking" };
    }
  );

  // GET /api/account/tracked-apps/:slug/keyword-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/keyword-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = String(PAGINATION_DEFAULT_LIMIT), debug = "false", source = "all" } = request.query as {
        limit?: string;
        debug?: string;
        source?: string;
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

      // Check AI cache status
      const [aiCache] = await db
        .select()
        .from(aiKeywordSuggestions)
        .where(
          and(
            eq(aiKeywordSuggestions.accountId, accountId),
            eq(aiKeywordSuggestions.appId, appRow.id)
          )
        )
        .limit(1);

      const now = new Date();
      const aiStatus = !aiCache
        ? "not_generated"
        : aiCache.status === "generating"
          ? "generating"
          : aiCache.status === "success" && aiCache.expiresAt && aiCache.expiresAt > now
            ? "available"
            : aiCache.status === "success"
              ? "expired"
              : "error";

      // For "ai" source, return AI-only results from cache
      if (source === "ai") {
        if (aiStatus !== "available") {
          return { suggestions: [], aiStatus, aiGeneratedAt: aiCache?.generatedAt ?? null };
        }
        const mergedKws = (aiCache!.mergedKeywords as any[]) || [];
        return {
          suggestions: mergedKws.slice(0, maxResults).map((k: any) => ({
            keyword: k.keyword,
            score: k.score,
            tier: k.tier,
            rationale: k.rationale,
            source: k.source,
            competitiveness: k.competitiveness,
            searchIntent: k.searchIntent,
            fromAI: k.fromAI,
            fromNgram: k.fromNgram,
            tracked: trackedSet.has(k.keyword.toLowerCase()),
          })),
          aiStatus,
          aiGeneratedAt: aiCache!.generatedAt,
        };
      }

      // Extract n-gram keyword suggestions
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

      // For "all" source with available AI cache, return AI merged results
      if (source === "all" && aiStatus === "available") {
        const mergedKws = (aiCache!.mergedKeywords as any[]) || [];
        return {
          suggestions: mergedKws.slice(0, maxResults).map((k: any) => ({
            keyword: k.keyword,
            score: k.score,
            tier: k.tier,
            rationale: k.rationale,
            source: k.source,
            competitiveness: k.competitiveness,
            searchIntent: k.searchIntent,
            fromAI: k.fromAI,
            fromNgram: k.fromNgram,
            tracked: trackedSet.has(k.keyword.toLowerCase()),
          })),
          aiStatus,
          aiGeneratedAt: aiCache!.generatedAt,
        };
      }

      // Default: n-gram results (source=ngram or source=all without AI cache)
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
        aiStatus,
        aiGeneratedAt: aiCache?.generatedAt ?? null,
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

  // POST /api/account/tracked-apps/:slug/ai-keyword-suggestions/generate
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/ai-keyword-suggestions/generate",
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.code(503).send({ error: "AI service not configured" });
      }

      // Look up app
      const [appRow] = await db
        .select({ id: apps.id, name: apps.name, subtitle: apps.appCardSubtitle })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!appRow) return reply.code(404).send({ error: "App not found" });

      // Verify tracked
      const [tracked] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(and(eq(accountTrackedApps.accountId, accountId), eq(accountTrackedApps.appId, appRow.id)))
        .limit(1);
      if (!tracked) return reply.code(404).send({ error: "App not tracked" });

      // Check existing cache — return if still valid
      const [existing] = await db
        .select()
        .from(aiKeywordSuggestions)
        .where(and(eq(aiKeywordSuggestions.accountId, accountId), eq(aiKeywordSuggestions.appId, appRow.id)))
        .limit(1);

      const now = new Date();
      if (existing?.status === "success" && existing.expiresAt && existing.expiresAt > now) {
        return { cached: true, ...formatAiKeywordResult(existing) };
      }
      if (existing?.status === "generating") {
        return reply.code(409).send({ error: "Generation already in progress" });
      }

      // Mark as generating
      if (existing) {
        await db.update(aiKeywordSuggestions)
          .set({ status: "generating", errorMessage: null })
          .where(eq(aiKeywordSuggestions.id, existing.id));
      } else {
        await db.insert(aiKeywordSuggestions).values({
          accountId, appId: appRow.id, platform, status: "generating",
        }).onConflictDoNothing();
      }

      try {
        // Collect context data
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

        const trackedKws = await db
          .select({ keyword: trackedKeywords.keyword })
          .from(accountTrackedKeywords)
          .innerJoin(trackedKeywords, eq(trackedKeywords.id, accountTrackedKeywords.keywordId))
          .where(and(eq(accountTrackedKeywords.accountId, accountId), eq(accountTrackedKeywords.trackedAppId, appRow.id)));

        // N-gram top 20
        const { extractKeywordsFromAppMetadata } = await import("@appranks/shared");
        const ngramAll = extractKeywordsFromAppMetadata({
          name: appRow.name ?? "",
          subtitle: appRow.subtitle,
          introduction: snapshot?.appIntroduction ?? null,
          description: snapshot?.appDetails ?? null,
          features: (snapshot?.features as string[]) ?? [],
          categories: (snapshot?.categories as any[]) ?? [],
        });
        const ngramTop20: NgramKeyword[] = ngramAll.slice(0, 20).map((s: any) => ({
          keyword: s.keyword,
          score: s.score,
        }));

        const categoryNames = ((snapshot?.categories as any[]) ?? []).map((c: any) => c.title || c.name || c).filter(Boolean);

        // Call AI
        const openaiClient = new OpenAI({ apiKey }) as unknown as AIClient;
        const { response: aiResponse, aiResult } = await generateKeywordSuggestions({
          client: openaiClient,
          input: {
            name: appRow.name ?? "",
            subtitle: appRow.subtitle,
            introduction: snapshot?.appIntroduction ?? null,
            description: snapshot?.appDetails ?? null,
            features: (snapshot?.features as string[]) ?? [],
            categories: categoryNames,
            platform,
            existingKeywords: trackedKws.map(k => k.keyword),
            ngramTopKeywords: ngramTop20,
          },
        });

        // Merge AI + n-gram
        const merged = mergeKeywords(aiResponse.keywords, ngramTop20, 50);

        // Log to ai_logs
        await logAICall(db, aiLogs, {
          accountId, userId, platform,
          productType: "ai_keyword_suggestions",
          productId: String(appRow.id),
          model: aiResult.model,
          systemPrompt: "[keyword-suggestion-engine]",
          userPrompt: `App: ${appRow.name} (${slug})`,
          responseContent: aiResult.content,
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          totalTokens: aiResult.totalTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          status: "success",
          triggerType: "manual",
        });

        // Update cache
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const cacheData = {
          platform,
          appSummary: aiResponse.appSummary,
          primaryCategory: aiResponse.primaryCategory,
          targetAudience: aiResponse.targetAudience,
          keywords: aiResponse.keywords,
          ngramKeywords: ngramTop20,
          mergedKeywords: merged,
          model: aiResult.model,
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          status: "success" as const,
          errorMessage: null,
          generatedAt: now,
          expiresAt,
        };

        await db.insert(aiKeywordSuggestions)
          .values({ accountId, appId: appRow.id, ...cacheData })
          .onConflictDoUpdate({
            target: [aiKeywordSuggestions.accountId, aiKeywordSuggestions.appId],
            set: cacheData,
          });

        return {
          cached: false,
          appSummary: aiResponse.appSummary,
          primaryCategory: aiResponse.primaryCategory,
          targetAudience: aiResponse.targetAudience,
          keywords: merged,
          aiKeywordCount: aiResponse.keywords.length,
          ngramKeywordCount: ngramTop20.length,
          mergedCount: merged.length,
          model: aiResult.model,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          generatedAt: now,
          expiresAt,
        };
      } catch (err: any) {
        // Update cache status to error
        await db.update(aiKeywordSuggestions)
          .set({ status: "error", errorMessage: err?.message || String(err) })
          .where(and(eq(aiKeywordSuggestions.accountId, accountId), eq(aiKeywordSuggestions.appId, appRow.id)));

        const { isRateLimit, isQuota } = isRateLimitOrQuota(err);
        if (isRateLimit || isQuota) {
          return reply.code(429).send({
            error: isQuota ? "AI quota exceeded" : "AI service busy, try again",
          });
        }
        request.log.error(err, "AI keyword generation failed");
        return reply.code(502).send({ error: "AI generation failed" });
      }
    }
  );

  // GET /api/account/tracked-apps/:slug/competitor-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitor-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = "20", source = "all" } = request.query as { limit?: string; source?: string };
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

      // Check AI cache status
      const [aiCompCache] = await db
        .select()
        .from(aiCompetitorSuggestions)
        .where(and(eq(aiCompetitorSuggestions.accountId, accountId), eq(aiCompetitorSuggestions.appId, compSugAppRow.id)))
        .limit(1);

      const compNow = new Date();
      const compAiStatus = !aiCompCache
        ? "not_generated"
        : aiCompCache.status === "generating"
          ? "generating"
          : aiCompCache.status === "success" && aiCompCache.expiresAt && aiCompCache.expiresAt > compNow
            ? "available"
            : aiCompCache.status === "success"
              ? "expired"
              : "error";

      // For "ai" source, return AI-only results from cache
      if (source === "ai") {
        if (compAiStatus !== "available") {
          return { suggestions: [], aiStatus: compAiStatus, aiGeneratedAt: aiCompCache?.generatedAt ?? null };
        }
        const mergedComps = (aiCompCache!.mergedCompetitors as any[]) || [];
        return {
          suggestions: mergedComps.slice(0, maxResults),
          aiStatus: compAiStatus,
          aiGeneratedAt: aiCompCache!.generatedAt,
        };
      }

      // For "all" with available AI cache, return merged AI results
      if (source === "all" && compAiStatus === "available") {
        const mergedComps = (aiCompCache!.mergedCompetitors as any[]) || [];
        return {
          suggestions: mergedComps.slice(0, maxResults),
          aiStatus: compAiStatus,
          aiGeneratedAt: aiCompCache!.generatedAt,
        };
      }

      // Default: Jaccard results
      return {
        suggestions: suggestions.slice(0, maxResults),
        aiStatus: compAiStatus,
        aiGeneratedAt: aiCompCache?.generatedAt ?? null,
      };
    }
  );

  // POST /api/account/tracked-apps/:slug/ai-competitor-suggestions/generate
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/ai-competitor-suggestions/generate",
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return reply.code(503).send({ error: "AI service not configured" });

      // Look up app
      const [appRow] = await db
        .select({ id: apps.id, name: apps.name, subtitle: apps.appCardSubtitle })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);
      if (!appRow) return reply.code(404).send({ error: "App not found" });

      // Verify tracked
      const [tracked] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(and(eq(accountTrackedApps.accountId, accountId), eq(accountTrackedApps.appId, appRow.id)))
        .limit(1);
      if (!tracked) return reply.code(404).send({ error: "App not tracked" });

      // Check existing cache
      const [existing] = await db
        .select()
        .from(aiCompetitorSuggestions)
        .where(and(eq(aiCompetitorSuggestions.accountId, accountId), eq(aiCompetitorSuggestions.appId, appRow.id)))
        .limit(1);

      const now = new Date();
      if (existing?.status === "success" && existing.expiresAt && existing.expiresAt > now) {
        return { cached: true, ...formatAiCompetitorResult(existing) };
      }
      if (existing?.status === "generating") {
        return reply.code(409).send({ error: "Generation already in progress" });
      }

      // Mark as generating
      if (existing) {
        await db.update(aiCompetitorSuggestions)
          .set({ status: "generating", errorMessage: null })
          .where(eq(aiCompetitorSuggestions.id, existing.id));
      } else {
        await db.insert(aiCompetitorSuggestions).values({
          accountId, appId: appRow.id, platform, status: "generating",
        }).onConflictDoNothing();
      }

      try {
        // Get app snapshot
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

        const categoryNames = ((snapshot?.categories as any[]) ?? [])
          .map((c: any) => c.title || c.name || c).filter(Boolean);

        // Get Jaccard top candidates using existing category ranking logic
        const catRows: any[] = await db
          .execute(sql`
            SELECT DISTINCT ON (category_slug) category_slug
            FROM app_category_rankings WHERE app_id = ${appRow.id}
            ORDER BY category_slug, scraped_at DESC
          `).then((res: any) => (res as any).rows ?? res);

        const catSlugs = catRows.map((r: any) => r.category_slug as string);

        let candidates: CompetitorCandidate[] = [];
        if (catSlugs.length > 0) {
          const catSlugList = sql.join(catSlugs.map(s => sql`${s}`), sql`, `);
          const candidateRows: any[] = await db
            .execute(sql`
              WITH latest AS (
                SELECT DISTINCT ON (r.app_id) a.slug, a.name, a.app_card_subtitle, a.pricing_hint, a.average_rating, a.rating_count
                FROM app_category_rankings r
                INNER JOIN apps a ON a.id = r.app_id
                WHERE r.category_slug IN (${catSlugList}) AND r.app_id != ${appRow.id} AND a.platform = ${platform}
                ORDER BY r.app_id, r.scraped_at DESC
              )
              SELECT * FROM latest LIMIT 48
            `).then((res: any) => (res as any).rows ?? res);

          candidates = candidateRows.map((r: any) => ({
            slug: r.slug,
            name: r.name,
            subtitle: r.app_card_subtitle,
            pricingHint: r.pricing_hint,
            rating: r.average_rating ? parseFloat(r.average_rating) : null,
            ratingCount: r.rating_count ? Number(r.rating_count) : null,
            categories: categoryNames, // approximate
          }));
        }

        const filtered = preFilterCandidates(candidates);

        // Call AI
        const openaiClient = new OpenAI({ apiKey }) as unknown as AIClient;
        const { response: aiResponse, aiResult } = await generateCompetitorSuggestions({
          client: openaiClient,
          input: {
            app: {
              name: appRow.name ?? "",
              slug,
              subtitle: appRow.subtitle,
              introduction: snapshot?.appIntroduction ?? null,
              description: snapshot?.appDetails ?? null,
              features: (snapshot?.features as string[]) ?? [],
              categories: categoryNames,
              pricingHint: null,
            },
            candidates: filtered,
            platform,
          },
        });

        // Build Jaccard scores from candidates (approximate using position)
        const jaccardScores: JaccardScore[] = candidates.map((c, i) => ({
          slug: c.slug,
          overall: Math.max(0, 1 - (i / candidates.length)),
        }));

        // Merge AI + Jaccard
        const merged = mergeCompetitorScores(aiResponse.competitors, jaccardScores, 25);

        // Log to ai_logs
        await logAICall(db, aiLogs, {
          accountId, userId, platform,
          productType: "ai_competitor_suggestions",
          productId: String(appRow.id),
          model: aiResult.model,
          systemPrompt: "[competitor-suggestion-engine]",
          userPrompt: `App: ${appRow.name} (${slug}), ${filtered.length} candidates`,
          responseContent: aiResult.content,
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          totalTokens: aiResult.totalTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          status: "success",
          triggerType: "manual",
        });

        // Update cache
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const cacheData = {
          platform,
          appSummary: aiResponse.appSummary,
          marketContext: aiResponse.marketContext,
          competitors: aiResponse.competitors,
          jaccardCompetitors: jaccardScores,
          mergedCompetitors: merged,
          model: aiResult.model,
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          status: "success" as const,
          errorMessage: null,
          generatedAt: now,
          expiresAt,
        };

        await db.insert(aiCompetitorSuggestions)
          .values({ accountId, appId: appRow.id, ...cacheData })
          .onConflictDoUpdate({
            target: [aiCompetitorSuggestions.accountId, aiCompetitorSuggestions.appId],
            set: cacheData,
          });

        return {
          cached: false,
          appSummary: aiResponse.appSummary,
          marketContext: aiResponse.marketContext,
          competitors: merged,
          aiCompetitorCount: aiResponse.competitors.length,
          mergedCount: merged.length,
          model: aiResult.model,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          generatedAt: now,
          expiresAt,
        };
      } catch (err: any) {
        await db.update(aiCompetitorSuggestions)
          .set({ status: "error", errorMessage: err?.message || String(err) })
          .where(and(eq(aiCompetitorSuggestions.accountId, accountId), eq(aiCompetitorSuggestions.appId, appRow.id)));

        const { isRateLimit, isQuota } = isRateLimitOrQuota(err);
        if (isRateLimit || isQuota) {
          return reply.code(429).send({ error: isQuota ? "AI quota exceeded" : "AI service busy, try again" });
        }
        request.log.error(err, "AI competitor generation failed");
        return reply.code(502).send({ error: "AI generation failed" });
      }
    }
  );
};

function formatAiCompetitorResult(row: any) {
  return {
    appSummary: row.appSummary,
    marketContext: row.marketContext,
    competitors: row.mergedCompetitors || [],
    aiCompetitorCount: (row.competitors as any[])?.length ?? 0,
    mergedCount: (row.mergedCompetitors as any[])?.length ?? 0,
    model: row.model,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    generatedAt: row.generatedAt,
    expiresAt: row.expiresAt,
  };
}

function formatAiKeywordResult(row: any) {
  return {
    appSummary: row.appSummary,
    primaryCategory: row.primaryCategory,
    targetAudience: row.targetAudience,
    keywords: row.mergedKeywords || [],
    aiKeywordCount: (row.keywords as any[])?.length ?? 0,
    ngramKeywordCount: (row.ngramKeywords as any[])?.length ?? 0,
    mergedCount: (row.mergedKeywords as any[])?.length ?? 0,
    model: row.model,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    generatedAt: row.generatedAt,
    expiresAt: row.expiresAt,
  };
}
