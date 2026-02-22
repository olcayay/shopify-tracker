import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { createDb } from "@shopify-tracking/db";
import {
  apps,
  trackedKeywords,
  keywordToSlug,
  scrapeRuns,
} from "@shopify-tracking/db";

const QUEUE_NAME = "scraper-jobs";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

let scraperQueue: Queue | null = null;

function getScraperQueue(): Queue {
  if (!scraperQueue) {
    scraperQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scraperQueue;
}

type Db = ReturnType<typeof createDb>;

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // --- Tracked Apps ---

  // POST /api/admin/tracked-apps — add app to tracking
  // Body: { slug: string }
  app.post("/tracked-apps", async (request, reply) => {
    const { slug } = request.body as { slug?: string };
    if (!slug || typeof slug !== "string") {
      return reply.code(400).send({ error: "slug is required" });
    }

    const [result] = await db
      .insert(apps)
      .values({ slug, name: slug, isTracked: true })
      .onConflictDoUpdate({
        target: apps.slug,
        set: { isTracked: true, updatedAt: new Date() },
      })
      .returning();

    return result;
  });

  // DELETE /api/admin/tracked-apps/:slug — remove from tracking
  app.delete<{ Params: { slug: string } }>(
    "/tracked-apps/:slug",
    async (request, reply) => {
      const { slug } = request.params;

      const [result] = await db
        .update(apps)
        .set({ isTracked: false, updatedAt: new Date() })
        .where(eq(apps.slug, slug))
        .returning();

      if (!result) {
        return reply.code(404).send({ error: "App not found" });
      }

      return result;
    }
  );

  // --- Tracked Keywords ---

  // POST /api/admin/tracked-keywords — add keyword
  // Body: { keyword: string }
  app.post("/tracked-keywords", async (request, reply) => {
    const { keyword } = request.body as { keyword?: string };
    if (!keyword || typeof keyword !== "string") {
      return reply.code(400).send({ error: "keyword is required" });
    }

    const [result] = await db
      .insert(trackedKeywords)
      .values({ keyword, slug: keywordToSlug(keyword) })
      .onConflictDoUpdate({
        target: trackedKeywords.keyword,
        set: { isActive: true, updatedAt: new Date() },
      })
      .returning();

    return result;
  });

  // DELETE /api/admin/tracked-keywords/:id — deactivate keyword
  app.delete<{ Params: { id: string } }>(
    "/tracked-keywords/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);

      const [result] = await db
        .update(trackedKeywords)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(trackedKeywords.id, id))
        .returning();

      if (!result) {
        return reply.code(404).send({ error: "Keyword not found" });
      }

      return result;
    }
  );

  // --- Scraper Runs ---

  // GET /api/admin/scraper/runs — recent scraper runs
  // ?type=category|app_details|keyword_search|reviews  &limit=20
  app.get("/scraper/runs", async (request) => {
    const { type, limit = "20" } = request.query as {
      type?: string;
      limit?: string;
    };

    let query = db.select().from(scrapeRuns);
    if (
      type &&
      ["category", "app_details", "keyword_search", "reviews"].includes(type)
    ) {
      query = query.where(
        eq(scrapeRuns.scraperType, type as any)
      ) as typeof query;
    }

    const rows = await query
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(parseInt(limit, 10));

    return rows;
  });

  // POST /api/admin/scraper/trigger — manually trigger a scraper
  // Body: { type: "category" | "app_details" | "keyword_search" | "reviews" }
  app.post("/scraper/trigger", async (request, reply) => {
    const { type } = request.body as { type?: string };
    const validTypes = [
      "category",
      "app_details",
      "keyword_search",
      "reviews",
    ];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    try {
      const queue = getScraperQueue();
      const job = await queue.add(`scrape:${type}`, {
        type,
        triggeredBy: "api",
      });

      app.log.info(`Scraper triggered: ${type}, jobId=${job.id}`);

      return {
        message: `Scraper "${type}" enqueued`,
        jobId: job.id,
        status: "queued",
      };
    } catch (err) {
      // Redis not available — fall back to creating a pending run record
      app.log.warn(`Redis unavailable, creating pending run record: ${err}`);

      const [run] = await db
        .insert(scrapeRuns)
        .values({
          scraperType: type as any,
          status: "pending",
          createdAt: new Date(),
        })
        .returning();

      return {
        message: `Scraper "${type}" triggered (queue unavailable, run recorded)`,
        runId: run.id,
        status: "pending",
      };
    }
  });

  // GET /api/admin/stats — overview stats
  app.get("/stats", async () => {
    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apps)
      .where(eq(apps.isTracked, true));

    const [kwCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackedKeywords)
      .where(eq(trackedKeywords.isActive, true));

    const [totalApps] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apps);

    const latestRuns = await db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(5);

    // Per-scraper-type freshness: last successful completion
    const freshness = await db
      .select({
        scraperType: scrapeRuns.scraperType,
        lastCompletedAt: sql<string>`max(${scrapeRuns.completedAt})`,
        lastDurationMs: sql<number>`(
          SELECT (metadata->>'duration_ms')::int
          FROM scrape_runs sr2
          WHERE sr2.scraper_type = "scrape_runs"."scraper_type"
            AND sr2.status = 'completed'
          ORDER BY sr2.completed_at DESC LIMIT 1
        )`,
      })
      .from(scrapeRuns)
      .where(eq(scrapeRuns.status, "completed" as any))
      .groupBy(scrapeRuns.scraperType);

    return {
      trackedApps: appCount.count,
      trackedKeywords: kwCount.count,
      totalApps: totalApps.count,
      latestRuns,
      freshness,
    };
  });
};
