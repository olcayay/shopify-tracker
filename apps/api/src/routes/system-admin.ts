import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, like } from "drizzle-orm";
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
  appCategoryRankings,
  keywordAdSightings,
  categories,
  categorySnapshots,
  categoryAdSightings,
  accountStarredCategories,
  appPowerScores,
  reviews,
  refreshTokens,
  impersonationAuditLogs,
  researchProjects,
  researchProjectKeywords,
  researchProjectCompetitors,
  accountPlatforms,
  platformVisibility,
} from "@appranks/db";
import { isPlatformId, PLATFORM_IDS } from "@appranks/shared";
import { generateAccessToken } from "./auth.js";
import type { JwtPayload } from "../middleware/auth.js";

type Db = ReturnType<typeof createDb>;

const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

let _backgroundQueue: Queue | null = null;
let _interactiveQueue: Queue | null = null;

function getBackgroundQueue(): Queue {
  if (!_backgroundQueue) {
    _backgroundQueue = new Queue(BACKGROUND_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _backgroundQueue;
}

function getInteractiveQueue(): Queue {
  if (!_interactiveQueue) {
    _interactiveQueue = new Queue(INTERACTIVE_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _interactiveQueue;
}

/** @deprecated Use getBackgroundQueue() or getInteractiveQueue() */
function getScraperQueue(): Queue {
  return getBackgroundQueue();
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

        const [researchProjectsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(researchProjects)
          .where(eq(researchProjects.accountId, account.id));

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
            account.maxUsers !== pkg.maxUsers ||
            account.maxResearchProjects !== pkg.maxResearchProjects
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
            researchProjects: researchProjectsCount.count,
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
        appSlug: apps.slug,
        appName: apps.name,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_id = ${accountTrackedApps.appId}
        )`,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
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
        appSlug: apps.slug,
        appName: apps.name,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_id = ${accountCompetitorApps.competitorAppId}
        )`,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
      .where(eq(accountCompetitorApps.accountId, id));

    const trackedFeaturesList = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, id));

    const [researchProjectsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchProjects)
      .where(eq(researchProjects.accountId, id));

    // Attach package info
    let pkg = null;
    if (account.packageId) {
      const [found] = await db.select().from(packages).where(eq(packages.id, account.packageId));
      pkg = found ?? null;
    }

    // Enabled platforms with override info
    const enabledPlatformsList = await db
      .select({
        platform: accountPlatforms.platform,
        overrideGlobalVisibility: accountPlatforms.overrideGlobalVisibility,
      })
      .from(accountPlatforms)
      .where(eq(accountPlatforms.accountId, id));

    return {
      ...account,
      package: pkg,
      members,
      trackedApps: trackedAppsList,
      trackedKeywords: trackedKeywordsList,
      competitorApps: competitorAppsList,
      trackedFeatures: trackedFeaturesList,
      researchProjects: researchProjectsCount.count,
      enabledPlatforms: enabledPlatformsList.map((p) => p.platform),
      platformOverrides: enabledPlatformsList.reduce((acc, p) => {
        acc[p.platform] = p.overrideGlobalVisibility;
        return acc;
      }, {} as Record<string, boolean>),
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
        maxResearchProjects?: number;
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
          updates.maxResearchProjects = pkg.maxResearchProjects;
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
      if (body.maxResearchProjects !== undefined)
        updates.maxResearchProjects = body.maxResearchProjects;

      const [updated] = await db
        .update(accounts)
        .set(updates)
        .where(eq(accounts.id, id))
        .returning();

      return updated;
    }
  );

  // POST /api/system-admin/accounts/:id/platforms — enable a platform for account
  app.post<{ Params: { id: string } }>(
    "/accounts/:id/platforms",
    async (request, reply) => {
      const { id } = request.params;
      const { platform } = request.body as { platform?: string };

      if (!platform || !isPlatformId(platform)) {
        return reply.code(400).send({ error: "Valid platform is required" });
      }

      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, id));

      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }

      await db
        .insert(accountPlatforms)
        .values({ accountId: id, platform })
        .onConflictDoNothing();

      // Return updated platform list
      const platforms = await db
        .select({ platform: accountPlatforms.platform })
        .from(accountPlatforms)
        .where(eq(accountPlatforms.accountId, id));

      return { enabledPlatforms: platforms.map((p) => p.platform) };
    }
  );

  // DELETE /api/system-admin/accounts/:id/platforms/:platform — disable a platform
  app.delete<{ Params: { id: string; platform: string } }>(
    "/accounts/:id/platforms/:platform",
    async (request, reply) => {
      const { id, platform } = request.params;

      await db
        .delete(accountPlatforms)
        .where(
          and(
            eq(accountPlatforms.accountId, id),
            eq(accountPlatforms.platform, platform)
          )
        );

      const platforms = await db
        .select({ platform: accountPlatforms.platform })
        .from(accountPlatforms)
        .where(eq(accountPlatforms.accountId, id));

      return { enabledPlatforms: platforms.map((p) => p.platform) };
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
        const queue = getBackgroundQueue();
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
        researchProjectCount: sql<number>`(SELECT count(*)::int FROM research_projects WHERE created_by = ${users.id})`,
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
        appSlug: apps.slug,
        appName: apps.name,
        createdAt: accountTrackedApps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_id = "account_tracked_apps"."app_id"
        )`,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
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
        appSlug: apps.slug,
        appName: apps.name,
        createdAt: accountCompetitorApps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_id = "account_competitor_apps"."competitor_app_id"
        )`,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
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
        const queue = getBackgroundQueue();
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
    const { type, triggeredBy: triggerFilter, queue: queueFilter, platform: platformFilter, limit = "20", offset = "0" } = request.query as {
      type?: string;
      triggeredBy?: string;
      queue?: string;
      platform?: string;
      limit?: string;
      offset?: string;
    };

    const conditions = [];
    if (type) {
      conditions.push(eq(scrapeRuns.scraperType, type as any));
    }
    if (triggerFilter === "scheduler") {
      conditions.push(eq(scrapeRuns.triggeredBy, "scheduler"));
    } else if (triggerFilter === "manual") {
      conditions.push(sql`${scrapeRuns.triggeredBy} IS NOT NULL AND ${scrapeRuns.triggeredBy} != 'scheduler'`);
    }
    if (queueFilter && ["interactive", "background"].includes(queueFilter)) {
      conditions.push(eq(scrapeRuns.queue, queueFilter));
    }
    if (platformFilter) {
      conditions.push(eq(scrapeRuns.platform, platformFilter));
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
              .select({ appId: appSnapshots.appId })
              .from(appSnapshots)
              .where(eq(appSnapshots.scrapeRunId, run.id));
            if (snapshots.length > 0) {
              const appRows = await db
                .select({ id: apps.id, slug: apps.slug, name: apps.name })
                .from(apps)
                .where(
                  inArray(apps.id, snapshots.map((s) => s.appId))
                );
              const idToApp = new Map(appRows.map((a) => [a.id, a]));
              assets = snapshots.map((s) => {
                const appInfo = idToApp.get(s.appId);
                return {
                  name: appInfo?.name || `app#${s.appId}`,
                  href: `/apps/${appInfo?.slug || s.appId}`,
                };
              });
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
                categorySlug: categories.slug,
                title: categories.title,
              })
              .from(categorySnapshots)
              .leftJoin(categories, eq(categories.id, categorySnapshots.categoryId))
              .where(eq(categorySnapshots.scrapeRunId, run.id))
              .limit(10);
            assets = snapshots.map((s) => ({
              name: s.title || s.categorySlug || "unknown",
              href: `/categories/${s.categorySlug || "unknown"}`,
            }));
          }
        }

        return { ...run, assets };
      })
    );

    return { runs: enriched, total };
  });

  // GET /api/system-admin/scraper/queue — queue status (both queues)
  app.get("/scraper/queue", async () => {
    async function getQueueStatus(queue: Queue, queueLabel: string) {
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
            queue: queueLabel,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...waiting.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "waiting" as const,
            queue: queueLabel,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...delayed.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "delayed" as const,
            queue: queueLabel,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            data: j.data,
          })),
          ...failed.map((j) => ({
            id: j.id,
            type: j.data?.type,
            status: "failed" as const,
            queue: queueLabel,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            failedReason: j.failedReason,
            data: j.data,
          })),
        ],
      };
    }

    const emptyQueue = { isPaused: false, counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }, jobs: [] as any[] };

    try {
      const [background, interactive] = await Promise.all([
        getQueueStatus(getBackgroundQueue(), "background").catch(() => emptyQueue),
        getQueueStatus(getInteractiveQueue(), "interactive").catch(() => emptyQueue),
      ]);

      return {
        // Combined counts for backwards compatibility
        isPaused: background.isPaused && interactive.isPaused,
        counts: {
          waiting: background.counts.waiting + interactive.counts.waiting,
          active: background.counts.active + interactive.counts.active,
          delayed: background.counts.delayed + interactive.counts.delayed,
          failed: background.counts.failed + interactive.counts.failed,
        },
        jobs: [...interactive.jobs, ...background.jobs],
        // Per-queue breakdown
        queues: { background, interactive },
      };
    } catch {
      return { isPaused: false, counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }, jobs: [], queues: { background: emptyQueue, interactive: emptyQueue } };
    }
  });

  // POST /api/system-admin/scraper/queue/pause — pause both queues
  app.post("/scraper/queue/pause", async (_request, reply) => {
    try {
      await Promise.all([
        getBackgroundQueue().pause(),
        getInteractiveQueue().pause(),
      ]);
      return { ok: true, paused: true };
    } catch {
      return reply.code(500).send({ error: "Failed to pause queues" });
    }
  });

  // POST /api/system-admin/scraper/queue/resume — resume both queues
  app.post("/scraper/queue/resume", async (_request, reply) => {
    try {
      await Promise.all([
        getBackgroundQueue().resume(),
        getInteractiveQueue().resume(),
      ]);
      return { ok: true, paused: false };
    } catch {
      return reply.code(500).send({ error: "Failed to resume queues" });
    }
  });

  // DELETE /api/system-admin/scraper/queue/jobs/:jobId — remove a job from either queue
  app.delete<{ Params: { jobId: string } }>(
    "/scraper/queue/jobs/:jobId",
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        // Try both queues
        const bgJob = await getBackgroundQueue().getJob(jobId);
        if (bgJob) { await bgJob.remove(); return { ok: true }; }
        const intJob = await getInteractiveQueue().getJob(jobId);
        if (intJob) { await intJob.remove(); return { ok: true }; }
        return reply.code(404).send({ error: "Job not found" });
      } catch {
        return reply.code(500).send({ error: "Failed to remove job" });
      }
    }
  );

  // DELETE /api/system-admin/scraper/queue/jobs — drain all waiting jobs from both queues
  app.delete("/scraper/queue/jobs", async (_request, reply) => {
    try {
      await Promise.all([
        getBackgroundQueue().drain(),
        getInteractiveQueue().drain(),
      ]);
      return { ok: true };
    } catch {
      return reply.code(500).send({ error: "Failed to drain queues" });
    }
  });

  // DELETE /api/system-admin/scraper/queue/failed — remove all failed jobs from both queues
  app.delete("/scraper/queue/failed", async (_request, reply) => {
    try {
      const [bgFailed, intFailed] = await Promise.all([
        getBackgroundQueue().getFailed(0, 1000),
        getInteractiveQueue().getFailed(0, 1000),
      ]);
      await Promise.all([...bgFailed, ...intFailed].map((j) => j.remove()));
      return { ok: true, removed: bgFailed.length + intFailed.length };
    } catch {
      return reply.code(500).send({ error: "Failed to clear failed jobs" });
    }
  });

  // POST /api/system-admin/scraper/trigger
  app.post("/scraper/trigger", async (request, reply) => {
    const { type, slug, keyword, options, queue: targetQueue, platform: platformParam } = request.body as {
      type?: string;
      slug?: string;
      keyword?: string;
      options?: { pages?: "first" | "all" | number; scrapeAppDetails?: boolean; scrapeReviews?: boolean; force?: boolean };
      queue?: "interactive" | "background";
      platform?: string;
    };
    const validTypes = [
      "category",
      "app_details",
      "keyword_search",
      "reviews",
      "daily_digest",
      "compute_review_metrics",
      "compute_similarity_scores",
      "backfill_categories",
      "compute_app_scores",
    ];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const userEmail = (request as any).user?.email || "api";

    try {
      const queue = targetQueue === "interactive" ? getInteractiveQueue() : getBackgroundQueue();
      const jobData: Record<string, any> = {
        type,
        triggeredBy: userEmail,
      };
      if (platformParam) jobData.platform = platformParam;
      if (slug) jobData.slug = slug;
      if (keyword) jobData.keyword = keyword;
      if (type === "app_details") {
        jobData.options = { ...options, force: true };
      } else if (options) {
        jobData.options = options;
      }
      const job = await queue.add(`scrape:${type}`, jobData);

      app.log.info(`Scraper triggered: ${type}, jobId=${job.id}, by=${userEmail}, queue=${targetQueue || "background"}`);

      return {
        message: `Scraper "${type}" enqueued`,
        jobId: job.id,
        queue: targetQueue || "background",
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
          ...(platformParam && { platform: platformParam }),
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

      // Look up app ID from slug
      const [appRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!appRow) {
        return [];
      }

      const trackedBy = await db
        .select({
          accountId: accountTrackedApps.accountId,
          accountName: accounts.name,
          type: sql<string>`'tracked'`,
        })
        .from(accountTrackedApps)
        .innerJoin(accounts, eq(accounts.id, accountTrackedApps.accountId))
        .where(eq(accountTrackedApps.appId, appRow.id));

      const competitorBy = await db
        .select({
          accountId: accountCompetitorApps.accountId,
          accountName: accounts.name,
          type: sql<string>`'competitor'`,
        })
        .from(accountCompetitorApps)
        .innerJoin(accounts, eq(accounts.id, accountCompetitorApps.accountId))
        .where(eq(accountCompetitorApps.competitorAppId, appRow.id));

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

  // GET /api/system-admin/stats — global system stats (optionally filtered by platform)
  app.get<{ Querystring: { platform?: string } }>("/stats", async (request) => {
    const platform = request.query.platform;

    const [accountCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts);

    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apps)
      .where(platform
        ? and(eq(apps.isTracked, true), eq(apps.platform, platform))
        : eq(apps.isTracked, true));

    const [kwCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackedKeywords)
      .where(platform
        ? and(eq(trackedKeywords.isActive, true), eq(trackedKeywords.platform, platform))
        : eq(trackedKeywords.isActive, true));

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
      .where(platform
        ? and(eq(scrapeRuns.status, "completed" as any), eq(scrapeRuns.platform, platform))
        : eq(scrapeRuns.status, "completed" as any))
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
          ${platform ? sql`AND platform = ${platform}` : sql``}
      ) sub
      WHERE rn <= 3
      GROUP BY scraper_type
    `).then((res: any) => (res as any).rows ?? res);

    const [categoryCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(platform ? eq(categories.platform, platform) : undefined);

    const [researchCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchProjects);

    return {
      accounts: accountCount.count,
      users: userCount.count,
      trackedApps: appCount.count,
      trackedKeywords: kwCount.count,
      trackedFeatures: featuresCount.count,
      totalApps: totalApps.count,
      totalCategories: categoryCount.count,
      researchProjects: researchCount.count,
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

  // GET /api/system-admin/research-projects — all research projects across accounts
  app.get("/research-projects", async () => {
    const rows = await db
      .select({
        id: researchProjects.id,
        name: researchProjects.name,
        accountId: researchProjects.accountId,
        accountName: accounts.name,
        creatorId: researchProjects.createdBy,
        creatorName: users.name,
        keywordCount: sql<number>`(SELECT count(*)::int FROM research_project_keywords WHERE research_project_id = ${researchProjects.id})`,
        competitorCount: sql<number>`(SELECT count(*)::int FROM research_project_competitors WHERE research_project_id = ${researchProjects.id})`,
        createdAt: researchProjects.createdAt,
      })
      .from(researchProjects)
      .innerJoin(accounts, eq(accounts.id, researchProjects.accountId))
      .leftJoin(users, eq(users.id, researchProjects.createdBy))
      .orderBy(desc(researchProjects.createdAt));

    return rows;
  });

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
      maxResearchProjects?: number;
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
        maxResearchProjects: body.maxResearchProjects ?? 1,
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
        maxResearchProjects?: number;
        sortOrder?: number;
      };

      const updates: Record<string, any> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.maxTrackedApps !== undefined) updates.maxTrackedApps = body.maxTrackedApps;
      if (body.maxTrackedKeywords !== undefined) updates.maxTrackedKeywords = body.maxTrackedKeywords;
      if (body.maxCompetitorApps !== undefined) updates.maxCompetitorApps = body.maxCompetitorApps;
      if (body.maxTrackedFeatures !== undefined) updates.maxTrackedFeatures = body.maxTrackedFeatures;
      if (body.maxUsers !== undefined) updates.maxUsers = body.maxUsers;
      if (body.maxResearchProjects !== undefined) updates.maxResearchProjects = body.maxResearchProjects;
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

  // POST /api/system-admin/impersonate/:userId — start impersonation
  app.post<{ Params: { userId: string } }>(
    "/impersonate/:userId",
    async (request, reply) => {
      const { userId: targetUserId } = request.params;
      const adminUser = request.user;

      // Block nested impersonation
      if (adminUser.realAdmin) {
        return reply
          .code(403)
          .send({ error: "Cannot create nested impersonation" });
      }

      // Look up target user
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId));

      if (!targetUser) {
        return reply.code(404).send({ error: "User not found" });
      }

      // Cannot impersonate another system admin
      if (targetUser.isSystemAdmin) {
        return reply
          .code(403)
          .send({ error: "Cannot impersonate another system admin" });
      }

      // Cannot impersonate yourself
      if (targetUser.id === adminUser.userId) {
        return reply
          .code(400)
          .send({ error: "Cannot impersonate yourself" });
      }

      // Build impersonation JWT
      const impersonationPayload: JwtPayload = {
        userId: targetUser.id,
        email: targetUser.email,
        accountId: targetUser.accountId,
        role: targetUser.role,
        isSystemAdmin: true,
        realAdmin: {
          userId: adminUser.userId,
          email: adminUser.email,
          accountId: adminUser.accountId,
        },
      };

      const accessToken = generateAccessToken(impersonationPayload, "30m");

      // Audit log
      await db.insert(impersonationAuditLogs).values({
        adminUserId: adminUser.userId,
        targetUserId: targetUser.id,
        action: "start",
      });

      // Get target account for display
      const [targetAccount] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, targetUser.accountId));

      return {
        accessToken,
        impersonating: {
          userId: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          accountId: targetUser.accountId,
          accountName: targetAccount?.name,
        },
      };
    }
  );

  // POST /api/system-admin/stop-impersonation — stop impersonation
  app.post("/stop-impersonation", async (request, reply) => {
    const { user } = request;

    if (!user.realAdmin) {
      return reply
        .code(400)
        .send({ error: "Not currently impersonating" });
    }

    // Look up real admin user
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.realAdmin.userId));

    if (!adminUser) {
      return reply.code(500).send({ error: "Admin user not found" });
    }

    // Generate normal admin token
    const adminPayload: JwtPayload = {
      userId: adminUser.id,
      email: adminUser.email,
      accountId: adminUser.accountId,
      role: adminUser.role,
      isSystemAdmin: adminUser.isSystemAdmin,
    };

    const accessToken = generateAccessToken(adminPayload);

    // Audit log
    await db.insert(impersonationAuditLogs).values({
      adminUserId: user.realAdmin.userId,
      targetUserId: user.userId,
      action: "stop",
    });

    return {
      accessToken,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        isSystemAdmin: adminUser.isSystemAdmin,
      },
    };
  });

  // DELETE /api/system-admin/categories/:slug — delete a category and all related data
  app.delete<{ Params: { slug: string }; Querystring: { platform?: string } }>(
    "/categories/:slug",
    async (request, reply) => {
      const { slug } = request.params;
      const platform = request.query.platform || "shopify";

      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.platform, platform), eq(categories.slug, slug)));

      if (!cat) return reply.code(404).send({ error: "Category not found" });

      const categoryId = cat.id;

      // Delete related data in FK order
      const starred = await db.delete(accountStarredCategories).where(eq(accountStarredCategories.categoryId, categoryId));
      const adSightings = await db.delete(categoryAdSightings).where(eq(categoryAdSightings.categoryId, categoryId));
      const snapshots = await db.delete(categorySnapshots).where(eq(categorySnapshots.categoryId, categoryId));

      // appCategoryRankings uses string categorySlug — filter by slug + platform via joined apps
      const rankings = await db.execute(sql`
        DELETE FROM app_category_rankings
        WHERE category_slug = ${slug}
          AND app_id IN (SELECT id FROM apps WHERE platform = ${platform})
      `);

      // appPowerScores uses string categorySlug + platform column
      const powerScores = await db.delete(appPowerScores).where(
        and(eq(appPowerScores.categorySlug, slug), eq(appPowerScores.platform, platform))
      );

      // Delete the category itself
      await db.delete(categories).where(eq(categories.id, categoryId));

      return {
        ok: true,
        deleted: {
          category: slug,
          accountStarredCategories: (starred as any).rowCount ?? 0,
          categoryAdSightings: (adSightings as any).rowCount ?? 0,
          categorySnapshots: (snapshots as any).rowCount ?? 0,
          appCategoryRankings: (rankings as any).rowCount ?? 0,
          appPowerScores: (powerScores as any).rowCount ?? 0,
        },
      };
    }
  );

  // POST /api/system-admin/categories/fix-slugs — convert kebab-case slugs to camelCase
  app.post<{ Querystring: { platform?: string } }>(
    "/categories/fix-slugs",
    async (request) => {
      const platform = request.query.platform || "salesforce";

      // Find categories with kebab-case slugs (contain a hyphen)
      const kebabCategories = await db
        .select()
        .from(categories)
        .where(and(eq(categories.platform, platform), like(categories.slug, "%-%")));

      if (kebabCategories.length === 0) {
        return { ok: true, message: "No kebab-case slugs found", fixed: [] };
      }

      const results: Array<{
        oldSlug: string;
        newSlug: string;
        action: "merged" | "renamed";
      }> = [];

      for (const cat of kebabCategories) {
        const camelSlug = kebabToCamelCase(cat.slug);

        // Check if a camelCase version already exists
        const [existing] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.platform, platform), eq(categories.slug, camelSlug)));

        if (existing) {
          // Merge: update FK references to point to existing camelCase category, then delete kebab row
          await db.update(accountStarredCategories)
            .set({ categoryId: existing.id })
            .where(eq(accountStarredCategories.categoryId, cat.id));
          await db.update(categoryAdSightings)
            .set({ categoryId: existing.id })
            .where(eq(categoryAdSightings.categoryId, cat.id));
          await db.update(categorySnapshots)
            .set({ categoryId: existing.id })
            .where(eq(categorySnapshots.categoryId, cat.id));

          // String-based references: update categorySlug
          await db.execute(sql`
            UPDATE app_category_rankings SET category_slug = ${camelSlug}
            WHERE category_slug = ${cat.slug}
              AND app_id IN (SELECT id FROM apps WHERE platform = ${platform})
          `);
          await db.update(appPowerScores)
            .set({ categorySlug: camelSlug })
            .where(and(eq(appPowerScores.categorySlug, cat.slug), eq(appPowerScores.platform, platform)));

          // Delete the kebab-case category row
          await db.delete(categories).where(eq(categories.id, cat.id));

          results.push({ oldSlug: cat.slug, newSlug: camelSlug, action: "merged" });
        } else {
          // Rename in-place: update the slug on categories + all string references
          await db.update(categories).set({ slug: camelSlug }).where(eq(categories.id, cat.id));

          await db.execute(sql`
            UPDATE app_category_rankings SET category_slug = ${camelSlug}
            WHERE category_slug = ${cat.slug}
              AND app_id IN (SELECT id FROM apps WHERE platform = ${platform})
          `);
          await db.update(appPowerScores)
            .set({ categorySlug: camelSlug })
            .where(and(eq(appPowerScores.categorySlug, cat.slug), eq(appPowerScores.platform, platform)));

          results.push({ oldSlug: cat.slug, newSlug: camelSlug, action: "renamed" });
        }
      }

      return { ok: true, fixed: results };
    }
  );

  // ── Platform Visibility ─────────────────────────────────────────────

  // GET /api/system-admin/platform-visibility — get global visibility for all platforms
  app.get("/platform-visibility", async () => {
    const rows = await db.select().from(platformVisibility);
    const result: Record<string, boolean> = {};
    for (const pid of PLATFORM_IDS) {
      const row = rows.find((r) => r.platform === pid);
      result[pid] = row?.isVisible ?? false;
    }
    return result;
  });

  // PATCH /api/system-admin/platform-visibility/:platform — toggle global visibility
  app.patch<{ Params: { platform: string } }>(
    "/platform-visibility/:platform",
    async (request, reply) => {
      const { platform } = request.params;
      if (!isPlatformId(platform)) {
        return reply.code(400).send({ error: "Invalid platform" });
      }
      const { isVisible } = request.body as { isVisible?: boolean };
      if (typeof isVisible !== "boolean") {
        return reply.code(400).send({ error: "isVisible boolean is required" });
      }

      await db
        .insert(platformVisibility)
        .values({ platform, isVisible, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformVisibility.platform,
          set: { isVisible, updatedAt: new Date() },
        });

      return { platform, isVisible };
    }
  );

  // PATCH /api/system-admin/accounts/:id/platforms/:platform/override — toggle per-account override
  app.patch<{ Params: { id: string; platform: string } }>(
    "/accounts/:id/platforms/:platform/override",
    async (request, reply) => {
      const { id, platform } = request.params;
      if (!isPlatformId(platform)) {
        return reply.code(400).send({ error: "Invalid platform" });
      }
      const { override } = request.body as { override?: boolean };
      if (typeof override !== "boolean") {
        return reply.code(400).send({ error: "override boolean is required" });
      }

      const result = await db
        .update(accountPlatforms)
        .set({ overrideGlobalVisibility: override })
        .where(
          and(
            eq(accountPlatforms.accountId, id),
            eq(accountPlatforms.platform, platform)
          )
        )
        .returning();

      if (result.length === 0) {
        return reply
          .code(404)
          .send({ error: "Platform not enabled for this account" });
      }

      return { platform, override };
    }
  );
};

/**
 * Convert a kebab-case slug to camelCase.
 * "data-management" → "dataManagement"
 * "customer-service" → "customerService"
 */
function kebabToCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
