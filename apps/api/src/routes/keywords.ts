import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
  accountTrackedKeywords,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const keywordRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/keywords — list account's tracked keywords
  app.get("/", async (request) => {
    const { accountId } = request.user;

    // Get keyword IDs tracked by this account
    const trackedRows = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));

    if (trackedRows.length === 0) {
      return [];
    }

    const ids = trackedRows.map((r) => r.keywordId);
    const rows = await db
      .select()
      .from(trackedKeywords)
      .where(inArray(trackedKeywords.id, ids))
      .orderBy(trackedKeywords.keyword);

    // Get latest snapshot for each keyword
    const result = await Promise.all(
      rows.map(async (kw) => {
        const [snapshot] = await db
          .select({
            totalResults: keywordSnapshots.totalResults,
            scrapedAt: keywordSnapshots.scrapedAt,
            appCount: sql<number>`jsonb_array_length(${keywordSnapshots.results})::int`,
          })
          .from(keywordSnapshots)
          .where(eq(keywordSnapshots.keywordId, kw.id))
          .orderBy(desc(keywordSnapshots.scrapedAt))
          .limit(1);

        return { ...kw, latestSnapshot: snapshot || null };
      })
    );

    return result;
  });

  // GET /api/keywords/:id — keyword detail + latest snapshot (full results)
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseInt(request.params.id, 10);

    const [kw] = await db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.id, id))
      .limit(1);

    if (!kw) {
      return reply.code(404).send({ error: "Keyword not found" });
    }

    const [latestSnapshot] = await db
      .select()
      .from(keywordSnapshots)
      .where(eq(keywordSnapshots.keywordId, id))
      .orderBy(desc(keywordSnapshots.scrapedAt))
      .limit(1);

    return { ...kw, latestSnapshot: latestSnapshot || null };
  });

  // GET /api/keywords/:id/rankings — ranking history for tracked apps
  // ?days=30&appSlug=formful (optional filter)
  app.get<{ Params: { id: string } }>(
    "/:id/rankings",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { days = "30", appSlug } = request.query as {
        days?: string;
        appSlug?: string;
      };

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(eq(trackedKeywords.id, id))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const sinceStr = since.toISOString();

      const conditions = [
        eq(appKeywordRankings.keywordId, id),
        sql`${appKeywordRankings.scrapedAt} >= ${sinceStr}`,
      ];

      if (appSlug) {
        conditions.push(eq(appKeywordRankings.appSlug, appSlug));
      }

      const rankings = await db
        .select()
        .from(appKeywordRankings)
        .where(and(...conditions))
        .orderBy(appKeywordRankings.scrapedAt, appKeywordRankings.position);

      return { keyword: kw, rankings };
    }
  );

  // GET /api/keywords/:id/history — snapshot history
  // ?limit=20&offset=0
  app.get<{ Params: { id: string } }>(
    "/:id/history",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { limit = "20", offset = "0" } = request.query as {
        limit?: string;
        offset?: string;
      };

      const [kw] = await db
        .select()
        .from(trackedKeywords)
        .where(eq(trackedKeywords.id, id))
        .limit(1);

      if (!kw) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      const snapshots = await db
        .select()
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, id))
        .orderBy(desc(keywordSnapshots.scrapedAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, id));

      return { keyword: kw, snapshots, total: count };
    }
  );
};
