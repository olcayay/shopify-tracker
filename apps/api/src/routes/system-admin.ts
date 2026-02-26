import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  createDb,
  packages,
  accounts,
  users,
  apps,
  appSnapshots,
  trackedKeywords,
  keywordSnapshots,
  scrapeRuns,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountTrackedFeatures,
  appKeywordRankings,
  keywordAdSightings,
  categories,
  categorySnapshots,
  reviews,
  refreshTokens,
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
    const packageList = await db.select().from(packages);
    const packageMap = new Map(packageList.map((p) => [p.id, p]));

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

        const [trackedFeaturesCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(accountTrackedFeatures)
          .where(eq(accountTrackedFeatures.accountId, account.id));

        const [memberCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.accountId, account.id));

        const [lastSeenResult] = await db
          .select({
            lastSeen: sql<string | null>`(
              SELECT max(last_seen_at) FROM users WHERE account_id = ${account.id}
            )`,
          })
          .from(accounts)
          .where(eq(accounts.id, account.id));

        const pkg = account.packageId ? packageMap.get(account.packageId) : null;
        const hasOverrides = pkg
          ? account.maxTrackedApps !== pkg.maxTrackedApps ||
            account.maxTrackedKeywords !== pkg.maxTrackedKeywords ||
            account.maxCompetitorApps !== pkg.maxCompetitorApps ||
            account.maxTrackedFeatures !== pkg.maxTrackedFeatures ||
            account.maxUsers !== pkg.maxUsers
          : false;

        return {
          ...account,
          packageName: pkg?.name ?? null,
          packageSlug: pkg?.slug ?? null,
          hasLimitOverrides: hasOverrides,
          lastSeen: lastSeenResult?.lastSeen ?? null,
          usage: {
            trackedApps: trackedAppsCount.count,
            trackedKeywords: trackedKeywordsCount.count,
            competitorApps: competitorAppsCount.count,
            trackedFeatures: trackedFeaturesCount.count,
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
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_slug = "account_tracked_apps"."app_slug"
        )`,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.slug, accountTrackedApps.appSlug))
      .where(eq(accountTrackedApps.accountId, id));

    const trackedKeywordsList = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        keyword: trackedKeywords.keyword,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM keyword_snapshots
          WHERE keyword_id = "account_tracked_keywords"."keyword_id"
        )`,
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
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_slug = "account_competitor_apps"."app_slug"
        )`,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, id));

    const trackedFeaturesList = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, id));

    // Attach package info
    let pkg = null;
    if (account.packageId) {
      const [found] = await db.select().from(packages).where(eq(packages.id, account.packageId));
      pkg = found ?? null;
    }

    return {
      ...account,
      package: pkg,
      members,
      trackedApps: trackedAppsList,
      trackedKeywords: trackedKeywordsList,
      competitorApps: competitorAppsList,
      trackedFeatures: trackedFeaturesList,
    };
  });

  // PATCH /api/system-admin/accounts/:id — update account (limits, suspend, package)
  app.patch<{ Params: { id: string } }>(
    "/accounts/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as {
        name?: string;
        company?: string;
        packageId?: number | null;
        applyPackageDefaults?: boolean;
        maxTrackedApps?: number;
        maxTrackedKeywords?: number;
        maxCompetitorApps?: number;
        maxTrackedFeatures?: number;
        maxUsers?: number;
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
      if (body.company !== undefined) updates.company = body.company;
      if (body.packageId !== undefined) updates.packageId = body.packageId;
      if (body.isSuspended !== undefined)
        updates.isSuspended = body.isSuspended;

      // If changing package and applyPackageDefaults is true, reset limits to package defaults
      if (body.applyPackageDefaults && body.packageId) {
        const [pkg] = await db
          .select()
          .from(packages)
          .where(eq(packages.id, body.packageId));
        if (pkg) {
          updates.maxTrackedApps = pkg.maxTrackedApps;
          updates.maxTrackedKeywords = pkg.maxTrackedKeywords;
          updates.maxCompetitorApps = pkg.maxCompetitorApps;
          updates.maxTrackedFeatures = pkg.maxTrackedFeatures;
          updates.maxUsers = pkg.maxUsers;
        }
      }

      // Manual limit overrides (take precedence over package defaults)
      if (body.maxTrackedApps !== undefined)
        updates.maxTrackedApps = body.maxTrackedApps;
      if (body.maxTrackedKeywords !== undefined)
        updates.maxTrackedKeywords = body.maxTrackedKeywords;
      if (body.maxCompetitorApps !== undefined)
        updates.maxCompetitorApps = body.maxCompetitorApps;
      if (body.maxTrackedFeatures !== undefined)
        updates.maxTrackedFeatures = body.maxTrackedFeatures;
      if (body.maxUsers !== undefined) updates.maxUsers = body.maxUsers;

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

  // POST /api/system-admin/accounts/:id/send-digest — send digest to all users in account
  app.post<{ Params: { id: string } }>(
    "/accounts/:id/send-digest",
    async (request, reply) => {
      const { id } = request.params;

      const [account] = await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, id));

      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }

      const memberCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountId, id));

      const userEmail = (request as any).user?.email || "api";

      try {
        const queue = getScraperQueue();
        const job = await queue.add("scrape:daily_digest", {
          type: "daily_digest",
          accountId: id,
          triggeredBy: userEmail,
        });

        return {
          message: `Digest email queued for ${memberCount[0].count} users in "${account.name}"`,
          jobId: job.id,
        };
      } catch {
        return reply.code(500).send({ error: "Failed to enqueue digest job" });
      }
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
        emailDigestEnabled: users.emailDigestEnabled,
        lastDigestSentAt: users.lastDigestSentAt,
        accountId: users.accountId,
        accountName: accounts.name,
        accountCompany: accounts.company,
        createdAt: users.createdAt,
        lastSeen: users.lastSeenAt,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.id, users.accountId));

    return allUsers;
  });

  // GET /api/system-admin/users/:id — user detail with account tracked items
  app.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const { id } = request.params;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        accountId: users.accountId,
        accountName: accounts.name,
        accountCompany: accounts.company,
        lastSeen: users.lastSeenAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.id, users.accountId))
      .where(eq(users.id, id));

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    // Get user's account tracked items
    const trackedAppsList = await db
      .select({
        appSlug: accountTrackedApps.appSlug,
        appName: apps.name,
        createdAt: accountTrackedApps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_slug = "account_tracked_apps"."app_slug"
        )`,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.slug, accountTrackedApps.appSlug))
      .where(eq(accountTrackedApps.accountId, user.accountId));

    const trackedKeywordsList = await db
      .select({
        keywordId: accountTrackedKeywords.keywordId,
        keyword: trackedKeywords.keyword,
        createdAt: accountTrackedKeywords.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM keyword_snapshots
          WHERE keyword_id = "account_tracked_keywords"."keyword_id"
        )`,
      })
      .from(accountTrackedKeywords)
      .innerJoin(
        trackedKeywords,
        eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
      )
      .where(eq(accountTrackedKeywords.accountId, user.accountId));

    const competitorAppsList = await db
      .select({
        appSlug: accountCompetitorApps.appSlug,
        appName: apps.name,
        createdAt: accountCompetitorApps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_slug = "account_competitor_apps"."app_slug"
        )`,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, user.accountId));

    const trackedFeaturesList = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
        createdAt: accountTrackedFeatures.createdAt,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, user.accountId));

    return {
      ...user,
      trackedApps: trackedAppsList,
      trackedKeywords: trackedKeywordsList,
      competitorApps: competitorAppsList,
      trackedFeatures: trackedFeaturesList,
    };
  });

  // POST /api/system-admin/users/:id/send-digest — manually trigger digest email for a user
  app.post<{ Params: { id: string } }>(
    "/users/:id/send-digest",
    async (request, reply) => {
      const { id } = request.params;

      const [user] = await db
        .select({ id: users.id, email: users.email, accountId: users.accountId })
        .from(users)
        .where(eq(users.id, id));

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const userEmail = (request as any).user?.email || "api";

      try {
        const queue = getScraperQueue();
        const job = await queue.add("scrape:daily_digest", {
          type: "daily_digest",
          userId: id,
          triggeredBy: userEmail,
        });

        return {
          message: `Digest email queued for ${user.email}`,
          jobId: job.id,
        };
      } catch (err) {
        return reply.code(500).send({ error: "Failed to enqueue digest job" });
      }
    }
  );

  // --- Scraper Control (moved from admin.ts) ---

  // GET /api/system-admin/scraper/runs
  app.get("/scraper/runs", async (request) => {
    const { type, triggeredBy: triggerFilter, limit = "20", offset = "0" } = request.query as {
      type?: string;
      triggeredBy?: string;
      limit?: string;
      offset?: string;
    };

    const conditions = [];
    if (
      type &&
      ["category", "app_details", "keyword_search", "reviews"].includes(type)
    ) {
      conditions.push(eq(scrapeRuns.scraperType, type as any));
    }
    if (triggerFilter === "scheduler") {
      conditions.push(eq(scrapeRuns.triggeredBy, "scheduler"));
    } else if (triggerFilter === "manual") {
      conditions.push(sql`${scrapeRuns.triggeredBy} IS NOT NULL AND ${scrapeRuns.triggeredBy} != 'scheduler'`);
    }

    let query = db.select().from(scrapeRuns);
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Get total count for pagination
    let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(scrapeRuns);
    if (conditions.length === 1) {
      countQuery = countQuery.where(conditions[0]) as typeof countQuery;
    } else if (conditions.length > 1) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }
    const [{ count: total }] = await countQuery;

    const rows = await query
      .orderBy(desc(scrapeRuns.createdAt))
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10));

    // Enrich runs with scraped asset names and links
    const enriched = await Promise.all(
      rows.map(async (run) => {
        const itemsScraped =
          (run.metadata as any)?.items_scraped ?? 0;

        // Only fetch asset names for small runs (≤ 10 items)
        let assets: { name: string; href: string }[] = [];
        if (itemsScraped > 0 && itemsScraped <= 10) {
          if (run.scraperType === "app_details") {
            const snapshots = await db
              .select({ appSlug: appSnapshots.appSlug })
              .from(appSnapshots)
              .where(eq(appSnapshots.scrapeRunId, run.id));
            if (snapshots.length > 0) {
              const appRows = await db
                .select({ slug: apps.slug, name: apps.name })
                .from(apps)
                .where(
                  sql`${apps.slug} IN (${sql.join(
                    snapshots.map((s) => sql`${s.appSlug}`),
                    sql`,`
                  )})`
                );
              const nameMap = new Map(appRows.map((a) => [a.slug, a.name]));
              assets = snapshots.map((s) => ({
                name: nameMap.get(s.appSlug) || s.appSlug,
                href: `/apps/${s.appSlug}`,
              }));
            }
          } else if (run.scraperType === "keyword_search") {
            const snapshots = await db
              .select({ keywordId: keywordSnapshots.keywordId })
              .from(keywordSnapshots)
              .where(eq(keywordSnapshots.scrapeRunId, run.id));
            if (snapshots.length > 0) {
              const kwRows = await db
                .select({
                  id: trackedKeywords.id,
                  keyword: trackedKeywords.keyword,
                  slug: trackedKeywords.slug,
                })
                .from(trackedKeywords)
                .where(
                  sql`${trackedKeywords.id} IN (${sql.join(
                    snapshots.map((s) => sql`${s.keywordId}`),
                    sql`,`
                  )})`
                );
              const infoMap = new Map(kwRows.map((k) => [k.id, k]));
              assets = snapshots.map((s) => {
                const kw = infoMap.get(s.keywordId);
                return {
                  name: kw?.keyword || `keyword#${s.keywordId}`,
                  href: `/keywords/${kw?.slug || s.keywordId}`,
                };
              });
            }
          } else if (run.scraperType === "category") {
            const snapshots = await db
              .select({
                categorySlug: categorySnapshots.categorySlug,
                title: categories.title,
              })
              .from(categorySnapshots)
              .leftJoin(categories, eq(categories.slug, categorySnapshots.categorySlug))
              .where(eq(categorySnapshots.scrapeRunId, run.id))
              .limit(10);
            assets = snapshots.map((s) => ({
              name: s.title || s.categorySlug,
              href: `/categories/${s.categorySlug}`,
            }));
          }
        }

        return { ...run, assets };
      })
    );

    return { runs: enriched, total };
  });

  // GET /api/system-admin/scraper/queue — queue status
  app.get("/scraper/queue", async () => {
    try {
      const queue = getScraperQueue();
      const [waiting, active, delayed, failed, isPaused, jobCounts] = await Promise.all([
        queue.getWaiting(0, 50),
        queue.getActive(0, 10),
        queue.getDelayed(0, 10),
        queue.getFailed(0, 10),
        queue.isPaused(),
        queue.getJobCounts("waiting", "active", "delayed", "failed"),
      ]);

      return {
        isPaused,
        counts: {
          waiting: jobCounts.waiting ?? waiting.length,
          active: jobCounts.active ?? active.length,
          delayed: jobCounts.delayed ?? delayed.length,
          failed: jobCounts.failed ?? failed.length,
        },
        jobs: [
          ...active.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "active" as const,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...waiting.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "waiting" as const,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...delayed.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "delayed" as const,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...failed.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "failed" as const,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            failedReason: j.failedReason,
            data: j.data,
          })),
        ],
      };
    } catch {
      return { isPaused: false, counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }, jobs: [] };
    }
  });

  // POST /api/system-admin/scraper/queue/pause — pause the queue
  app.post("/scraper/queue/pause", async (_request, reply) => {
    try {
      const queue = getScraperQueue();
      await queue.pause();
      return { ok: true, paused: true };
    } catch {
      return reply.code(500).send({ error: "Failed to pause queue" });
    }
  });

  // POST /api/system-admin/scraper/queue/resume — resume the queue
  app.post("/scraper/queue/resume", async (_request, reply) => {
    try {
      const queue = getScraperQueue();
      await queue.resume();
      return { ok: true, paused: false };
    } catch {
      return reply.code(500).send({ error: "Failed to resume queue" });
    }
  });

  // DELETE /api/system-admin/scraper/queue/jobs/:jobId — remove a job from queue
  app.delete<{ Params: { jobId: string } }>(
    "/scraper/queue/jobs/:jobId",
    async (request, reply) => {
      try {
        const queue = getScraperQueue();
        const job = await queue.getJob(request.params.jobId);
        if (!job) return reply.code(404).send({ error: "Job not found" });
        await job.remove();
        return { ok: true };
      } catch {
        return reply.code(500).send({ error: "Failed to remove job" });
      }
    }
  );

  // DELETE /api/system-admin/scraper/queue/jobs — drain all waiting jobs
  app.delete("/scraper/queue/jobs", async (_request, reply) => {
    try {
      const queue = getScraperQueue();
      await queue.drain();
      return { ok: true };
    } catch {
      return reply.code(500).send({ error: "Failed to drain queue" });
    }
  });

  // DELETE /api/system-admin/scraper/queue/failed — remove all failed jobs
  app.delete("/scraper/queue/failed", async (_request, reply) => {
    try {
      const queue = getScraperQueue();
      const failed = await queue.getFailed(0, 1000);
      await Promise.all(failed.map((j) => j.remove()));
      return { ok: true, removed: failed.length };
    } catch {
      return reply.code(500).send({ error: "Failed to clear failed jobs" });
    }
  });

  // POST /api/system-admin/scraper/trigger
  app.post("/scraper/trigger", async (request, reply) => {
    const { type, slug, keyword, options } = request.body as {
      type?: string;
      slug?: string;
      keyword?: string;
      options?: { pages?: "first" | "all" | number; scrapeAppDetails?: boolean; scrapeReviews?: boolean };
    };
    const validTypes = [
      "category",
      "app_details",
      "keyword_search",
      "reviews",
      "daily_digest",
      "compute_review_metrics",
      "compute_similarity_scores",
    ];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const userEmail = (request as any).user?.email || "api";

    try {
      const queue = getScraperQueue();
      const jobData: Record<string, any> = {
        type,
        triggeredBy: userEmail,
      };
      if (slug) jobData.slug = slug;
      if (keyword) jobData.keyword = keyword;
      if (options) jobData.options = options;
      const job = await queue.add(`scrape:${type}`, jobData);

      app.log.info(`Scraper triggered: ${type}, jobId=${job.id}, by=${userEmail}`);

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
          createdAt: new Date(),
          triggeredBy: userEmail,
        })
        .returning();

      return {
        message: `Scraper "${type}" triggered (queue unavailable, run recorded)`,
        runId: run.id,
        status: "pending",
      };
    }
  });

  // GET /api/system-admin/apps — all apps with last scraped info + account counts
  app.get("/apps", async (request) => {
    const { tracked } = request.query as { tracked?: string };

    let query = db
      .select({
        slug: apps.slug,
        name: apps.name,
        isTracked: apps.isTracked,
        createdAt: apps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_slug = "apps"."slug"
        )`,
        trackedByCount: sql<number>`(
          SELECT count(*)::int FROM account_tracked_apps
          WHERE app_slug = "apps"."slug"
        )`,
        competitorByCount: sql<number>`(
          SELECT count(*)::int FROM account_competitor_apps
          WHERE app_slug = "apps"."slug"
        )`,
        lastChangeAt: sql<string | null>`(
          SELECT max(detected_at) FROM app_field_changes
          WHERE app_slug = "apps"."slug"
        )`,
      })
      .from(apps);

    if (tracked === "true") {
      query = query.where(eq(apps.isTracked, true)) as typeof query;
    }

    const rows = await query.orderBy(apps.name);
    return rows;
  });

  // GET /api/system-admin/apps/:slug/accounts — accounts that track this app
  app.get<{ Params: { slug: string } }>(
    "/apps/:slug/accounts",
    async (request) => {
      const { slug } = request.params;

      const trackedBy = await db
        .select({
          accountId: accountTrackedApps.accountId,
          accountName: accounts.name,
          type: sql<string>`'tracked'`,
        })
        .from(accountTrackedApps)
        .innerJoin(accounts, eq(accounts.id, accountTrackedApps.accountId))
        .where(eq(accountTrackedApps.appSlug, slug));

      const competitorBy = await db
        .select({
          accountId: accountCompetitorApps.accountId,
          accountName: accounts.name,
          type: sql<string>`'competitor'`,
        })
        .from(accountCompetitorApps)
        .innerJoin(accounts, eq(accounts.id, accountCompetitorApps.accountId))
        .where(eq(accountCompetitorApps.appSlug, slug));

      return [...trackedBy, ...competitorBy];
    }
  );

  // GET /api/system-admin/keywords — all tracked keywords with last scraped info + account counts
  app.get("/keywords", async () => {
    const rows = await db
      .select({
        id: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        slug: trackedKeywords.slug,
        isActive: trackedKeywords.isActive,
        createdAt: trackedKeywords.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM keyword_snapshots
          WHERE keyword_id = "tracked_keywords"."id"
        )`,
        trackedByCount: sql<number>`(
          SELECT count(*)::int FROM account_tracked_keywords
          WHERE keyword_id = "tracked_keywords"."id"
        )`,
      })
      .from(trackedKeywords)
      .orderBy(trackedKeywords.keyword);

    return rows;
  });

  // GET /api/system-admin/keywords/:id/accounts — accounts that track this keyword
  app.get<{ Params: { id: string } }>(
    "/keywords/:id/accounts",
    async (request) => {
      const keywordId = parseInt(request.params.id, 10);

      const trackedBy = await db
        .select({
          accountId: accountTrackedKeywords.accountId,
          accountName: accounts.name,
        })
        .from(accountTrackedKeywords)
        .innerJoin(
          accounts,
          eq(accounts.id, accountTrackedKeywords.accountId)
        )
        .where(eq(accountTrackedKeywords.keywordId, keywordId));

      return trackedBy;
    }
  );

  // DELETE /api/system-admin/keywords/:id — delete a keyword and all related data
  app.delete<{ Params: { id: string } }>(
    "/keywords/:id",
    async (request, reply) => {
      const keywordId = parseInt(request.params.id, 10);

      const [kw] = await db
        .select({ id: trackedKeywords.id })
        .from(trackedKeywords)
        .where(eq(trackedKeywords.id, keywordId));

      if (!kw) return reply.code(404).send({ error: "Keyword not found" });

      // Delete related data in order (foreign key constraints)
      await db.delete(accountTrackedKeywords).where(eq(accountTrackedKeywords.keywordId, keywordId));
      await db.delete(appKeywordRankings).where(eq(appKeywordRankings.keywordId, keywordId));
      await db.delete(keywordAdSightings).where(eq(keywordAdSightings.keywordId, keywordId));
      await db.delete(keywordSnapshots).where(eq(keywordSnapshots.keywordId, keywordId));
      await db.delete(trackedKeywords).where(eq(trackedKeywords.id, keywordId));

      return { ok: true };
    }
  );

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

    const [featuresCount] = await db
      .select({ count: sql<number>`count(DISTINCT feature_handle)::int` })
      .from(accountTrackedFeatures);

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

    // Avg duration & items from last 3 completed runs per type
    const workerStats: { scraper_type: string; avg_duration_ms: number; avg_items: number }[] = await db.execute(sql`
      SELECT scraper_type,
        ROUND(AVG((metadata->>'duration_ms')::numeric))::int AS avg_duration_ms,
        ROUND(AVG(COALESCE((metadata->>'items_scraped')::numeric, (metadata->>'apps_computed')::numeric)))::int AS avg_items
      FROM (
        SELECT scraper_type, metadata,
          ROW_NUMBER() OVER (PARTITION BY scraper_type ORDER BY completed_at DESC) AS rn
        FROM scrape_runs
        WHERE status = 'completed'
          AND metadata->>'duration_ms' IS NOT NULL
      ) sub
      WHERE rn <= 3
      GROUP BY scraper_type
    `).then((res: any) => (res as any).rows ?? res);

    const [categoryCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories);

    return {
      accounts: accountCount.count,
      users: userCount.count,
      trackedApps: appCount.count,
      trackedKeywords: kwCount.count,
      trackedFeatures: featuresCount.count,
      totalApps: totalApps.count,
      totalCategories: categoryCount.count,
      latestRuns,
      freshness,
      workerStats,
    };
  });

  // GET /api/system-admin/features — all tracked features with account counts
  app.get("/features", async () => {
    // Get unique features with their tracking counts
    const rows = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
        trackedByCount: sql<number>`count(*)::int`,
      })
      .from(accountTrackedFeatures)
      .groupBy(accountTrackedFeatures.featureHandle, accountTrackedFeatures.featureTitle)
      .orderBy(accountTrackedFeatures.featureTitle);

    return rows;
  });

  // GET /api/system-admin/features/:handle/accounts — accounts tracking this feature
  app.get<{ Params: { handle: string } }>(
    "/features/:handle/accounts",
    async (request) => {
      const { handle } = request.params;

      const trackedBy = await db
        .select({
          accountId: accountTrackedFeatures.accountId,
          accountName: accounts.name,
        })
        .from(accountTrackedFeatures)
        .innerJoin(
          accounts,
          eq(accounts.id, accountTrackedFeatures.accountId)
        )
        .where(eq(accountTrackedFeatures.featureHandle, handle));

      return trackedBy;
    }
  );

  // --- Packages ---

  // GET /api/system-admin/packages — all packages
  app.get("/packages", async () => {
    return db.select().from(packages).orderBy(packages.sortOrder);
  });

  // POST /api/system-admin/packages — create package
  app.post("/packages", async (request, reply) => {
    const body = request.body as {
      slug: string;
      name: string;
      maxTrackedApps?: number;
      maxTrackedKeywords?: number;
      maxCompetitorApps?: number;
      maxTrackedFeatures?: number;
      maxUsers?: number;
      sortOrder?: number;
    };

    if (!body.slug || !body.name) {
      return reply.code(400).send({ error: "slug and name are required" });
    }

    const [created] = await db
      .insert(packages)
      .values({
        slug: body.slug,
        name: body.name,
        maxTrackedApps: body.maxTrackedApps ?? 5,
        maxTrackedKeywords: body.maxTrackedKeywords ?? 5,
        maxCompetitorApps: body.maxCompetitorApps ?? 3,
        maxTrackedFeatures: body.maxTrackedFeatures ?? 5,
        maxUsers: body.maxUsers ?? 2,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    return created;
  });

  // PATCH /api/system-admin/packages/:id — update package
  app.patch<{ Params: { id: string } }>(
    "/packages/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as {
        name?: string;
        maxTrackedApps?: number;
        maxTrackedKeywords?: number;
        maxCompetitorApps?: number;
        maxTrackedFeatures?: number;
        maxUsers?: number;
        sortOrder?: number;
      };

      const updates: Record<string, any> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.maxTrackedApps !== undefined) updates.maxTrackedApps = body.maxTrackedApps;
      if (body.maxTrackedKeywords !== undefined) updates.maxTrackedKeywords = body.maxTrackedKeywords;
      if (body.maxCompetitorApps !== undefined) updates.maxCompetitorApps = body.maxCompetitorApps;
      if (body.maxTrackedFeatures !== undefined) updates.maxTrackedFeatures = body.maxTrackedFeatures;
      if (body.maxUsers !== undefined) updates.maxUsers = body.maxUsers;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const [updated] = await db
        .update(packages)
        .set(updates)
        .where(eq(packages.id, id))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "Package not found" });
      }

      return updated;
    }
  );

  // DELETE /api/system-admin/packages/:id — delete package
  app.delete<{ Params: { id: string } }>(
    "/packages/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);

      // Check if any accounts use this package
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accounts)
        .where(eq(accounts.packageId, id));

      if (count > 0) {
        return reply.code(409).send({
          error: `Cannot delete: ${count} account(s) use this package`,
        });
      }

      const deleted = await db
        .delete(packages)
        .where(eq(packages.id, id))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Package not found" });
      }

      return { ok: true };
    }
  );
};
