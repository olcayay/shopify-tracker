import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  trackedKeywords,
  keywordSnapshots,
  appKeywordRankings,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const keywordRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/keywords — list tracked keywords
  // ?active=true (default) | false | all
  app.get("/", async (request) => {
    const { active = "true" } = request.query as { active?: string };

    let query = db.select().from(trackedKeywords);
    if (active === "true") {
      query = query.where(eq(trackedKeywords.isActive, true)) as typeof query;
    } else if (active === "false") {
      query = query.where(eq(trackedKeywords.isActive, false)) as typeof query;
    }

    const rows = await query.orderBy(trackedKeywords.keyword);

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
