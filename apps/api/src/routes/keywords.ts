import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, ilike } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
  keywordAdSightings,
  apps,
  appSnapshots,
  accountTrackedKeywords,
  accountTrackedApps,
  accountCompetitorApps,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const keywordRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/keywords — list account's tracked keywords
  app.get("/", async (request) => {
    const { accountId } = request.user;

    const trackedRows = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));

    if (trackedRows.length === 0) {
      return [];
    }

    // Get account's tracked apps and competitors for matching
    const [trackedAppRows, competitorRows] = await Promise.all([
      db
        .select({ appSlug: accountTrackedApps.appSlug })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.accountId, accountId)),
      db
        .select({ appSlug: accountCompetitorApps.appSlug })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSlugs = trackedAppRows.map((r) => r.appSlug);
    const competitorSlugs = competitorRows.map((r) => r.appSlug);

    const ids = trackedRows.map((r) => r.keywordId);
    const rows = await db
      .select()
      .from(trackedKeywords)
      .where(inArray(trackedKeywords.id, ids))
      .orderBy(trackedKeywords.keyword);

    const result = await Promise.all(
      rows.map(async (kw) => {
        const [snapshot] = await db
          .select({
            totalResults: keywordSnapshots.totalResults,
            scrapedAt: keywordSnapshots.scrapedAt,
            appCount: sql<number>`jsonb_array_length(${keywordSnapshots.results})::int`,
            results: keywordSnapshots.results,
          })
          .from(keywordSnapshots)
          .where(eq(keywordSnapshots.keywordId, kw.id))
          .orderBy(desc(keywordSnapshots.scrapedAt))
          .limit(1);

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

        const { results: _, ...snapshotWithoutResults } = snapshot || ({} as any);

        return {
          ...kw,
          latestSnapshot: snapshot ? snapshotWithoutResults : null,
          trackedInResults: trackedAppsInResults.length,
          competitorInResults: competitorAppsInResults.length,
          trackedAppsInResults,
          competitorAppsInResults,
        };
      })
    );

    return result;
  });

  // GET /api/keywords/search?q= — search all keywords by prefix
  app.get("/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) return [];

    const rows = await db
      .select({
        id: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        slug: trackedKeywords.slug,
      })
      .from(trackedKeywords)
      .where(ilike(trackedKeywords.keyword, `${q}%`))
      .orderBy(trackedKeywords.keyword)
      .limit(20);

    return rows;
  });

  // GET /api/keywords/:slug — keyword detail + latest snapshot + track status
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const { accountId } = request.user;

    const [kw] = await db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.slug, slug))
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

    const [tracked] = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
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
      isTrackedByAccount: !!tracked,
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

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(eq(trackedKeywords.slug, slug))
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
        conditions.push(eq(appKeywordRankings.appSlug, appSlug));
      }

      // If scope=account, filter to only tracked + competitor apps
      if (scope === "account" && !appSlug) {
        const trackedRows = await db
          .select({ appSlug: accountTrackedApps.appSlug })
          .from(accountTrackedApps)
          .where(eq(accountTrackedApps.accountId, accountId));

        const competitorRows = await db
          .select({ appSlug: accountCompetitorApps.appSlug })
          .from(accountCompetitorApps)
          .where(eq(accountCompetitorApps.accountId, accountId));

        const slugs = [
          ...new Set([
            ...trackedRows.map((r) => r.appSlug),
            ...competitorRows.map((r) => r.appSlug),
          ]),
        ];

        if (slugs.length > 0) {
          conditions.push(inArray(appKeywordRankings.appSlug, slugs));
        } else {
          return { keyword: kw, rankings: [] };
        }
      }

      const rankings = await db
        .select({
          id: appKeywordRankings.id,
          appSlug: appKeywordRankings.appSlug,
          appName: apps.name,
          isBuiltForShopify: apps.isBuiltForShopify,
          iconUrl: apps.iconUrl,
          keywordId: appKeywordRankings.keywordId,
          scrapeRunId: appKeywordRankings.scrapeRunId,
          scrapedAt: appKeywordRankings.scrapedAt,
          position: appKeywordRankings.position,
        })
        .from(appKeywordRankings)
        .innerJoin(apps, eq(apps.slug, appKeywordRankings.appSlug))
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

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(eq(trackedKeywords.slug, slug))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString().slice(0, 10);

      const adSightings = await db
        .select({
          appSlug: keywordAdSightings.appSlug,
          appName: apps.name,
          iconUrl: apps.iconUrl,
          averageRating: sql<string>`(
            SELECT average_rating FROM app_snapshots
            WHERE app_slug = ${keywordAdSightings.appSlug}
            ORDER BY scraped_at DESC LIMIT 1
          )`,
          ratingCount: sql<number>`(
            SELECT rating_count FROM app_snapshots
            WHERE app_slug = ${keywordAdSightings.appSlug}
            ORDER BY scraped_at DESC LIMIT 1
          )`,
          seenDate: keywordAdSightings.seenDate,
          timesSeenInDay: keywordAdSightings.timesSeenInDay,
        })
        .from(keywordAdSightings)
        .innerJoin(apps, eq(keywordAdSightings.appSlug, apps.slug))
        .where(
          and(
            eq(keywordAdSightings.keywordId, kw.id),
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

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(eq(trackedKeywords.slug, slug))
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
};
