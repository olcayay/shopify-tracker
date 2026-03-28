import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { getPlatformFromQuery } from "../utils/platform.js";
import {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
  keywordAdSightings,
  keywordAutoSuggestions,
  keywordTags,
  keywordTagAssignments,
  apps,
  appSnapshots,
  accountTrackedKeywords,
  accountTrackedApps,
  accountCompetitorApps,
  keywordToSlug,
  researchProjects,
  researchProjectKeywords,
} from "@appranks/db";
import { computeKeywordOpportunity } from "@appranks/shared";
import type { KeywordSearchApp } from "@appranks/shared";
import { ensureKeywordSchema, opportunitySchema } from "../schemas/keywords.js";
import { Queue } from "bullmq";


const INTERACTIVE_QUEUE_NAME =
  process.env.INTERACTIVE_QUEUE_NAME || "scraper-jobs-interactive";
let scraperQueue: Queue | null = null;

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}

function getScraperQueue(): Queue {
  if (!scraperQueue) {
    scraperQueue = new Queue(INTERACTIVE_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scraperQueue;
}

export const keywordRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/keywords — list account's tracked keywords
  app.get("/", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const trackedRows = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        trackedAppSlug: apps.slug,
      })
      .from(accountTrackedKeywords)
      .innerJoin(apps, eq(apps.id, accountTrackedKeywords.trackedAppId))
      .where(eq(accountTrackedKeywords.accountId, accountId));

    if (trackedRows.length === 0) {
      return [];
    }

    // Build trackedForApps map: keywordId -> trackedAppSlug[]
    const trackedForAppsMap = new Map<number, string[]>();
    for (const row of trackedRows) {
      const existing = trackedForAppsMap.get(row.keywordId) || [];
      if (!existing.includes(row.trackedAppSlug)) {
        existing.push(row.trackedAppSlug);
      }
      trackedForAppsMap.set(row.keywordId, existing);
    }

    // Get account's tracked apps and competitors for matching
    const [trackedAppRows, competitorRows] = await Promise.all([
      db
        .select({ appSlug: apps.slug })
        .from(accountTrackedApps)
        .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
        .where(eq(accountTrackedApps.accountId, accountId)),
      db
        .select({ appSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSlugs = trackedAppRows.map((r) => r.appSlug);
    const competitorSlugs = [...new Set(competitorRows.map((r) => r.appSlug))];

    const ids = [...new Set(trackedRows.map((r) => r.keywordId))];
    const rows = await db
      .select()
      .from(trackedKeywords)
      .where(and(inArray(trackedKeywords.id, ids), eq(trackedKeywords.platform, platform)))
      .orderBy(trackedKeywords.keyword);

    // Batch-fetch ad app counts per keyword (last 30 days)
    const adSince = new Date();
    adSince.setDate(adSince.getDate() - 30);
    const adSinceStr = adSince.toISOString().slice(0, 10);

    const adAppCountMap = new Map<number, number>();
    if (ids.length > 0) {
      const adAppCounts = await db
        .select({
          keywordId: keywordAdSightings.keywordId,
          appCount: sql<number>`count(distinct ${keywordAdSightings.appId})`,
        })
        .from(keywordAdSightings)
        .where(
          and(
            inArray(keywordAdSightings.keywordId, ids),
            sql`${keywordAdSightings.seenDate} >= ${adSinceStr}`
          )
        )
        .groupBy(keywordAdSightings.keywordId);

      for (const ac of adAppCounts) {
        adAppCountMap.set(ac.keywordId, ac.appCount);
      }
    }

    // Batch-fetch tags for all keywords
    const tagMap = new Map<
      number,
      Array<{ id: string; name: string; color: string }>
    >();
    if (ids.length > 0) {
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
            inArray(keywordTagAssignments.keywordId, ids)
          )
        );
      for (const tr of tagRows) {
        const list = tagMap.get(tr.keywordId) || [];
        list.push({ id: tr.tagId, name: tr.tagName, color: tr.tagColor });
        tagMap.set(tr.keywordId, list);
      }
    }

    // Batch-fetch latest snapshots for all keywords (avoids N+1 queries)
    const snapshotMap = new Map<number, { totalResults: number | null; scrapedAt: Date; appCount: number; results: unknown }>();
    if (ids.length > 0) {
      const latestSnapshots = await db.execute(sql`
        SELECT DISTINCT ON (keyword_id)
          keyword_id,
          total_results,
          scraped_at,
          jsonb_array_length(results)::int AS app_count,
          results
        FROM keyword_snapshots
        WHERE keyword_id = ANY(${ids})
        ORDER BY keyword_id, scraped_at DESC
      `);
      const snapRows = (latestSnapshots as any).rows ?? latestSnapshots;
      for (const row of snapRows) {
        snapshotMap.set(row.keyword_id, {
          totalResults: row.total_results,
          scrapedAt: row.scraped_at,
          appCount: row.app_count,
          results: row.results,
        });
      }
    }

    const result = rows.map((kw) => {
      const snapshot = snapshotMap.get(kw.id);

      const trackedAppsInResults: { app_slug: string; app_name: string; position: number; logo_url?: string }[] = [];
      const competitorAppsInResults: { app_slug: string; app_name: string; position: number; logo_url?: string }[] = [];
      if (snapshot?.results) {
        for (const app of snapshot.results as any[]) {
          if (trackedSlugs.includes(app.app_slug)) {
            trackedAppsInResults.push({
              app_slug: app.app_slug,
              app_name: app.app_name,
              position: app.position || 0,
              logo_url: app.logo_url,
            });
          }
          if (competitorSlugs.includes(app.app_slug)) {
            competitorAppsInResults.push({
              app_slug: app.app_slug,
              app_name: app.app_name,
              position: app.position || 0,
              logo_url: app.logo_url,
            });
          }
        }
      }

      const snapshotWithoutResults = snapshot
        ? { totalResults: snapshot.totalResults, scrapedAt: snapshot.scrapedAt, appCount: snapshot.appCount }
        : null;

      return {
        ...kw,
        latestSnapshot: snapshotWithoutResults,
        trackedForApps: trackedForAppsMap.get(kw.id) || [],
        trackedInResults: trackedAppsInResults.length,
        competitorInResults: competitorAppsInResults.length,
        trackedAppsInResults,
        competitorAppsInResults,
        adApps: adAppCountMap.get(kw.id) ?? 0,
        tags: tagMap.get(kw.id) || [],
      };
    });

    return result;
  });

  // GET /api/keywords/search?q= — search all keywords by prefix
  // POST /api/keywords/ensure — ensure keyword exists globally + trigger scraping if needed
  app.post<{ Body: { keyword: string } }>("/ensure", async (request, reply) => {
    const { keyword } = ensureKeywordSchema.parse(request.body);

    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const slug = keywordToSlug(keyword.trim());
    const [kw] = await db
      .insert(trackedKeywords)
      .values({ keyword: keyword.trim().toLowerCase(), slug, platform })
      .onConflictDoUpdate({
        target: [trackedKeywords.platform, trackedKeywords.keyword],
        set: { isActive: true, updatedAt: new Date() },
      })
      .returning();

    let scraperEnqueued = false;
    const [existingSnapshot] = await db
      .select({ id: keywordSnapshots.id })
      .from(keywordSnapshots)
      .where(eq(keywordSnapshots.keywordId, kw.id))
      .limit(1);

    if (!existingSnapshot) {
      try {
        const queue = getScraperQueue();
        await queue.add("scrape:keyword_search", {
          type: "keyword_search",
          keyword: kw.keyword,
          platform,
          triggeredBy: "api:ensure",
          requestId: request.id,
        });
        scraperEnqueued = true;
      } catch {
        // Redis unavailable
      }
    }

    return { slug: kw.slug, keywordId: kw.id, scraperEnqueued };
  });

  app.get("/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    if (q.length < 1) return [];

    const rows = await db
      .select({
        id: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        slug: trackedKeywords.slug,
      })
      .from(trackedKeywords)
      .where(and(ilike(trackedKeywords.keyword, `${q}%`), eq(trackedKeywords.platform, platform)))
      .orderBy(trackedKeywords.keyword)
      .limit(20);

    return rows;
  });

  // GET /api/keywords/:slug — keyword detail + latest snapshot + track status
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const [kw] = await db
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
      .limit(1);

    if (!kw) {
      return reply.code(404).send({ error: "Keyword not found" });
    }

    const [latestSnapshot, previousSnapshot] = await db
      .select()
      .from(keywordSnapshots)
      .where(eq(keywordSnapshots.keywordId, kw.id))
      .orderBy(desc(keywordSnapshots.scrapedAt))
      .limit(2);

    const trackedRows = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        trackedAppSlug: apps.slug,
      })
      .from(accountTrackedKeywords)
      .innerJoin(apps, eq(apps.id, accountTrackedKeywords.trackedAppId))
      .where(
        and(
          eq(accountTrackedKeywords.accountId, accountId),
          eq(accountTrackedKeywords.keywordId, kw.id)
        )
      );

    // Build position change map from previous snapshot
    let positionChanges: Record<string, number> | null = null;
    if (latestSnapshot && previousSnapshot) {
      const prevPositions = new Map<string, number>();
      for (const app of (previousSnapshot.results as any[]) || []) {
        if (!app.is_sponsored && !app.is_built_in && app.position) {
          prevPositions.set(app.app_slug, app.position);
        }
      }
      positionChanges = {};
      for (const app of (latestSnapshot.results as any[]) || []) {
        if (!app.is_sponsored && !app.is_built_in && app.position) {
          const prev = prevPositions.get(app.app_slug);
          if (prev !== undefined) {
            positionChanges[app.app_slug] = prev - app.position;
          }
        }
      }
    }

    // Enrich snapshot results with BFS flag from apps table
    let enrichedSnapshot = latestSnapshot || null;
    if (enrichedSnapshot?.results && (enrichedSnapshot.results as any[]).length > 0) {
      const resultSlugs = (enrichedSnapshot.results as any[])
        .map((a: any) => a.app_slug)
        .filter((s: string) => s && !s.startsWith("bif:"));
      if (resultSlugs.length > 0) {
        const bfsRows = await db
          .select({ slug: apps.slug, isBuiltForShopify: apps.isBuiltForShopify })
          .from(apps)
          .where(and(inArray(apps.slug, resultSlugs), eq(apps.isBuiltForShopify, true)));
        const bfsSet = new Set(bfsRows.map((r) => r.slug));
        enrichedSnapshot = {
          ...enrichedSnapshot,
          results: (enrichedSnapshot.results as any[]).map((a: any) => ({
            ...a,
            is_built_for_shopify: a.is_built_for_shopify || bfsSet.has(a.app_slug),
          })),
        };
      }
    }

    return {
      ...kw,
      latestSnapshot: enrichedSnapshot,
      positionChanges,
      isTrackedByAccount: trackedRows.length > 0,
      trackedForApps: trackedRows.map((r) => r.trackedAppSlug),
    };
  });

  // GET /api/keywords/:slug/rankings
  // ?days=30&appSlug=xxx&scope=account (filter to tracked+competitor apps)
  app.get<{ Params: { slug: string } }>(
    "/:slug/rankings",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30", appSlug, scope } = request.query as {
        days?: string;
        appSlug?: string;
        scope?: string;
      };
      const { accountId } = request.user;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString();

      const conditions = [
        eq(appKeywordRankings.keywordId, kw.id),
        sql`${appKeywordRankings.scrapedAt} >= ${sinceStr}`,
      ];

      if (appSlug) {
        // Look up app ID from slug (scoped to platform)
        const [appRow] = await db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.slug, appSlug), eq(apps.platform, platform)))
          .limit(1);
        if (appRow) {
          conditions.push(eq(appKeywordRankings.appId, appRow.id));
        }
      }

      // If scope=account, filter to only tracked + competitor apps
      if (scope === "account" && !appSlug) {
        const trackedRows = await db
          .select({ appId: accountTrackedApps.appId })
          .from(accountTrackedApps)
          .where(eq(accountTrackedApps.accountId, accountId));

        const competitorRows = await db
          .select({ appId: accountCompetitorApps.competitorAppId })
          .from(accountCompetitorApps)
          .where(eq(accountCompetitorApps.accountId, accountId));

        const appIds = [
          ...new Set([
            ...trackedRows.map((r) => r.appId),
            ...competitorRows.map((r) => r.appId),
          ]),
        ];

        if (appIds.length > 0) {
          conditions.push(inArray(appKeywordRankings.appId, appIds));
        } else {
          return { keyword: kw, rankings: [] };
        }
      }

      // Also filter by apps.platform to prevent cross-platform data leakage
      conditions.push(eq(apps.platform, platform));

      const rankings = await db
        .select({
          id: appKeywordRankings.id,
          appSlug: apps.slug,
          appName: apps.name,
          isBuiltForShopify: apps.isBuiltForShopify,
          iconUrl: apps.iconUrl,
          keywordId: appKeywordRankings.keywordId,
          scrapeRunId: appKeywordRankings.scrapeRunId,
          scrapedAt: appKeywordRankings.scrapedAt,
          position: appKeywordRankings.position,
        })
        .from(appKeywordRankings)
        .innerJoin(apps, eq(apps.id, appKeywordRankings.appId))
        .where(and(...conditions))
        .orderBy(appKeywordRankings.scrapedAt, appKeywordRankings.position);

      return { keyword: kw, rankings };
    }
  );

  // GET /api/keywords/:slug/ads — ad sightings history
  app.get<{ Params: { slug: string } }>(
    "/:slug/ads",
    async (request, reply) => {
      const { slug } = request.params;
      const { days = "30" } = request.query as { days?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      const adSightings = await db
        .select({
          appSlug: apps.slug,
          appName: apps.name,
          iconUrl: apps.iconUrl,
          isBuiltForShopify: apps.isBuiltForShopify,
          averageRating: sql<string>`(
            SELECT average_rating FROM app_snapshots
            WHERE app_id = ${keywordAdSightings.appId}
            ORDER BY scraped_at DESC LIMIT 1
          )`,
          ratingCount: sql<number>`(
            SELECT rating_count FROM app_snapshots
            WHERE app_id = ${keywordAdSightings.appId}
            ORDER BY scraped_at DESC LIMIT 1
          )`,
          seenDate: keywordAdSightings.seenDate,
          timesSeenInDay: keywordAdSightings.timesSeenInDay,
        })
        .from(keywordAdSightings)
        .innerJoin(apps, eq(keywordAdSightings.appId, apps.id))
        .where(
          and(
            eq(keywordAdSightings.keywordId, kw.id),
            eq(apps.platform, platform),
            sql`${keywordAdSightings.seenDate} >= ${sinceStr}`
          )
        )
        .orderBy(desc(keywordAdSightings.seenDate));

      return { keyword: kw, adSightings };
    }
  );

  // GET /api/keywords/:slug/history
  app.get<{ Params: { slug: string } }>(
    "/:slug/history",
    async (request, reply) => {
      const { slug } = request.params;
      const { limit = "20", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const snapshots = await db
        .select()
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, kw.id))
        .orderBy(desc(keywordSnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, kw.id));

      return { keyword: kw, snapshots, total: count };
    }
  );

  // GET /api/keywords/:slug/suggestions — autocomplete suggestions for a keyword
  app.get<{ Params: { slug: string } }>(
    "/:slug/suggestions",
    async (request, reply) => {
      const { slug } = request.params;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const [row] = await db
        .select({
          suggestions: keywordAutoSuggestions.suggestions,
          scrapedAt: keywordAutoSuggestions.scrapedAt,
        })
        .from(keywordAutoSuggestions)
        .where(eq(keywordAutoSuggestions.keywordId, kw.id))
        .limit(1);

      return {
        suggestions: row?.suggestions || [],
        scrapedAt: row?.scrapedAt || null,
      };
    }
  );

  // GET /api/keywords/:slug/membership — which apps and research projects contain this keyword
  app.get<{ Params: { slug: string } }>(
    "/:slug/membership",
    async (request, reply) => {
      const { slug } = request.params;
      const { accountId } = request.user;
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      const [kw] = await db
        .select({ id: trackedKeywords.id })
        .from(trackedKeywords)
        .where(and(eq(trackedKeywords.slug, slug), eq(trackedKeywords.platform, platform)))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const [trackedAppRows, projectRows] = await Promise.all([
        db
          .select({
            trackedAppSlug: apps.slug,
            appName: apps.name,
          })
          .from(accountTrackedKeywords)
          .innerJoin(apps, eq(apps.id, accountTrackedKeywords.trackedAppId))
          .where(
            and(
              eq(accountTrackedKeywords.accountId, accountId),
              eq(accountTrackedKeywords.keywordId, kw.id)
            )
          ),
        db
          .select({
            projectId: researchProjectKeywords.researchProjectId,
            projectName: researchProjects.name,
          })
          .from(researchProjectKeywords)
          .innerJoin(
            researchProjects,
            eq(researchProjects.id, researchProjectKeywords.researchProjectId)
          )
          .where(
            and(
              eq(researchProjects.accountId, accountId),
              eq(researchProjectKeywords.keywordId, kw.id)
            )
          ),
      ]);

      return {
        trackedAppSlugs: trackedAppRows.map((r) => r.trackedAppSlug),
        researchProjectIds: projectRows.map((r) => r.projectId),
        trackedAppNames: trackedAppRows.map((r) => ({ slug: r.trackedAppSlug, name: r.appName })),
        researchProjects: projectRows.map((r) => ({ id: r.projectId, name: r.projectName })),
      };
    }
  );

  // POST /api/keywords/opportunity — bulk keyword opportunity scores
  app.post<{ Body: { slugs: string[] } }>(
    "/opportunity",
    async (request, reply) => {
      const { slugs } = opportunitySchema.parse(request.body);

      // Step 1: Get keyword slug -> id mapping
      const kwRows = await db
        .select({ id: trackedKeywords.id, slug: trackedKeywords.slug })
        .from(trackedKeywords)
        .where(inArray(trackedKeywords.slug, slugs));

      if (kwRows.length === 0) return {};

      const slugByKeywordId = new Map(kwRows.map((r) => [r.id, r.slug]));

      // Step 2: Get latest snapshot per keyword (parallel)
      const snapshotResults = await Promise.all(
        kwRows.map(async (kw) => {
          const [row] = await db
            .select({
              keywordId: keywordSnapshots.keywordId,
              totalResults: keywordSnapshots.totalResults,
              results: keywordSnapshots.results,
            })
            .from(keywordSnapshots)
            .where(eq(keywordSnapshots.keywordId, kw.id))
            .orderBy(desc(keywordSnapshots.scrapedAt))
            .limit(1);
          return row;
        })
      );

      // Step 3: Compute opportunity scores
      const result: Record<string, any> = {};
      for (const row of snapshotResults) {
        if (!row) continue;
        const kwSlug = slugByKeywordId.get(row.keywordId);
        if (!kwSlug) continue;
        const results = (row.results as KeywordSearchApp[]) || [];
        result[kwSlug] = computeKeywordOpportunity(results, row.totalResults);
      }

      return result;
    }
  );
};
