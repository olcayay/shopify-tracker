import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  createDb,
  accounts,
  users,
  apps,
  trackedKeywords,
  scrapeRuns,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

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

export const systemAdminRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/system-admin/accounts — all accounts with usage stats
  app.get("/accounts", async () => {
    const accountList = await db.select().from(accounts);

    const result = await Promise.all(
      accountList.map(async (account) => {
        const [trackedAppsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(accountTrackedApps)
          .where(eq(accountTrackedApps.accountId, account.id));

        const [trackedKeywordsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(accountTrackedKeywords)
          .where(eq(accountTrackedKeywords.accountId, account.id));

        const [competitorAppsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(accountCompetitorApps)
          .where(eq(accountCompetitorApps.accountId, account.id));

        const [memberCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.accountId, account.id));

        return {
          ...account,
          usage: {
            trackedApps: trackedAppsCount.count,
            trackedKeywords: trackedKeywordsCount.count,
            competitorApps: competitorAppsCount.count,
            members: memberCount.count,
          },
        };
      })
    );

    return result;
  });

  // GET /api/system-admin/accounts/:id — account detail with members + tracked items
  app.get<{ Params: { id: string } }>("/accounts/:id", async (request, reply) => {
    const { id } = request.params;

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    if (!account) {
      return reply.code(404).send({ error: "Account not found" });
    }

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.accountId, id));

    const trackedAppsList = await db
      .select({
        appSlug: accountTrackedApps.appSlug,
        appName: apps.name,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.slug, accountTrackedApps.appSlug))
      .where(eq(accountTrackedApps.accountId, id));

    const trackedKeywordsList = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        keyword: trackedKeywords.keyword,
      })
      .from(accountTrackedKeywords)
      .innerJoin(
        trackedKeywords,
        eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
      )
      .where(eq(accountTrackedKeywords.accountId, id));

    const competitorAppsList = await db
      .select({
        appSlug: accountCompetitorApps.appSlug,
        appName: apps.name,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, id));

    return {
      ...account,
      members,
      trackedApps: trackedAppsList,
      trackedKeywords: trackedKeywordsList,
      competitorApps: competitorAppsList,
    };
  });

  // PATCH /api/system-admin/accounts/:id — update account (limits, suspend)
  app.patch<{ Params: { id: string } }>(
    "/accounts/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as {
        name?: string;
        maxTrackedApps?: number;
        maxTrackedKeywords?: number;
        maxCompetitorApps?: number;
        isSuspended?: boolean;
      };

      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, id));

      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.maxTrackedApps !== undefined)
        updates.maxTrackedApps = body.maxTrackedApps;
      if (body.maxTrackedKeywords !== undefined)
        updates.maxTrackedKeywords = body.maxTrackedKeywords;
      if (body.maxCompetitorApps !== undefined)
        updates.maxCompetitorApps = body.maxCompetitorApps;
      if (body.isSuspended !== undefined)
        updates.isSuspended = body.isSuspended;

      const [updated] = await db
        .update(accounts)
        .set(updates)
        .where(eq(accounts.id, id))
        .returning();

      return updated;
    }
  );

  // DELETE /api/system-admin/accounts/:id — delete account
  app.delete<{ Params: { id: string } }>(
    "/accounts/:id",
    async (request, reply) => {
      const { id } = request.params;

      // Delete associated data first (cascade handles junction tables)
      await db.delete(users).where(eq(users.accountId, id));
      const deleted = await db
        .delete(accounts)
        .where(eq(accounts.id, id))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Account not found" });
      }

      return { message: "Account deleted" };
    }
  );

  // GET /api/system-admin/accounts/:id/members
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/members",
    async (request, reply) => {
      const { id } = request.params;

      const members = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          isSystemAdmin: users.isSystemAdmin,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.accountId, id));

      return members;
    }
  );

  // GET /api/system-admin/users — all users
  app.get("/users", async () => {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        accountId: users.accountId,
        accountName: accounts.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.id, users.accountId));

    return allUsers;
  });

  // --- Scraper Control (moved from admin.ts) ---

  // GET /api/system-admin/scraper/runs
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

  // POST /api/system-admin/scraper/trigger
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
      app.log.warn(`Redis unavailable, creating pending run record: ${err}`);

      const [run] = await db
        .insert(scrapeRuns)
        .values({
          scraperType: type as any,
          status: "pending",
        })
        .returning();

      return {
        message: `Scraper "${type}" triggered (queue unavailable, run recorded)`,
        runId: run.id,
        status: "pending",
      };
    }
  });

  // GET /api/system-admin/stats — global system stats
  app.get("/stats", async () => {
    const [accountCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts);

    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

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

    const freshness = await db
      .select({
        scraperType: scrapeRuns.scraperType,
        lastCompletedAt: sql<string>`max(${scrapeRuns.completedAt})`,
      })
      .from(scrapeRuns)
      .where(eq(scrapeRuns.status, "completed" as any))
      .groupBy(scrapeRuns.scraperType);

    return {
      accounts: accountCount.count,
      users: userCount.count,
      trackedApps: appCount.count,
      trackedKeywords: kwCount.count,
      totalApps: totalApps.count,
      latestRuns,
      freshness,
    };
  });
};
