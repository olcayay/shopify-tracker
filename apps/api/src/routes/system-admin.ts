import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray, like, gte, lte } from "drizzle-orm";
import { Queue } from "bullmq";
import {
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
  keywordAutoSuggestions,
  aiLogs,
  categoryParents,
  smokeTestResults,
  scrapeItemErrors,
  platformRequests,
  notifications,
  featureFlags,
  accountFeatureFlags,
  appFieldChanges,
  appUpdateLabels,
  appUpdateLabelAssignments,
} from "@appranks/db";
import { isPlatformId, PLATFORM_IDS, SCRAPER_SCHEDULES, getNextRunFromCron, getScheduleIntervalMs, findSchedule, SMOKE_PLATFORMS, SMOKE_CHECKS, BROWSER_PLATFORMS, getSmokeCheck, getSmokePlatform, countTotalSmokeChecks } from "@appranks/shared";
import type { SmokeCheckName } from "@appranks/shared";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { generateAccessToken } from "./auth.js";
import type { JwtPayload } from "../middleware/auth.js";
import { requireIdempotencyKey } from "../middleware/idempotency.js";
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT_AI_LOGS,
} from "../constants.js";


const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";

/**
 * Resolve the correct command and entry file for spawning the scraper CLI.
 * In development (tsx available + src exists): npx tsx src/cli.ts
 * In production (compiled dist): node dist/cli.js
 */
function resolveScraperCommand(scraperDir: string): { cmd: string; entryArgs: string[] } {
  const distCli = path.join(scraperDir, "dist", "cli.js");
  if (fs.existsSync(distCli)) {
    return { cmd: "node", entryArgs: [distCli] };
  }
  // Fallback to tsx for development
  return { cmd: "npx", entryArgs: ["tsx", "src/cli.ts"] };
}
const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";

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
  const db = app.db;

  // GET /api/system-admin/accounts — all accounts with usage stats
  app.get("/accounts", async () => {
    // Single query: all accounts + usage counts + last seen (was N+1: 7 queries per account)
    const accountRows = await db.execute<{
      id: string; name: string; company: string | null; is_suspended: boolean;
      package_id: number | null; created_at: Date;
      max_tracked_apps: number; max_tracked_keywords: number; max_competitor_apps: number;
      max_tracked_features: number; max_users: number; max_research_projects: number; max_platforms: number;
      past_due_since: Date | null;
      tracked_apps_count: number; tracked_keywords_count: number; competitor_apps_count: number;
      tracked_features_count: number; member_count: number; research_projects_count: number;
      last_seen: string | null;
    }>(sql`
      SELECT a.*,
        (SELECT count(*)::int FROM account_tracked_apps WHERE account_id = a.id) AS tracked_apps_count,
        (SELECT count(*)::int FROM account_tracked_keywords WHERE account_id = a.id) AS tracked_keywords_count,
        (SELECT count(*)::int FROM account_competitor_apps WHERE account_id = a.id) AS competitor_apps_count,
        (SELECT count(*)::int FROM account_tracked_features WHERE account_id = a.id) AS tracked_features_count,
        (SELECT count(*)::int FROM users WHERE account_id = a.id) AS member_count,
        (SELECT count(*)::int FROM research_projects WHERE account_id = a.id) AS research_projects_count,
        (SELECT max(last_seen_at) FROM users WHERE account_id = a.id) AS last_seen
      FROM accounts a
    `);

    const packageList = await db.select().from(packages);
    const packageMap = new Map(packageList.map((p) => [p.id, p]));

    return accountRows.map((a) => {
      const pkg = a.package_id ? packageMap.get(a.package_id) : null;
      const hasOverrides = pkg
        ? a.max_tracked_apps !== pkg.maxTrackedApps ||
          a.max_tracked_keywords !== pkg.maxTrackedKeywords ||
          a.max_competitor_apps !== pkg.maxCompetitorApps ||
          a.max_tracked_features !== pkg.maxTrackedFeatures ||
          a.max_users !== pkg.maxUsers ||
          a.max_research_projects !== pkg.maxResearchProjects
        : false;

      return {
        id: a.id,
        name: a.name,
        company: a.company,
        isSuspended: a.is_suspended,
        packageId: a.package_id,
        maxTrackedApps: a.max_tracked_apps,
        maxTrackedKeywords: a.max_tracked_keywords,
        maxCompetitorApps: a.max_competitor_apps,
        maxTrackedFeatures: a.max_tracked_features,
        maxUsers: a.max_users,
        maxResearchProjects: a.max_research_projects,
        maxPlatforms: a.max_platforms,
        pastDueSince: a.past_due_since,
        createdAt: a.created_at,
        packageName: pkg?.name ?? null,
        packageSlug: pkg?.slug ?? null,
        hasLimitOverrides: hasOverrides,
        lastSeen: a.last_seen ?? null,
        usage: {
          trackedApps: a.tracked_apps_count,
          trackedKeywords: a.tracked_keywords_count,
          competitorApps: a.competitor_apps_count,
          trackedFeatures: a.tracked_features_count,
          members: a.member_count,
          researchProjects: a.research_projects_count,
        },
      };
    });
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
        platform: apps.platform,
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
        slug: trackedKeywords.slug,
        platform: trackedKeywords.platform,
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
        platform: apps.platform,
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

    // Feature flags enabled for this account (globally enabled OR per-account override)
    const accountFlags = await db
      .select({
        slug: featureFlags.slug,
        name: featureFlags.name,
        isGloballyEnabled: featureFlags.isEnabled,
        enabledAt: accountFeatureFlags.enabledAt,
      })
      .from(accountFeatureFlags)
      .innerJoin(featureFlags, eq(featureFlags.id, accountFeatureFlags.featureFlagId))
      .where(eq(accountFeatureFlags.accountId, id));

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
      featureFlags: accountFlags,
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

      const userEmail = request.user?.email || "api";

      try {
        const queue = getBackgroundQueue();
        const job = await queue.add("scrape:daily_digest", {
          type: "daily_digest",
          accountId: id,
          triggeredBy: userEmail,
          requestId: request.id,
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
        platform: apps.platform,
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
        slug: trackedKeywords.slug,
        platform: trackedKeywords.platform,
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
        platform: apps.platform,
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

  // PATCH /api/system-admin/users/:id — update user (name, role, suspend)
  app.patch<{ Params: { id: string } }>(
    "/users/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { name?: string; role?: string; isSuspended?: boolean };

      const [user] = await db
        .select({ id: users.id, accountId: users.accountId })
        .from(users)
        .where(eq(users.id, id));

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.role !== undefined && ["owner", "editor", "viewer"].includes(body.role)) {
        updates.role = body.role;
      }
      updates.updatedAt = new Date();

      await db.update(users).set(updates).where(eq(users.id, id));

      // If suspending, update the account
      if (body.isSuspended !== undefined) {
        await db.update(accounts).set({
          isSuspended: body.isSuspended,
          updatedAt: new Date(),
        }).where(eq(accounts.id, user.accountId));
      }

      return { message: "User updated", userId: id };
    }
  );

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

      const userEmail = request.user?.email || "api";

      try {
        const queue = getBackgroundQueue();
        const job = await queue.add("scrape:daily_digest", {
          type: "daily_digest",
          userId: id,
          triggeredBy: userEmail,
          requestId: request.id,
        });

        return {
          message: `Digest email queued for ${user.email}`,
          jobId: job.id,
          queueName: "scraper-jobs-background",
        };
      } catch (err) {
        return reply.code(500).send({ error: "Failed to enqueue digest job" });
      }
    }
  );

  // --- Scraper Control (moved from admin.ts) ---

  // GET /api/system-admin/scraper/health
  app.get("/scraper/health", async () => {
    // 1. Latest run per (platform, scraperType) — completed or failed
    const latestRuns = await db.execute(sql`
      SELECT DISTINCT ON (platform, scraper_type)
        id, platform, scraper_type, status, completed_at, started_at,
        metadata, error, job_id
      FROM scrape_runs
      WHERE status IN ('completed', 'failed')
        AND platform IS NOT NULL
        AND (triggered_by IS NULL OR triggered_by != 'smoke-test')
      ORDER BY platform, scraper_type, completed_at DESC NULLS LAST
    `);

    // 2. Avg + prev duration of last 5 completed runs per (platform, scraperType)
    const durationStats = await db.execute(sql`
      SELECT platform, scraper_type,
        avg(duration_ms)::bigint AS avg_duration_ms,
        (array_agg(duration_ms ORDER BY completed_at DESC))[2] AS prev_duration_ms
      FROM (
        SELECT platform, scraper_type,
          (EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::bigint AS duration_ms,
          completed_at,
          ROW_NUMBER() OVER (PARTITION BY platform, scraper_type ORDER BY completed_at DESC) AS rn
        FROM scrape_runs
        WHERE status = 'completed' AND platform IS NOT NULL
          AND completed_at IS NOT NULL AND started_at IS NOT NULL
          AND (triggered_by IS NULL OR triggered_by != 'smoke-test')
      ) sub
      WHERE rn <= 5
      GROUP BY platform, scraper_type
    `);

    // 3. Currently running (exclude runs older than 2h — likely stuck/orphaned)
    const runningRuns = await db.execute(sql`
      SELECT id, platform, scraper_type, started_at, job_id
      FROM scrape_runs
      WHERE status = 'running' AND platform IS NOT NULL
        AND (triggered_by IS NULL OR triggered_by != 'smoke-test')
        AND started_at > NOW() - INTERVAL '2 hours'
    `);

    // 4. Stale/stuck runs (running > 10 min, likely orphaned)
    const staleRunsResult = await db.execute(sql`
      SELECT id, platform, scraper_type, started_at, triggered_by, job_id,
        (EXTRACT(EPOCH FROM (NOW() - started_at)))::int AS running_secs
      FROM scrape_runs
      WHERE status = 'running' AND platform IS NOT NULL
        AND started_at < NOW() - INTERVAL '10 minutes'
      ORDER BY started_at ASC
      LIMIT 50
    `);

    // 5. Recent failures (last 24h, max 10)
    const recentFailures = await db.execute(sql`
      SELECT id, platform, scraper_type, completed_at, started_at, error, metadata,
        triggered_by, queue, job_id,
        (EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::bigint AS duration_ms
      FROM scrape_runs
      WHERE status = 'failed'
        AND platform IS NOT NULL
        AND completed_at > NOW() - INTERVAL '24 hours'
        AND (triggered_by IS NULL OR triggered_by != 'smoke-test')
      ORDER BY completed_at DESC
      LIMIT 10
    `);

    // Build lookup maps
    const latestMap = new Map<string, any>();
    for (const r of latestRuns as any[]) {
      latestMap.set(`${r.platform}:${r.scraper_type}`, r);
    }

    const durationMap = new Map<string, any>();
    for (const r of durationStats as any[]) {
      durationMap.set(`${r.platform}:${r.scraper_type}`, r);
    }

    const runningMap = new Map<string, any>();
    for (const r of runningRuns as any[]) {
      const key = `${r.platform}:${r.scraper_type}`;
      // Discard orphaned running runs: if a completed/failed run exists with
      // completed_at AFTER this running run's started_at, the run is orphaned
      const latest = latestMap.get(key);
      if (latest?.completed_at && r.started_at) {
        const completedAt = new Date(latest.completed_at).getTime();
        const runningStartedAt = new Date(r.started_at).getTime();
        if (completedAt > runningStartedAt) {
          continue; // Skip orphaned running run
        }
      }
      runningMap.set(key, r);
    }

    // The 5 main columns for the health matrix
    const HEALTH_SCRAPER_TYPES = ["category", "app_details", "keyword_search", "reviews", "compute_app_scores"];

    // Build matrix
    const matrix: any[] = [];
    for (const platformId of PLATFORM_IDS) {
      for (const scraperType of HEALTH_SCRAPER_TYPES) {
        const key = `${platformId}:${scraperType}`;
        const latest = latestMap.get(key);
        const durations = durationMap.get(key);
        const running = runningMap.get(key);
        const schedule = findSchedule(platformId, scraperType);

        let lastRun = null;
        if (latest) {
          const startedAt = latest.started_at ? new Date(latest.started_at).getTime() : null;
          const completedAt = latest.completed_at ? new Date(latest.completed_at).getTime() : null;
          const durationMs = startedAt && completedAt ? completedAt - startedAt : null;
          const meta = latest.metadata as Record<string, unknown> | null;
          lastRun = {
            runId: latest.id as string,
            jobId: (latest.job_id as string) ?? null,
            status: latest.status as string,
            completedAt: latest.completed_at ? new Date(latest.completed_at).toISOString() : null,
            startedAt: latest.started_at ? new Date(latest.started_at).toISOString() : null,
            durationMs,
            itemsScraped: (meta?.items_scraped as number) ?? null,
            itemsFailed: (meta?.items_failed as number) ?? null,
            error: latest.error as string | null,
            fallbackUsed: !!(meta?.fallback_used),
          };
        }

        matrix.push({
          platform: platformId,
          scraperType,
          lastRun,
          avgDurationMs: durations?.avg_duration_ms ?? null,
          prevDurationMs: durations?.prev_duration_ms ?? null,
          currentlyRunning: !!running,
          runningStartedAt: running?.started_at ? new Date(running.started_at).toISOString() : null,
          runningRunId: running?.id ?? null,
          runningJobId: running?.job_id ?? null,
          schedule: schedule
            ? { cron: schedule.cron, nextRunAt: getNextRunFromCron(schedule.cron).toISOString() }
            : null,
        });
      }
    }

    // Compute summary
    let healthy = 0, failed = 0, stale = 0, running = 0, partial = 0, totalScheduled = 0;
    for (const cell of matrix) {
      if (!cell.schedule) continue; // N/A
      totalScheduled++;
      if (cell.currentlyRunning) { running++; continue; }
      if (cell.lastRun?.status === "failed") { failed++; continue; }
      if (cell.lastRun?.completedAt) {
        const age = Date.now() - new Date(cell.lastRun.completedAt).getTime();
        const interval = getScheduleIntervalMs(cell.schedule.cron);
        if (age > interval * 2) { stale++; }
        else if (cell.lastRun.status === "completed" && (cell.lastRun.itemsFailed ?? 0) > 0) { partial++; }
        else { healthy++; }
      } else {
        stale++; // never ran
      }
    }

    // Duration anomalies (>50% deviation)
    const anomalies: any[] = [];
    for (const cell of matrix) {
      if (!cell.lastRun?.durationMs || !cell.avgDurationMs) continue;
      const changePercent = Math.round(((cell.lastRun.durationMs - cell.avgDurationMs) / cell.avgDurationMs) * 100);
      if (Math.abs(changePercent) > 50) {
        anomalies.push({
          platform: cell.platform,
          scraperType: cell.scraperType,
          lastDurationMs: cell.lastRun.durationMs,
          avgDurationMs: cell.avgDurationMs,
          changePercent,
        });
      }
    }

    // Fire alert when stale platforms detected
    if (stale > 0) {
      import("../utils/alerts.js").then(({ fireAlert }) => {
        const stalePlatforms = matrix
          .filter((row: any) => Object.values(row.checks).some((c: any) => c?.status === "stale" || c?.status === "never_ran"))
          .map((row: any) => row.platform);
        fireAlert({
          severity: "warning",
          event: "scraper_stale_data",
          message: `${stale} scraper check(s) have stale data`,
          metadata: { staleCount: stale, platforms: stalePlatforms },
        });
      }).catch(() => {});
    }

    return {
      matrix,
      summary: { healthy, failed, stale, running, partial, totalScheduled },
      recentFailures: (recentFailures as any[]).map((r: any) => {
        const meta = r.metadata as Record<string, unknown> | null;
        return {
          id: r.id,
          platform: r.platform,
          scraperType: r.scraper_type,
          completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
          startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
          error: r.error,
          durationMs: r.duration_ms ? Number(r.duration_ms) : null,
          itemsScraped: (meta?.items_scraped as number) ?? null,
          itemsFailed: (meta?.items_failed as number) ?? null,
          triggeredBy: r.triggered_by,
          queue: r.queue,
          jobId: r.job_id,
        };
      }),
      anomalies,
      staleRuns: (staleRunsResult as any[]).map((r: any) => ({
        id: r.id,
        platform: r.platform,
        scraperType: r.scraper_type,
        startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
        runningSecs: r.running_secs,
        triggeredBy: r.triggered_by,
        jobId: r.job_id,
      })),
    };
  });

  // POST /api/system-admin/scraper/runs/:id/kill — mark stale run as failed
  app.post<{ Params: { id: string } }>("/scraper/runs/:id/kill", async (request, reply) => {
    const { id } = request.params;
    const result = await db.execute(
      sql`UPDATE scrape_runs SET status = 'failed', error = 'killed by admin', completed_at = NOW() WHERE id = ${id}::uuid AND status = 'running' RETURNING id`
    );
    if ((result as any[]).length === 0) {
      return reply.code(404).send({ error: "Run not found or not running" });
    }
    return { success: true, id };
  });

  // GET /api/system-admin/scraper/smoke-test — SSE endpoint that runs smoke test checks
  // Optional query params for partial runs:
  //   ?platform=canva         → row: all checks for one platform
  //   ?check=categories       → column: one check across all platforms
  //   ?platform=canva&check=categories → cell: single check
  app.get("/scraper/smoke-test", async (request, reply) => {
    const scraperDir = path.resolve(import.meta.dirname, "../../../scraper");
    const query = request.query as { platform?: string; check?: string };
    const filterPlatform = query.platform || null;
    const filterCheck = (query.check as SmokeCheckName) || null;

    // SSE headers — must include CORS manually since reply.raw bypasses Fastify pipeline
    const origin = request.headers.origin || "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    });

    let aborted = false;
    const activeProcesses: ChildProcess[] = [];

    request.raw.on("close", () => {
      aborted = true;
      for (const proc of activeProcesses) {
        try { proc.kill("SIGTERM"); } catch {}
      }
    });

    function sendEvent(event: string, data: unknown) {
      if (aborted) return;
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    // Build check list, applying optional filters
    interface CheckJob {
      platform: string;
      check: SmokeCheckName;
      arg?: string;
      timeoutSec: number;
      isBrowser: boolean;
    }
    const jobs: CheckJob[] = [];
    for (const sp of SMOKE_PLATFORMS) {
      if (filterPlatform && sp.platform !== filterPlatform) continue;
      for (const c of sp.checks) {
        if (filterCheck && c.check !== filterCheck) continue;
        jobs.push({
          platform: sp.platform,
          check: c.check,
          arg: c.arg,
          timeoutSec: sp.timeoutSec,
          isBrowser: sp.clientType === "browser",
        });
      }
    }

    sendEvent("init", {
      totalChecks: jobs.length,
      platforms: SMOKE_PLATFORMS.map((p) => p.platform),
      checks: SMOKE_CHECKS,
      ...(filterPlatform ? { filterPlatform } : {}),
      ...(filterCheck ? { filterCheck } : {}),
    });

    // Concurrency control: max 6 total, max 2 browser
    const MAX_CONCURRENT = 6;
    const MAX_BROWSER = 2;
    let runningTotal = 0;
    let runningBrowser = 0;
    let completed = 0;
    let passed = 0;
    let failed = 0;
    const startTime = Date.now();

    function runCheck(job: CheckJob): Promise<void> {
      return new Promise((resolve) => {
        if (aborted) {
          resolve();
          return;
        }

        sendEvent("start", { platform: job.platform, check: job.check });

        const { cmd, entryArgs } = resolveScraperCommand(scraperDir);
        const args = [...entryArgs, "--platform", job.platform, job.check];
        if (job.arg) {
          // Split arg by spaces for CLI (e.g. "email marketing" → ["email", "marketing"])
          // But some args have special flags like "sales --pages 3"
          args.push(...job.arg.split(" "));
        }

        const checkStart = Date.now();
        const proc = spawn(cmd, args, {
          cwd: scraperDir,
          timeout: job.timeoutSec * 1000,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, SMOKE_TEST: "1" },
        });
        activeProcesses.push(proc);

        let stdout = "";
        let stderr = "";
        // Guard: Node.js may fire both "error" and "close" (e.g. ENOENT).
        // Only handle the first event to avoid double-counting.
        let settled = false;
        let spawnError: Error | null = null;

        proc.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
          // Limit captured output
          if (stdout.length > 10_000) stdout = stdout.slice(-10_000);
        });

        proc.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
          if (stderr.length > 10_000) stderr = stderr.slice(-10_000);
        });

        function finish(code: number | null, err?: Error) {
          if (settled) return;
          settled = true;

          const idx = activeProcesses.indexOf(proc);
          if (idx >= 0) activeProcesses.splice(idx, 1);

          const durationMs = Date.now() - checkStart;
          const status = code === 0 ? "pass" : "fail";
          const output = (stdout + "\n" + stderr).trim().slice(-5000);

          completed++;
          if (status === "pass") passed++;
          else failed++;

          let error: string | undefined;
          if (status === "fail") {
            if (err) error = err.message;
            else if (spawnError) error = spawnError.message;
            else if (code === null) error = "timeout";
            else error = `exit code ${code}`;
          }

          // Extract traceId from CLI output for log correlation
          const traceIdMatch = output.match(/"traceId"\s*:\s*"([^"]+)"/);
          const traceId = traceIdMatch?.[1] ?? undefined;

          sendEvent("complete", {
            platform: job.platform,
            check: job.check,
            status,
            durationMs,
            output,
            ...(error ? { error } : {}),
            ...(traceId ? { traceId } : {}),
          });

          // Persist result to DB
          db.insert(smokeTestResults)
            .values({
              platform: job.platform,
              checkName: job.check,
              status,
              durationMs,
              error: error ?? null,
              output: output.slice(-5000),
              traceId: traceId ?? null,
            })
            .then(
              () => {},
              (err) => app.log.error(`Failed to persist smoke test result: ${err.message}`)
            );

          resolve();
        }

        // Capture spawn error — "close" usually follows, but add a safety fallback
        proc.on("error", (err) => {
          spawnError = err;
          // If "close" doesn't fire within 1s after "error", settle here
          setTimeout(() => finish(null, err), 1000);
        });

        proc.on("close", (code) => {
          finish(code);
        });
      });
    }

    // Process jobs with concurrency limits
    let jobIndex = 0;

    async function scheduleNext(): Promise<void> {
      while (jobIndex < jobs.length && !aborted) {
        if (runningTotal >= MAX_CONCURRENT) break;
        const job = jobs[jobIndex];
        if (job.isBrowser && runningBrowser >= MAX_BROWSER) {
          // Find a non-browser job to run instead
          let foundNonBrowser = false;
          for (let i = jobIndex + 1; i < jobs.length; i++) {
            if (!jobs[i].isBrowser && runningTotal < MAX_CONCURRENT) {
              const swappedJob = jobs[i];
              jobs.splice(i, 1);
              jobs.splice(jobIndex, 0, swappedJob);
              foundNonBrowser = true;
              break;
            }
          }
          if (!foundNonBrowser) break;
          continue;
        }

        const currentJob = jobs[jobIndex++];
        runningTotal++;
        if (currentJob.isBrowser) runningBrowser++;

        runCheck(currentJob).then(() => {
          runningTotal--;
          if (currentJob.isBrowser) runningBrowser--;
          scheduleNext();
        });
      }
    }

    await scheduleNext();

    // Wait for all jobs to complete
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (completed >= jobs.length || aborted) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });

    const totalDurationMs = Date.now() - startTime;
    const na = (SMOKE_PLATFORMS.length * SMOKE_CHECKS.length) - jobs.length;

    sendEvent("summary", { passed, failed, na, totalDurationMs });
    sendEvent("done", {});

    reply.raw.end();
  });

  // POST /api/system-admin/scraper/smoke-test/check — retry a single check
  app.post("/scraper/smoke-test/check", async (request, reply) => {
    const { platform, check } = request.body as { platform: string; check: SmokeCheckName };
    if (!platform || !check) {
      return reply.code(400).send({ error: "platform and check are required" });
    }

    const smokePlatform = getSmokePlatform(platform as any);
    if (!smokePlatform) {
      return reply.code(400).send({ error: `Unknown platform: ${platform}` });
    }

    const smokeCheck = getSmokeCheck(platform as any, check);
    if (!smokeCheck) {
      return reply.code(400).send({ error: `Check ${check} is N/A for ${platform}` });
    }

    const scraperDir = path.resolve(import.meta.dirname, "../../../scraper");
    const { cmd, entryArgs } = resolveScraperCommand(scraperDir);
    const args = [...entryArgs, "--platform", platform, check];
    if (smokeCheck.arg) {
      args.push(...smokeCheck.arg.split(" "));
    }

    const checkStart = Date.now();
    const result = await new Promise<{
      status: "pass" | "fail";
      durationMs: number;
      output: string;
      error?: string;
    }>((resolve) => {
      const proc = spawn(cmd, args, {
        cwd: scraperDir,
        timeout: smokePlatform.timeoutSec * 1000,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, SMOKE_TEST: "1" },
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let spawnError: Error | null = null;

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 10_000) stdout = stdout.slice(-10_000);
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 10_000) stderr = stderr.slice(-10_000);
      });

      function finish(code: number | null, err?: Error) {
        if (settled) return;
        settled = true;
        const durationMs = Date.now() - checkStart;
        const output = (stdout + "\n" + stderr).trim().slice(-5000);
        if (code === 0) {
          resolve({ status: "pass", durationMs, output });
        } else {
          let error: string;
          if (err) error = err.message;
          else if (spawnError) error = spawnError.message;
          else if (code === null) error = "timeout";
          else error = `exit code ${code}`;
          resolve({ status: "fail", durationMs, output, error });
        }
      }

      proc.on("error", (err) => {
        spawnError = err;
        setTimeout(() => finish(null, err), 1000);
      });

      proc.on("close", (code) => {
        finish(code);
      });
    });

    // Extract traceId from CLI output for log correlation
    const traceIdMatch = result.output.match(/"traceId"\s*:\s*"([^"]+)"/);
    const resultTraceId = traceIdMatch?.[1] ?? null;

    // Persist result to DB
    db.insert(smokeTestResults)
      .values({
        platform,
        checkName: check,
        status: result.status,
        durationMs: result.durationMs,
        error: result.error ?? null,
        output: result.output.slice(-5000),
        traceId: resultTraceId,
      })
      .then(
        () => {},
        (err) => app.log.error(`Failed to persist smoke test result: ${err.message}`)
      );

    return { ...result, ...(resultTraceId ? { traceId: resultTraceId } : {}) };
  });

  // GET /api/system-admin/scraper/smoke-test/history
  app.get("/scraper/smoke-test/history", async (_request, reply) => {
    // Get the last 10 results per platform+check using window function
    const rows = await db.execute(sql`
      SELECT platform, check_name, status, error, duration_ms, trace_id, created_at
      FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY platform, check_name
          ORDER BY created_at DESC
        ) AS rn
        FROM smoke_test_results
      ) sub
      WHERE rn <= 10
      ORDER BY platform, check_name, created_at DESC
    `);

    // Aggregate in JS
    const map = new Map<string, {
      platform: string;
      checkName: string;
      passCount: number;
      totalCount: number;
      lastRunAt: string | null;
      lastStatus: string | null;
      lastDurationMs: number | null;
      lastTraceId: string | null;
      recentErrors: { error: string; createdAt: string; durationMs: number | null }[];
    }>();

    for (const row of rows as any[]) {
      const key = `${row.platform}:${row.check_name}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          platform: row.platform,
          checkName: row.check_name,
          passCount: 0,
          totalCount: 0,
          lastRunAt: null,
          lastStatus: null,
          lastDurationMs: null,
          lastTraceId: null,
          recentErrors: [],
        };
        map.set(key, entry);
      }
      entry.totalCount++;
      if (row.status === "pass") entry.passCount++;
      if (!entry.lastRunAt) {
        entry.lastRunAt = row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at);
        entry.lastStatus = row.status;
        entry.lastDurationMs = row.duration_ms;
        entry.lastTraceId = row.trace_id ?? null;
      }
      if (row.status === "fail" && row.error) {
        entry.recentErrors.push({
          error: row.error,
          createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
          durationMs: row.duration_ms,
        });
      }
    }

    return reply.send(Array.from(map.values()));
  });

  // GET /api/system-admin/scraper/runs
  app.get("/scraper/runs", async (request) => {
    const { type, triggeredBy: triggerFilter, queue: queueFilter, platform: platformFilter, status: statusFilter, limit = "20", offset = "0" } = request.query as {
      type?: string;
      triggeredBy?: string;
      queue?: string;
      platform?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const conditions = [];
    // Always exclude smoke-test runs from the dashboard
    conditions.push(sql`(${scrapeRuns.triggeredBy} IS NULL OR ${scrapeRuns.triggeredBy} != 'smoke-test')`);
    if (type) {
      conditions.push(eq(scrapeRuns.scraperType, type as any));
    }
    if (statusFilter === "partial") {
      conditions.push(eq(scrapeRuns.status, "completed"));
      conditions.push(sql`(${scrapeRuns.metadata}->>'items_failed')::int > 0`);
    } else if (statusFilter && ["completed", "failed", "running"].includes(statusFilter)) {
      conditions.push(eq(scrapeRuns.status, statusFilter as "completed" | "failed" | "running"));
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
          const runPlatform = run.platform || "shopify";
          if (run.scraperType === "app_details") {
            const snapshots = await db
              .select({ appId: appSnapshots.appId })
              .from(appSnapshots)
              .where(eq(appSnapshots.scrapeRunId, run.id));
            if (snapshots.length > 0) {
              const appRows = await db
                .select({ id: apps.id, slug: apps.slug, name: apps.name, platform: apps.platform })
                .from(apps)
                .where(
                  inArray(apps.id, snapshots.map((s) => s.appId))
                );
              const idToApp = new Map(appRows.map((a) => [a.id, a]));
              assets = snapshots.map((s) => {
                const appInfo = idToApp.get(s.appId);
                const p = appInfo?.platform || runPlatform;
                return {
                  name: appInfo?.name || `app#${s.appId}`,
                  href: `/${p}/apps/${appInfo?.slug || s.appId}`,
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
                  platform: trackedKeywords.platform,
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
                const p = kw?.platform || runPlatform;
                return {
                  name: kw?.keyword || `keyword#${s.keywordId}`,
                  href: `/${p}/keywords/${kw?.slug || s.keywordId}`,
                };
              });
            }
          } else if (run.scraperType === "category") {
            const snapshots = await db
              .select({
                categorySlug: categories.slug,
                title: categories.title,
                platform: categories.platform,
              })
              .from(categorySnapshots)
              .leftJoin(categories, eq(categories.id, categorySnapshots.categoryId))
              .where(eq(categorySnapshots.scrapeRunId, run.id))
              .limit(10);
            assets = snapshots.map((s) => {
              const p = s.platform || runPlatform;
              return {
                name: s.title || s.categorySlug || "unknown",
                href: `/${p}/categories/${s.categorySlug || "unknown"}`,
              };
            });
          }
        }

        const itemsFailed = (run.metadata as any)?.items_failed ?? 0;
        return { ...run, assets, hasItemErrors: itemsFailed > 0 };
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
      const [bgRemoved, intRemoved] = await Promise.all([
        getBackgroundQueue().clean(0, 1000, "failed"),
        getInteractiveQueue().clean(0, 1000, "failed"),
      ]);
      return { ok: true, removed: bgRemoved.length + intRemoved.length };
    } catch {
      return reply.code(500).send({ error: "Failed to clear failed jobs" });
    }
  });

  // POST /api/system-admin/scraper/runs/:runId/retry — re-enqueue a completed/failed run
  app.post<{ Params: { runId: string } }>(
    "/scraper/runs/:runId/retry",
    async (request, reply) => {
      try {
        const { runId } = request.params;
        const [run] = await db
          .select()
          .from(scrapeRuns)
          .where(eq(scrapeRuns.id, runId));

        if (!run) {
          return reply.code(404).send({ error: "Run not found" });
        }
        if (!["failed", "completed"].includes(run.status)) {
          return reply.code(400).send({ error: `Cannot retry a run with status "${run.status}"` });
        }

        const userEmail = request.user?.email || "api";
        const metadata = (run.metadata || {}) as Record<string, any>;
        const queue = getInteractiveQueue();

        const jobData: Record<string, any> = {
          type: run.scraperType,
          triggeredBy: `retry:${userEmail}`,
        };
        if (run.platform) jobData.platform = run.platform;
        if (metadata.slug) jobData.slug = metadata.slug;
        if (metadata.keyword) jobData.keyword = metadata.keyword;
        if (metadata.options) jobData.options = metadata.options;

        const job = await queue.add(`scrape:${run.scraperType}`, jobData);
        app.log.info(`Retry enqueued: runId=${runId}, newJobId=${job.id}, by=${userEmail}`);

        return {
          message: `Run #${runId} retried`,
          jobId: job.id,
          queue: "interactive",
          status: "queued",
        };
      } catch (err: any) {
        app.log.error(`Failed to retry run: ${err.message}`);
        return reply.code(500).send({ error: "Failed to retry run" });
      }
    }
  );

  // GET /api/system-admin/scraper/runs/:runId/item-errors — per-item error details
  app.get<{ Params: { runId: string } }>(
    "/scraper/runs/:runId/item-errors",
    async (request, reply) => {
      try {
        const { runId } = request.params;
        const errors = await db
          .select()
          .from(scrapeItemErrors)
          .where(eq(scrapeItemErrors.scrapeRunId, runId))
          .orderBy(scrapeItemErrors.createdAt)
          .limit(100);
        return { errors };
      } catch (err: any) {
        app.log.error(`Failed to fetch item errors: ${err.message}`);
        return reply.code(500).send({ error: "Failed to fetch item errors" });
      }
    }
  );

  // POST /api/system-admin/scraper/trigger
  app.post("/scraper/trigger", { preHandler: [requireIdempotencyKey()] }, async (request, reply) => {
    const { type, slug, keyword, options, queue: targetQueue, platform: platformParam } = request.body as {
      type?: string;
      slug?: string;
      keyword?: string;
      options?: { pages?: "first" | "all" | number; scrapeAppDetails?: boolean; scrapeReviews?: boolean; force?: boolean; scope?: "tracked" | "all" };
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
      "data_cleanup",
    ];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const userEmail = request.user?.email || "api";

    try {
      const queue = targetQueue === "interactive" ? getInteractiveQueue() : getBackgroundQueue();
      const jobData: Record<string, any> = {
        type,
        triggeredBy: userEmail,
        requestId: request.id,
      };
      if (platformParam) jobData.platform = platformParam;
      if (slug) jobData.slug = slug;
      if (keyword) jobData.keyword = keyword;
      if (type === "app_details") {
        jobData.options = { ...options, force: options?.force ?? true };
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
    const { tracked, platform } = request.query as { tracked?: string; platform?: string };

    let query = db
      .select({
        slug: apps.slug,
        name: apps.name,
        iconUrl: apps.iconUrl,
        platform: apps.platform,
        isTracked: apps.isTracked,
        createdAt: apps.createdAt,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM app_snapshots
          WHERE app_id = "apps"."id"
        )`,
        trackedByCount: sql<number>`(
          SELECT count(*)::int FROM account_tracked_apps
          WHERE app_id = "apps"."id"
        )`,
        competitorByCount: sql<number>`(
          SELECT count(*)::int FROM account_competitor_apps
          WHERE competitor_app_id = "apps"."id"
        )`,
        lastChangeAt: sql<string | null>`(
          SELECT max(detected_at) FROM app_field_changes
          WHERE app_id = "apps"."id" AND dismiss_reason IS NULL
        )`,
      })
      .from(apps);

    if (tracked === "true") {
      query = query.where(eq(apps.isTracked, true)) as typeof query;
    }
    if (platform) {
      query = query.where(eq(apps.platform, platform)) as typeof query;
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

  // GET /api/system-admin/categories — all categories with stats
  app.get("/categories", async (request) => {
    const { tracked, platform } = request.query as { tracked?: string; platform?: string };

    let query = db
      .select({
        id: categories.id,
        slug: categories.slug,
        title: categories.title,
        platform: categories.platform,
        isTracked: categories.isTracked,
        isListingPage: categories.isListingPage,
        parentSlug: categories.parentSlug,
        categoryLevel: categories.categoryLevel,
        createdAt: categories.createdAt,
        appCount: sql<number | null>`(
          SELECT app_count FROM category_snapshots
          WHERE category_id = "categories"."id"
          ORDER BY scraped_at DESC LIMIT 1
        )`,
        lastScrapedAt: sql<string | null>`(
          SELECT max(scraped_at) FROM category_snapshots
          WHERE category_id = "categories"."id"
        )`,
        starredByCount: sql<number>`(
          SELECT count(*)::int FROM account_starred_categories
          WHERE category_id = "categories"."id"
        )`,
        parentTitle: sql<string | null>`(
          SELECT p.title FROM categories p
          WHERE p.slug = "categories"."parent_slug"
            AND p.platform = "categories"."platform"
          LIMIT 1
        )`,
      })
      .from(categories);

    if (tracked === "true") {
      query = query.where(eq(categories.isTracked, true)) as typeof query;
    }
    if (platform) {
      query = query.where(eq(categories.platform, platform)) as typeof query;
    }

    const rows = await query.orderBy(categories.title);

    // Enrich parentTitle from junction table for multi-parent categories
    try {
      const allJunction = await db
        .select({
          categoryId: categoryParents.categoryId,
          parentTitle: categories.title,
        })
        .from(categoryParents)
        .innerJoin(categories, eq(categories.id, categoryParents.parentCategoryId));

      if (allJunction.length > 0) {
        const parentTitleMap = new Map<number, string[]>();
        for (const jr of allJunction) {
          if (!parentTitleMap.has(jr.categoryId)) parentTitleMap.set(jr.categoryId, []);
          parentTitleMap.get(jr.categoryId)!.push(jr.parentTitle);
        }
        for (const row of rows as any[]) {
          const titles = parentTitleMap.get(row.id);
          if (titles && titles.length > 0) {
            row.parentTitle = titles.sort().join(", ");
          }
        }
      }
    } catch {
      // category_parents table may not exist yet (pre-migration)
    }

    return rows;
  });

  // GET /api/system-admin/categories/:id/accounts — accounts that starred this category
  app.get<{ Params: { id: string } }>(
    "/categories/:id/accounts",
    async (request) => {
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId)) return [];

      const starredBy = await db
        .select({
          accountId: accountStarredCategories.accountId,
          accountName: accounts.name,
          type: sql<string>`'starred'`,
        })
        .from(accountStarredCategories)
        .innerJoin(accounts, eq(accounts.id, accountStarredCategories.accountId))
        .where(eq(accountStarredCategories.categoryId, categoryId));

      return starredBy;
    }
  );

  // GET /api/system-admin/keywords — all tracked keywords with last scraped info + account counts
  app.get("/keywords", async (request) => {
    const { platform } = request.query as { platform?: string };

    let query = db
      .select({
        id: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        slug: trackedKeywords.slug,
        platform: trackedKeywords.platform,
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
      .from(trackedKeywords);

    if (platform) {
      query = query.where(eq(trackedKeywords.platform, platform)) as typeof query;
    }

    const rows = await query.orderBy(trackedKeywords.keyword);

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

  // DELETE /api/system-admin/keywords/:id/data — purge scraped data but keep keyword + account trackings
  app.delete<{ Params: { id: string } }>(
    "/keywords/:id/data",
    async (request, reply) => {
      const keywordId = parseInt(request.params.id, 10);

      const [kw] = await db
        .select({ id: trackedKeywords.id })
        .from(trackedKeywords)
        .where(eq(trackedKeywords.id, keywordId));

      if (!kw) return reply.code(404).send({ error: "Keyword not found" });

      const deletedAutoSuggestions = await db
        .delete(keywordAutoSuggestions)
        .where(eq(keywordAutoSuggestions.keywordId, keywordId))
        .returning({ id: keywordAutoSuggestions.id });

      const deletedAdSightings = await db
        .delete(keywordAdSightings)
        .where(eq(keywordAdSightings.keywordId, keywordId))
        .returning({ id: keywordAdSightings.id });

      const deletedRankings = await db
        .delete(appKeywordRankings)
        .where(eq(appKeywordRankings.keywordId, keywordId))
        .returning({ id: appKeywordRankings.id });

      const deletedSnapshots = await db
        .delete(keywordSnapshots)
        .where(eq(keywordSnapshots.keywordId, keywordId))
        .returning({ id: keywordSnapshots.id });

      return {
        ok: true,
        deleted: {
          snapshots: deletedSnapshots.length,
          rankings: deletedRankings.length,
          adSightings: deletedAdSightings.length,
          autoSuggestions: deletedAutoSuggestions.length,
        },
      };
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

    const [aiLogsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiLogs);

    return {
      accounts: accountCount.count,
      users: userCount.count,
      trackedApps: appCount.count,
      trackedKeywords: kwCount.count,
      trackedFeatures: featuresCount.count,
      totalApps: totalApps.count,
      totalCategories: categoryCount.count,
      researchProjects: researchCount.count,
      aiLogs: aiLogsCount.count,
      latestRuns,
      freshness,
      workerStats,
    };
  });

  // GET /api/system-admin/platform-counts — per-platform counts for apps, keywords, categories
  app.get("/platform-counts", async () => {
    const [appCounts, kwCounts, catCounts] = await Promise.all([
      db.execute<{ platform: string; total: number; tracked: number; scraped: number; competitor: number; last_scraped_at: string | null }>(sql`
        SELECT a.platform,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE a.is_tracked = true)::int AS tracked,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM app_snapshots s WHERE s.app_id = a.id
          ))::int AS scraped,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM account_competitor_apps c WHERE c.app_slug = a.slug AND c.platform = a.platform
          ))::int AS competitor,
          MAX(a.updated_at)::text AS last_scraped_at
        FROM apps a GROUP BY a.platform
      `),
      db.execute<{ platform: string; total: number; active: number; last_scraped_at: string | null }>(sql`
        SELECT tk.platform,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE tk.is_active = true)::int AS active,
          MAX(ks.scraped_at)::text AS last_scraped_at
        FROM tracked_keywords tk
        LEFT JOIN keyword_snapshots ks ON ks.keyword_id = tk.id
        GROUP BY tk.platform
      `),
      db.execute<{ platform: string; total: number; total_apps: number; starred: number }>(sql`
        SELECT c.platform,
          COUNT(*)::int AS total,
          COALESCE(SUM(c.app_count), 0)::int AS total_apps,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM account_starred_categories sc WHERE sc.category_slug = c.slug AND sc.platform = c.platform
          ))::int AS starred
        FROM categories c GROUP BY c.platform
      `),
    ]);

    return { apps: appCounts, keywords: kwCounts, categories: catCounts };
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

  // ── Scraper Enable/Disable ──────────────────────────────────────────

  // GET /api/system-admin/scraper/platforms — return all platform visibility + scraper status
  app.get("/scraper/platforms", async () => {
    const rows = await db.select().from(platformVisibility);
    const result: Array<{ platform: string; isVisible: boolean; scraperEnabled: boolean }> = [];
    for (const pid of PLATFORM_IDS) {
      const row = rows.find((r) => r.platform === pid);
      result.push({
        platform: pid,
        isVisible: row?.isVisible ?? false,
        scraperEnabled: row?.scraperEnabled ?? true,
      });
    }
    return result;
  });

  // PATCH /api/system-admin/scraper/platform/:platform/toggle — toggle scraperEnabled for a platform
  app.patch<{ Params: { platform: string } }>(
    "/scraper/platform/:platform/toggle",
    async (request, reply) => {
      const { platform } = request.params;
      if (!isPlatformId(platform)) {
        return reply.code(400).send({ error: "Invalid platform" });
      }

      // Get current state
      const rows = await db.select().from(platformVisibility).where(eq(platformVisibility.platform, platform));
      const current = rows[0];
      const newState = !(current?.scraperEnabled ?? true);

      await db
        .insert(platformVisibility)
        .values({ platform, isVisible: current?.isVisible ?? false, scraperEnabled: newState, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformVisibility.platform,
          set: { scraperEnabled: newState, updatedAt: new Date() },
        });

      return { platform, scraperEnabled: newState };
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

  // ─── AI Logs ───────────────────────────────────────────────

  // GET /ai-logs — list AI logs with filters + summary stats
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      accountId?: string;
      userId?: string;
      productType?: string;
      status?: string;
      platform?: string;
      tag?: string;
    };
  }>("/ai-logs", async (request) => {
    const db = app.db;
    const {
      limit: limitStr = String(PAGINATION_DEFAULT_LIMIT),
      offset: offsetStr = "0",
      accountId: filterAccountId,
      userId: filterUserId,
      productType,
      status,
      platform,
      tag,
    } = request.query;

    const limit = Math.min(parseInt(limitStr, 10) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT_AI_LOGS);
    const offset = parseInt(offsetStr, 10) || 0;

    const conditions = [];
    if (filterAccountId) conditions.push(eq(aiLogs.accountId, filterAccountId));
    if (filterUserId) conditions.push(eq(aiLogs.userId, filterUserId));
    if (productType) conditions.push(eq(aiLogs.productType, productType));
    if (status) conditions.push(eq(aiLogs.status, status));
    if (platform) conditions.push(eq(aiLogs.platform, platform));
    if (tag) conditions.push(sql`${aiLogs.tags} @> ${JSON.stringify([tag])}::jsonb`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, statsResult] = await Promise.all([
      db
        .select({
          id: aiLogs.id,
          accountId: aiLogs.accountId,
          accountName: accounts.name,
          userId: aiLogs.userId,
          userName: users.name,
          platform: aiLogs.platform,
          productType: aiLogs.productType,
          productId: aiLogs.productId,
          model: aiLogs.model,
          systemPrompt: aiLogs.systemPrompt,
          userPrompt: aiLogs.userPrompt,
          responseContent: aiLogs.responseContent,
          promptTokens: aiLogs.promptTokens,
          completionTokens: aiLogs.completionTokens,
          totalTokens: aiLogs.totalTokens,
          costUsd: aiLogs.costUsd,
          durationMs: aiLogs.durationMs,
          status: aiLogs.status,
          errorMessage: aiLogs.errorMessage,
          tags: aiLogs.tags,
          notes: aiLogs.notes,
          triggerType: aiLogs.triggerType,
          metadata: aiLogs.metadata,
          ipAddress: aiLogs.ipAddress,
          userAgent: aiLogs.userAgent,
          createdAt: aiLogs.createdAt,
        })
        .from(aiLogs)
        .leftJoin(users, eq(aiLogs.userId, users.id))
        .leftJoin(accounts, eq(aiLogs.accountId, accounts.id))
        .where(whereClause)
        .orderBy(desc(aiLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalCost: sql<string>`coalesce(sum(${aiLogs.costUsd}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${aiLogs.totalTokens}), 0)::int`,
          avgDuration: sql<number>`coalesce(avg(${aiLogs.durationMs}), 0)::int`,
        })
        .from(aiLogs)
        .where(whereClause),
    ]);

    return {
      logs,
      stats: statsResult[0] ?? { totalCalls: 0, totalCost: "0", totalTokens: 0, avgDuration: 0 },
    };
  });

  // GET /ai-logs/analytics/timeseries — cost, calls, tokens over time
  app.get<{
    Querystring: { period?: string; days?: string };
  }>("/ai-logs/analytics/timeseries", async (request) => {
    const db = app.db;
    const { period: rawPeriod = "day", days: daysStr = "30" } = request.query;

    const allowedPeriods: Record<string, string> = { daily: "day", weekly: "week", monthly: "month", day: "day", week: "week", month: "month" };
    const period = allowedPeriods[rawPeriod];
    if (!period) {
      return { error: "Invalid period. Use daily, weekly, or monthly." };
    }

    const days = Math.min(parseInt(daysStr, 10) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const data = await db
      .select({
        date: sql<string>`date_trunc(${sql.raw(`'${period}'`)}, ${aiLogs.createdAt})::date::text`.as("date"),
        calls: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${aiLogs.costUsd}), 0)`,
        promptTokens: sql<number>`coalesce(sum(${aiLogs.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${aiLogs.completionTokens}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${aiLogs.totalTokens}), 0)::int`,
        avgDurationMs: sql<number>`coalesce(avg(${aiLogs.durationMs}), 0)::int`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, since))
      .groupBy(sql`date_trunc(${sql.raw(`'${period}'`)}, ${aiLogs.createdAt})`)
      .orderBy(sql`date_trunc(${sql.raw(`'${period}'`)}, ${aiLogs.createdAt}) asc`);

    return { period, days, data };
  });

  // GET /ai-logs/analytics/per-account — usage per account
  app.get<{
    Querystring: { days?: string };
  }>("/ai-logs/analytics/per-account", async (request) => {
    const db = app.db;
    const days = Math.min(parseInt(request.query.days || "30", 10) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const data = await db
      .select({
        accountId: aiLogs.accountId,
        accountName: accounts.name,
        calls: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${aiLogs.costUsd}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${aiLogs.totalTokens}), 0)::int`,
        avgDuration: sql<number>`coalesce(avg(${aiLogs.durationMs}), 0)::int`,
        errorCount: sql<number>`count(*) filter (where ${aiLogs.status} != 'success')::int`,
        lastUsed: sql<string>`max(${aiLogs.createdAt})::text`,
      })
      .from(aiLogs)
      .leftJoin(accounts, eq(aiLogs.accountId, accounts.id))
      .where(gte(aiLogs.createdAt, since))
      .groupBy(aiLogs.accountId, accounts.name)
      .orderBy(sql`coalesce(sum(${aiLogs.costUsd}), 0) desc`);

    return { days, data };
  });

  // PATCH /ai-logs/:id — update tags and/or notes
  app.patch<{ Params: { id: string }; Body: { tags?: string[]; notes?: string } }>(
    "/ai-logs/:id",
    async (request, reply) => {
      const db = app.db;
      const { id } = request.params;
      const { tags, notes } = request.body || {};

      const updates: Record<string, any> = {};
      if (tags !== undefined) updates.tags = tags;
      if (notes !== undefined) updates.notes = notes;

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const [updated] = await db
        .update(aiLogs)
        .set(updates)
        .where(eq(aiLogs.id, id))
        .returning({ id: aiLogs.id });

      if (!updated) return reply.code(404).send({ error: "AI log not found" });
      return updated;
    }
  );

  // GET /api/system-admin/platform-requests — list all platform requests
  app.get("/platform-requests", async () => {
    const rows = await db
      .select({
        id: platformRequests.id,
        platformName: platformRequests.platformName,
        marketplaceUrl: platformRequests.marketplaceUrl,
        notes: platformRequests.notes,
        status: platformRequests.status,
        createdAt: platformRequests.createdAt,
        accountName: accounts.name,
        userName: users.name,
        userEmail: users.email,
      })
      .from(platformRequests)
      .leftJoin(accounts, eq(platformRequests.accountId, accounts.id))
      .leftJoin(users, eq(platformRequests.userId, users.id))
      .orderBy(desc(platformRequests.createdAt));

    return rows;
  });

  // PATCH /api/system-admin/platform-requests/:id — update platform request status
  app.patch<{ Params: { id: string } }>(
    "/platform-requests/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { status?: string };

      if (!body.status || !["pending", "approved", "rejected"].includes(body.status)) {
        return reply.code(400).send({ error: "Invalid status. Must be pending, approved, or rejected." });
      }

      const [updated] = await db
        .update(platformRequests)
        .set({ status: body.status })
        .where(eq(platformRequests.id, id))
        .returning({
          id: platformRequests.id,
          status: platformRequests.status,
        });

      if (!updated) {
        return reply.code(404).send({ error: "Platform request not found" });
      }

      return updated;
    }
  );

  // -------------------------------------------------------------------------
  // Queue monitoring
  // -------------------------------------------------------------------------

  // GET /api/system-admin/queue-stats — BullMQ queue counts for all 5 queues
  app.get("/queue-stats", async () => {
    const backgroundQueue = getBackgroundQueue();
    const interactiveQueue = getInteractiveQueue();

    const [backgroundCounts, interactiveCounts, backgroundPaused, interactivePaused] = await Promise.all([
      backgroundQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      interactiveQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      backgroundQueue.isPaused().catch(() => false),
      interactiveQueue.isPaused().catch(() => false),
    ]);

    // Try to get email/notification queue stats (may not be available in API context)
    let emailInstant = null;
    let emailBulk = null;
    let notifications = null;
    let emailInstantPaused = false;
    let emailBulkPaused = false;
    let notificationsPaused = false;
    try {
      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      const emailInstantQ = new Queue("email-instant", { connection });
      const emailBulkQ = new Queue("email-bulk", { connection });
      const notificationsQ = new Queue("notifications", { connection });

      [emailInstant, emailBulk, notifications] = await Promise.all([
        emailInstantQ.getJobCounts("waiting", "active", "completed", "failed", "delayed").catch(() => null),
        emailBulkQ.getJobCounts("waiting", "active", "completed", "failed", "delayed").catch(() => null),
        notificationsQ.getJobCounts("waiting", "active", "completed", "failed", "delayed").catch(() => null),
      ]);

      [emailInstantPaused, emailBulkPaused, notificationsPaused] = await Promise.all([
        emailInstantQ.isPaused().catch(() => false),
        emailBulkQ.isPaused().catch(() => false),
        notificationsQ.isPaused().catch(() => false),
      ]);

      await Promise.all([emailInstantQ.close(), emailBulkQ.close(), notificationsQ.close()]);
      await connection.quit();
    } catch {
      // Non-critical — email queues may not be accessible
    }

    return {
      background: backgroundCounts,
      interactive: interactiveCounts,
      emailInstant,
      emailBulk,
      notifications,
      paused: {
        background: backgroundPaused,
        interactive: interactivePaused,
        emailInstant: emailInstantPaused,
        emailBulk: emailBulkPaused,
        notifications: notificationsPaused,
      },
    };
  });

  // ── Queue Job Inspector (PLA-717) ─────────────────────────────────

  const QUEUE_MAP: Record<string, string> = {
    background: "scraper-jobs-background",
    interactive: "scraper-jobs-interactive",
    "email-instant": "email-instant",
    "email-bulk": "email-bulk",
    notifications: "notifications",
  };

  // GET /api/system-admin/queue-jobs?queue=email-instant&state=all&limit=50&offset=0
  app.get("/queue-jobs", async (request, reply) => {
    const { queue: queueKey, state, limit: limitStr, offset: offsetStr } = request.query as {
      queue?: string;
      state?: string;
      limit?: string;
      offset?: string;
    };

    if (!queueKey || !QUEUE_MAP[queueKey]) {
      return reply.code(400).send({
        error: `Invalid queue. Valid queues: ${Object.keys(QUEUE_MAP).join(", ")}`,
      });
    }

    const validStates = ["waiting", "active", "completed", "failed", "delayed"];
    const limit = Math.min(parseInt(limitStr || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(offsetStr || "0", 10) || 0, 0);

    // "all" or empty → fetch all states; otherwise filter to one state
    const statesToFetch = (!state || state === "all")
      ? validStates
      : validStates.includes(state) ? [state] : validStates;

    const { Queue } = await import("bullmq");
    const Redis = (await import("ioredis")).default;
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

    try {
      const q = new Queue(QUEUE_MAP[queueKey], { connection });

      // Fetch jobs from each requested state
      const allJobs: { job: any; state: string }[] = [];
      for (const s of statesToFetch) {
        const jobs = await q.getJobs([s as any], 0, 199); // fetch up to 200 per state
        for (const job of jobs) {
          allJobs.push({ job, state: s });
        }
      }

      // Sort by job ID descending (newest first) as default
      allJobs.sort((a, b) => {
        const idA = parseInt(a.job.id || "0", 10);
        const idB = parseInt(b.job.id || "0", 10);
        return idB - idA;
      });

      // Apply pagination
      const total = allJobs.length;
      const paged = allJobs.slice(offset, offset + limit);

      const result = paged.map(({ job, state: jobState }) => ({
        id: job.id,
        name: job.name,
        state: jobState,
        data: job.data,
        timestamp: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        failedReason: job.failedReason || null,
        attemptsMade: job.attemptsMade,
        opts: {
          delay: job.opts?.delay,
          priority: job.opts?.priority,
          attempts: job.opts?.attempts,
        },
        recipient: job.data?.to || null,
        emailType: job.data?.type || null,
        platform: job.data?.platform || null,
        slug: job.data?.slug || null,
        triggeredBy: job.data?.triggeredBy || null,
        userId: job.data?.userId || null,
      }));

      await q.close();

      return {
        queue: queueKey,
        state: state || "all",
        total,
        offset,
        limit,
        jobs: result,
      };
    } finally {
      await connection.quit();
    }
  });

  // GET /api/system-admin/queue-jobs/:queue/:jobId — single job detail
  app.get<{ Params: { queue: string; jobId: string } }>(
    "/queue-jobs/:queue/:jobId",
    async (request, reply) => {
      const { queue: queueKey, jobId } = request.params;

      if (!QUEUE_MAP[queueKey]) {
        return reply.code(400).send({
          error: `Invalid queue. Valid: ${Object.keys(QUEUE_MAP).join(", ")}`,
        });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(QUEUE_MAP[queueKey], { connection });
        const job = await q.getJob(jobId);

        if (!job) {
          await q.close();
          return reply.code(404).send({ error: "Job not found" });
        }

        const state = await job.getState();
        const logs = await q.getJobLogs(jobId).catch(() => ({ logs: [], count: 0 }));

        const result = {
          id: job.id,
          name: job.name,
          state,
          data: job.data,
          returnvalue: job.returnvalue,
          timestamp: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          failedReason: job.failedReason || null,
          stacktrace: job.stacktrace || [],
          attemptsMade: job.attemptsMade,
          opts: job.opts,
          logs: logs.logs || [],
          // Convenience fields
          recipient: job.data?.to || null,
          emailType: job.data?.type || null,
          platform: job.data?.platform || null,
          userId: job.data?.userId || null,
        };

        await q.close();
        return result;
      } finally {
        await connection.quit();
      }
    }
  );

  // ── Queue Pause/Resume Controls (PLA-874) ─────────────────────────────

  const VALID_QUEUE_NAMES = [
    "scraper-jobs-background",
    "scraper-jobs-interactive",
    "email-instant",
    "email-bulk",
    "notifications",
  ];

  // GET /api/system-admin/queues/:queueName/status — { isPaused: boolean }
  app.get<{ Params: { queueName: string } }>(
    "/queues/:queueName/status",
    async (request, reply) => {
      const { queueName } = request.params;
      if (!VALID_QUEUE_NAMES.includes(queueName)) {
        return reply.code(400).send({
          error: `Invalid queue. Valid queues: ${VALID_QUEUE_NAMES.join(", ")}`,
        });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(queueName, { connection });
        const isPaused = await q.isPaused();
        await q.close();
        return { queueName, isPaused };
      } finally {
        await connection.quit();
      }
    }
  );

  // POST /api/system-admin/queues/:queueName/pause — pause a specific queue
  app.post<{ Params: { queueName: string } }>(
    "/queues/:queueName/pause",
    async (request, reply) => {
      const { queueName } = request.params;
      if (!VALID_QUEUE_NAMES.includes(queueName)) {
        return reply.code(400).send({
          error: `Invalid queue. Valid queues: ${VALID_QUEUE_NAMES.join(", ")}`,
        });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(queueName, { connection });
        await q.pause();
        await q.close();
        return { queueName, isPaused: true };
      } finally {
        await connection.quit();
      }
    }
  );

  // POST /api/system-admin/queues/:queueName/resume — resume a specific queue
  app.post<{ Params: { queueName: string } }>(
    "/queues/:queueName/resume",
    async (request, reply) => {
      const { queueName } = request.params;
      if (!VALID_QUEUE_NAMES.includes(queueName)) {
        return reply.code(400).send({
          error: `Invalid queue. Valid queues: ${VALID_QUEUE_NAMES.join(", ")}`,
        });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(queueName, { connection });
        await q.resume();
        await q.close();
        return { queueName, isPaused: false };
      } finally {
        await connection.quit();
      }
    }
  );

  // POST /api/system-admin/email-preview — render email template from type + payload
  app.post("/email-preview", async (request, reply) => {
    const { type, payload } = request.body as {
      type: string;
      payload: Record<string, unknown>;
    };

    if (!type || !payload) {
      return reply.code(400).send({ error: "type and payload are required" });
    }

    try {
      // Dynamic import from scraper's compiled templates (same Docker image)
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- cross-package import resolved at runtime in Docker
      // @ts-ignore -- cross-package runtime import resolved in Docker, not available at typecheck in CI
      const { templateRenderers } = await import(/* @vite-ignore */ "../../../scraper/dist/email/process-instant-email.js") as any;

      const renderer = templateRenderers[type as keyof typeof templateRenderers];
      if (!renderer) {
        return reply.code(404).send({ error: `No template found for type: ${type}` });
      }

      const { subject, html } = renderer(payload);
      return { subject, html };
    } catch (err) {
      // Fallback: try to render a simple preview from payload
      const name = (payload.name || payload.recipientName || "User") as string;
      const subject = `Preview: ${type.replace(/_/g, " ")}`;
      const html = `
        <div style="font-family:sans-serif;padding:24px;max-width:600px;margin:0 auto;">
          <h2>${type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</h2>
          <p>To: ${name}</p>
          <hr/>
          <pre style="font-size:12px;background:#f5f5f5;padding:16px;border-radius:8px;overflow:auto;">${JSON.stringify(payload, null, 2)}</pre>
          <p style="color:#999;font-size:11px;">Template preview unavailable — showing raw payload.</p>
        </div>
      `;
      return { subject, html, fallback: true };
    }
  });

  // POST /api/system-admin/email-test — render + send test email to admin
  app.post("/email-test", async (request, reply) => {
    const { type, payload } = request.body as {
      type: string;
      payload: Record<string, unknown>;
    };

    if (!type || !payload) {
      return reply.code(400).send({ error: "type and payload are required" });
    }

    // Render template
    let subject: string;
    let html: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- cross-package import resolved at runtime in Docker
      // @ts-ignore -- cross-package runtime import resolved in Docker, not available at typecheck in CI
      const { templateRenderers } = await import(/* @vite-ignore */ "../../../scraper/dist/email/process-instant-email.js") as any;
      const renderer = templateRenderers[type as keyof typeof templateRenderers];
      if (!renderer) {
        return reply.code(404).send({ error: `No template for: ${type}` });
      }
      const result = renderer(payload);
      subject = `[TEST] ${result.subject}`;
      html = result.html;
    } catch {
      return reply.code(500).send({ error: "Template rendering failed" });
    }

    // Send to admin's email
    const adminEmail = request.user?.email || process.env.ADMIN_EMAIL || "admin@appranks.io";

    try {
      // Send directly via nodemailer (avoid cross-package import)
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      const info = await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject,
        html,
      });
      return { sent: true, to: adminEmail, subject, messageId: info.messageId };
    } catch (err: any) {
      return reply.code(500).send({
        error: "Send failed",
        details: err?.message || String(err),
      });
    }
  });

  // POST /api/system-admin/notification-test — create a test notification for the admin user
  app.post("/notification-test", async (request, reply) => {
    const { type, variables } = request.body as {
      type: string;
      variables?: Record<string, string>;
    };

    if (!type) {
      return reply.code(400).send({ error: "type is required" });
    }

    const userId = request.user.userId;
    const accountId = request.user.accountId;

    try {
      // Build title and body from template variables
      const vars = variables || {};
      // Use the shared template engine to build content
      let title = `[TEST] ${type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`;
      let body = `Test notification for type: ${type}`;
      let url: string | null = null;
      let category = type.split("_")[0] || "system";

      // Try to use shared notification templates for realistic content
      try {
        const shared = await import("@appranks/shared");
        const templates = (shared as any).TEMPLATES;
        if (templates && templates[type]) {
          const content = templates[type](vars);
          title = `[TEST] ${content.title}`;
          body = content.body;
          url = content.url;
          category = type.split("_")[0] || "system";
        }
      } catch {
        // Shared templates not available — use fallback above
      }

      // Insert directly into notifications table
      const [notif] = await db
        .insert(notifications)
        .values({
          userId,
          accountId,
          type,
          category,
          title,
          body,
          url,
          priority: "normal",
          eventData: { ...vars, isTest: true },
        })
        .returning({ id: notifications.id });

      return { sent: true, notificationId: notif.id, title, body };
    } catch (err: any) {
      return reply.code(500).send({
        error: "Failed to create test notification",
        details: err?.message || String(err),
      });
    }
  });

  // POST /api/system-admin/queue-jobs/:queue/:jobId/retry — retry a failed job
  app.post<{ Params: { queue: string; jobId: string } }>(
    "/queue-jobs/:queue/:jobId/retry",
    async (request, reply) => {
      const { queue: queueKey, jobId } = request.params;
      if (!QUEUE_MAP[queueKey]) {
        return reply.code(400).send({ error: "Invalid queue" });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(QUEUE_MAP[queueKey], { connection });
        const job = await q.getJob(jobId);
        if (!job) { await q.close(); return reply.code(404).send({ error: "Job not found" }); }

        const state = await job.getState();
        if (state !== "failed") { await q.close(); return reply.code(409).send({ error: `Job is ${state}, not failed` }); }

        await job.retry();
        await q.close();
        return { success: true, message: "Job retried" };
      } finally {
        await connection.quit();
      }
    }
  );

  // DELETE /api/system-admin/queue-jobs/:queue/:jobId — remove a job
  app.delete<{ Params: { queue: string; jobId: string } }>(
    "/queue-jobs/:queue/:jobId",
    async (request, reply) => {
      const { queue: queueKey, jobId } = request.params;
      if (!QUEUE_MAP[queueKey]) {
        return reply.code(400).send({ error: "Invalid queue" });
      }

      const { Queue } = await import("bullmq");
      const Redis = (await import("ioredis")).default;
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const connection = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const q = new Queue(QUEUE_MAP[queueKey], { connection });
        const job = await q.getJob(jobId);
        if (!job) { await q.close(); return reply.code(404).send({ error: "Job not found" }); }

        await job.remove();
        await q.close();
        return { success: true, message: "Job removed" };
      } finally {
        await connection.quit();
      }
    }
  );

  // ── Circuit Breaker Admin ──────────────────────────────────────────

  // GET /api/system-admin/circuit-breakers — list all platform circuit states
  app.get("/circuit-breakers", async () => {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const Redis = (await import("ioredis")).default;
    const client = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

    try {
      const keys = await client.keys("circuit:*");
      const results: Record<string, unknown>[] = [];
      for (const key of keys) {
        const raw = await client.get(key);
        if (raw) {
          const platform = key.replace("circuit:", "");
          results.push({ platform, ...JSON.parse(raw) });
        }
      }
      return { circuits: results };
    } finally {
      await client.quit();
    }
  });

  // POST /api/system-admin/circuit-breakers/:platform/override — force circuit state
  app.post<{ Params: { platform: string }; Body: { state: string } }>(
    "/circuit-breakers/:platform/override",
    async (request, reply) => {
      const { platform } = request.params;
      const { state } = request.body as { state?: string };

      if (!state || !["closed", "open", "half-open"].includes(state)) {
        return reply.code(400).send({ error: "state must be 'closed', 'open', or 'half-open'" });
      }

      if (!isPlatformId(platform)) {
        return reply.code(400).send({ error: `Invalid platform: ${platform}` });
      }

      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const Redis = (await import("ioredis")).default;
      const client = new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

      try {
        const key = `circuit:${platform}`;
        const data = state === "closed"
          ? { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 }
          : state === "open"
            ? { state: "open", failures: 0, lastFailureAt: Date.now(), openedAt: Date.now() }
            : { state: "half-open", failures: 0, lastFailureAt: 0, openedAt: 0 };

        await client.set(key, JSON.stringify(data), "EX", 86400);
        return { message: `Circuit for ${platform} set to ${state}`, platform, state };
      } finally {
        await client.quit();
      }
    },
  );

  // GET /api/system-admin/email-preview/:type — preview an email template with sample data
  app.get("/email-preview/:type", async (request, reply) => {
    const { type } = request.params as { type: string };

    const sampleData: Record<string, { subject: string; data: Record<string, string> }> = {
      password_reset: {
        subject: "Reset Your Password",
        data: { name: "Jane Doe", resetUrl: "https://appranks.io/reset-password?token=sample", expiryHours: "1" },
      },
      email_verification: {
        subject: "Verify Your Email",
        data: { name: "Jane Doe", verificationUrl: "https://appranks.io/verify-email?token=sample" },
      },
      invitation: {
        subject: "You're Invited to AppRanks",
        data: { inviterName: "John Smith", accountName: "Acme Corp", acceptUrl: "https://appranks.io/invite/accept/sample", role: "editor" },
      },
      login_alert: {
        subject: "New Login to Your Account",
        data: { name: "Jane Doe", device: "Chrome on macOS", ip: "203.0.113.42", location: "Istanbul, Turkey", loginTime: new Date().toISOString(), secureAccountUrl: "https://appranks.io/settings" },
      },
    };

    const sample = sampleData[type];
    if (!sample) {
      return reply.code(404).send({ error: `Unknown template type: ${type}. Available: ${Object.keys(sampleData).join(", ")}` });
    }

    return { type, subject: sample.subject, sampleData: sample.data };
  });

  // POST /api/system-admin/email-test-send — send a test email to the admin
  app.post("/email-test-send", async (request, reply) => {
    const { type } = request.body as { type?: string };
    if (!type) return reply.code(400).send({ error: "type is required" });

    const validTypes = ["email_password_reset", "email_verification", "email_invitation", "email_login_alert", "email_welcome"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({ error: `Invalid type. Valid: ${validTypes.join(", ")}` });
    }

    // Import email enqueue to send a test
    const { Queue } = await import("bullmq");
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const parsed = new URL(redisUrl);
    const queue = new Queue("email-instant", {
      connection: { host: parsed.hostname, port: parseInt(parsed.port || "6379"), password: parsed.password || undefined },
    });

    try {
      const job = await queue.add(`email:${type}:test`, {
        type,
        to: request.user!.email,
        name: request.user!.email.split("@")[0],
        payload: {
          name: "Test User",
          resetUrl: "https://appranks.io/reset-password?token=test",
          verificationUrl: "https://appranks.io/verify-email?token=test",
          inviterName: "Admin",
          accountName: "Test Account",
          acceptUrl: "https://appranks.io/invite/accept/test",
          device: "Test Send",
          ip: "127.0.0.1",
          loginTime: new Date().toISOString(),
          secureAccountUrl: "https://appranks.io/settings",
        },
        createdAt: new Date().toISOString(),
      });

      return { message: `Test email queued for ${request.user!.email}`, jobId: job.id };
    } finally {
      await queue.close();
    }
  });

  // GET /api/system-admin/scraper-stats — success/failure breakdown by platform
  app.get("/scraper-stats", async () => {
    // Last 24h stats by platform
    const stats24h = await db.execute(sql`
      SELECT
        platform,
        status,
        count(*)::int as count,
        round(avg(EXTRACT(EPOCH FROM (ended_at - started_at)))::numeric, 1) as avg_duration_seconds
      FROM scrape_runs
      WHERE started_at > NOW() - INTERVAL '24 hours'
      GROUP BY platform, status
      ORDER BY platform, status
    `) as any[];

    // Last 7d daily totals
    const daily7d = await db.execute(sql`
      SELECT
        date_trunc('day', started_at)::date as day,
        status,
        count(*)::int as count
      FROM scrape_runs
      WHERE started_at > NOW() - INTERVAL '7 days'
      GROUP BY day, status
      ORDER BY day
    `) as any[];

    // Top failure reasons (last 24h)
    const topErrors = await db.execute(sql`
      SELECT
        platform,
        error_message,
        count(*)::int as count
      FROM scrape_item_errors
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY platform, error_message
      ORDER BY count DESC
      LIMIT 20
    `) as any[];

    return { stats24h, daily7d, topErrors };
  });

  // GET /api/system-admin/backup-status — check last backup status
  app.get("/backup-status", async () => {
    const backupDir = process.env.BACKUP_DIR || "/tmp/appranks-backups";
    const maxAgeHours = 26; // Alert if backup is older than 26 hours

    try {
      const { readdirSync, statSync } = await import("fs");
      const files = readdirSync(backupDir)
        .filter((f: string) => f.endsWith(".sql.gz"))
        .sort()
        .reverse();

      if (files.length === 0) {
        return { status: "unknown", message: "No backup files found", backupDir };
      }

      const latest = files[0];
      const stat = statSync(`${backupDir}/${latest}`);
      const ageMs = Date.now() - stat.mtime.getTime();
      const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
      const isStale = ageHours > maxAgeHours;

      return {
        status: isStale ? "stale" : "ok",
        lastBackup: latest,
        lastBackupTime: stat.mtime.toISOString(),
        ageHours,
        sizeBytes: stat.size,
        totalBackups: files.length,
        backupDir,
      };
    } catch {
      return { status: "error", message: "Cannot read backup directory", backupDir };
    }
  });

  // GET /api/system-admin/system-health — extended health info for admin dashboard
  app.get("/system-health", async () => {
    const checks: Record<string, unknown> = {};

    // DB check
    try {
      const [result] = await db.execute(sql`SELECT count(*) as count FROM users`);
      checks.database = { status: "ok", userCount: (result as any)?.count };
    } catch (err) {
      checks.database = { status: "error", error: String(err) };
    }

    // Redis check
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    try {
      const Redis = (await import("ioredis")).default;
      const redis = new Redis(redisUrl, { connectTimeout: 3000, lazyConnect: true });
      await redis.connect();
      const info = await redis.info("memory");
      const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || "unknown";
      const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || "unknown";
      checks.redis = { status: "ok", usedMemory, connectedClients };
      await redis.disconnect();
    } catch (err) {
      checks.redis = { status: "error", error: String(err) };
    }

    // Queue depths (BullMQ)
    try {
      const { Queue } = await import("bullmq");
      const queues = ["scraper-jobs-background", "scraper-jobs-interactive", "email-instant", "notifications"];
      const queueStats: Record<string, unknown> = {};

      for (const name of queues) {
        try {
          const q = new Queue(name, { connection: { host: new URL(redisUrl).hostname, port: parseInt(new URL(redisUrl).port || "6379") } });
          const counts = await q.getJobCounts();
          queueStats[name] = counts;
          await q.close();
        } catch {
          queueStats[name] = { error: "unavailable" };
        }
      }
      checks.queues = queueStats;
    } catch {
      checks.queues = { error: "BullMQ unavailable" };
    }

    // DLQ count
    try {
      const [dlqResult] = await db.execute(sql`SELECT count(*)::int as count FROM dead_letter_jobs`);
      checks.dlq = { count: (dlqResult as any)?.count || 0 };
    } catch {
      checks.dlq = { error: "unavailable" };
    }

    return { timestamp: new Date().toISOString(), checks };
  });

  // GET /api/system-admin/email-health — email system health overview
  app.get("/email-health", async () => {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const result: Record<string, unknown> = {};

    // Queue stats (BullMQ)
    try {
      const { Queue } = await import("bullmq");
      const parsed = new URL(redisUrl);
      const conn = { host: parsed.hostname, port: parseInt(parsed.port || "6379"), password: parsed.password || undefined };

      for (const name of ["email-instant", "email-bulk"]) {
        try {
          const q = new Queue(name, { connection: conn });
          const counts = await q.getJobCounts();
          result[name] = {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
            completed: counts.completed ?? 0,
          };
          await q.close();
        } catch {
          result[name] = { error: "unavailable" };
        }
      }
    } catch {
      result.queues = { error: "BullMQ unavailable" };
    }

    // Email send stats (last 24h from email_logs)
    try {
      const [stats]: any[] = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
          COUNT(*) FILTER (WHERE status = 'complained') AS complained,
          COUNT(*) AS total,
          ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - created_at)) * 1000) FILTER (WHERE sent_at IS NOT NULL), 0) AS avg_send_ms
        FROM email_logs
        WHERE created_at >= now() - interval '24 hours'
      `);
      const row = (stats as any)?.rows?.[0] ?? stats;
      const total = Number(row?.total || 0);
      const sent = Number(row?.sent || 0);
      const failed = Number(row?.failed || 0);
      result.last24h = {
        sent,
        failed,
        bounced: Number(row?.bounced || 0),
        complained: Number(row?.complained || 0),
        total,
        successRate: total > 0 ? Math.round((sent / total) * 10000) / 100 : 100,
        errorRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
        avgSendMs: Number(row?.avg_send_ms || 0),
      };
    } catch {
      result.last24h = { error: "unavailable" };
    }

    // DLQ depth
    try {
      const [dlq]: any[] = await db.execute(sql`
        SELECT count(*)::int AS depth FROM dead_letter_jobs WHERE replayed_at IS NULL
      `);
      const row = (dlq as any)?.rows?.[0] ?? dlq;
      result.dlqDepth = Number(row?.depth || 0);
    } catch {
      result.dlqDepth = 0;
    }

    // Suppression list size
    try {
      const [sup]: any[] = await db.execute(sql`
        SELECT count(*)::int AS count FROM email_suppression_list WHERE removed_at IS NULL
      `);
      const row = (sup as any)?.rows?.[0] ?? sup;
      result.suppressedCount = Number(row?.count || 0);
    } catch {
      result.suppressedCount = 0;
    }

    // Recent errors (last 10)
    try {
      const errors = await db.execute(sql`
        SELECT email_type, recipient_email, error_message, created_at
        FROM email_logs
        WHERE status = 'failed'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      result.recentErrors = (errors as any)?.rows ?? errors;
    } catch {
      result.recentErrors = [];
    }

    // Overall status
    const instantQueue = result["email-instant"] as any;
    const bulkQueue = result["email-bulk"] as any;
    const stats24h = result.last24h as any;
    const dlqDepth = result.dlqDepth as number;

    let status = "healthy";
    if (dlqDepth > 20 || (stats24h?.errorRate ?? 0) > 10) {
      status = "unhealthy";
    } else if (
      (instantQueue?.waiting ?? 0) > 50 ||
      (bulkQueue?.waiting ?? 0) > 200 ||
      dlqDepth > 10 ||
      (stats24h?.errorRate ?? 0) > 5
    ) {
      status = "degraded";
    }

    return {
      timestamp: new Date().toISOString(),
      status,
      sandboxMode: process.env.EMAIL_SANDBOX_MODE === "true",
      sandboxRecipient: process.env.EMAIL_SANDBOX_MODE === "true" ? (process.env.EMAIL_SANDBOX_RECIPIENT || null) : null,
      ...result,
    };
  });

  // GET /api/system-admin/email-health/hourly — hourly email health metrics
  app.get("/email-health/hourly", async (request) => {
    const { hours } = request.query as { hours?: string };
    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 48);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    const hourly = await db.execute(sql`
      SELECT
        date_trunc('hour', created_at)::text AS hour,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
        COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
        ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - created_at)) * 1000) FILTER (WHERE sent_at IS NOT NULL), 0) AS avg_send_ms
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
      GROUP BY 1
      ORDER BY 1
    `);

    const rows = (hourly as any)?.rows ?? hourly;
    const data = (rows as any[]).map((r: any) => ({
      time: r.hour,
      sent: Number(r.sent || 0),
      failed: Number(r.failed || 0),
      bounced: Number(r.bounced || 0),
      skipped: Number(r.skipped || 0),
      avgSendMs: Number(r.avg_send_ms || 0),
    }));

    return { data, hours: lookbackHours };
  });

  // GET /api/system-admin/queue-analytics/hourly — hourly job activity per queue
  app.get("/queue-analytics/hourly", async (request) => {
    const { hours } = request.query as { hours?: string };
    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 48);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    // Scraper queues from scrape_runs
    const scraperRows = await db.execute(sql`
      SELECT
        date_trunc('hour', COALESCE(started_at, created_at))::text AS hour,
        COALESCE(queue, 'background') AS queue,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
      FROM scrape_runs
      WHERE COALESCE(started_at, created_at) >= ${cutoff.toISOString()}
      GROUP BY 1, 2
      ORDER BY 1
    `);

    // Email queues from email_logs
    const emailRows = await db.execute(sql`
      SELECT
        date_trunc('hour', created_at)::text AS hour,
        COUNT(*) FILTER (WHERE status = 'sent') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
      GROUP BY 1
      ORDER BY 1
    `);

    const sRows = (scraperRows as any)?.rows ?? scraperRows;
    const eRows = (emailRows as any)?.rows ?? emailRows;

    // Pivot into chart-friendly format: one row per hour, keys per queue
    const hourMap = new Map<string, Record<string, number>>();

    for (const r of sRows as any[]) {
      const h = r.hour;
      if (!hourMap.has(h)) hourMap.set(h, {});
      const entry = hourMap.get(h)!;
      const qName = r.queue === "interactive" ? "interactive" : "background";
      entry[qName] = Number(r.completed || 0);
      entry[`${qName}_failed`] = Number(r.failed || 0);
    }

    for (const r of eRows as any[]) {
      const h = r.hour;
      if (!hourMap.has(h)) hourMap.set(h, {});
      const entry = hourMap.get(h)!;
      entry["email"] = Number(r.completed || 0);
      entry["email_failed"] = Number(r.failed || 0);
    }

    const data = Array.from(hourMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, counts]) => ({ time, ...counts }));

    return { data, hours: lookbackHours };
  });

  // GET /api/system-admin/audit-logs — impersonation audit log
  app.get(
    "/audit-logs",
    async (request, reply) => {
      const query = request.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || "50", 10)));
      const offset = (page - 1) * limit;

      const logs = await db
        .select({
          id: impersonationAuditLogs.id,
          action: impersonationAuditLogs.action,
          createdAt: impersonationAuditLogs.createdAt,
          adminEmail: sql<string>`(SELECT email FROM users WHERE id = ${impersonationAuditLogs.adminUserId})`,
          targetEmail: sql<string>`(SELECT email FROM users WHERE id = ${impersonationAuditLogs.targetUserId})`,
        })
        .from(impersonationAuditLogs)
        .orderBy(desc(impersonationAuditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(impersonationAuditLogs);

      return { logs, total: count, page, limit };
    },
  );

  // GET /api/system-admin/app-updates — global app field changes across all platforms
  app.get("/app-updates", async (request) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      platform?: string;
      field?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortOrder?: string;
      labelId?: string;
      dismissReason?: string;
    };

    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || "50", 10)));
    const offset = (page - 1) * limit;
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const conditions = [];

    if (query.platform) {
      conditions.push(eq(apps.platform, query.platform));
    }
    if (query.field) {
      conditions.push(eq(appFieldChanges.field, query.field));
    }
    if (query.search) {
      conditions.push(like(apps.name, `%${query.search}%`));
    }
    if (query.dateFrom) {
      conditions.push(gte(appFieldChanges.detectedAt, new Date(query.dateFrom)));
    }
    if (query.dateTo) {
      conditions.push(lte(appFieldChanges.detectedAt, new Date(query.dateTo)));
    }
    if (query.labelId) {
      conditions.push(
        sql`${appFieldChanges.id} IN (
          SELECT change_id FROM app_update_label_assignments WHERE label_id = ${parseInt(query.labelId, 10)}
        )`
      );
    }
    if (query.dismissReason === "none") {
      conditions.push(sql`${appFieldChanges.dismissReason} IS NULL`);
    } else if (query.dismissReason === "any") {
      conditions.push(sql`${appFieldChanges.dismissReason} IS NOT NULL`);
    } else if (query.dismissReason) {
      conditions.push(eq(appFieldChanges.dismissReason, query.dismissReason));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appFieldChanges)
      .innerJoin(apps, eq(appFieldChanges.appId, apps.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: appFieldChanges.id,
        appName: apps.name,
        appSlug: apps.slug,
        platform: apps.platform,
        field: appFieldChanges.field,
        oldValue: appFieldChanges.oldValue,
        newValue: appFieldChanges.newValue,
        detectedAt: appFieldChanges.detectedAt,
        dismissReason: appFieldChanges.dismissReason,
      })
      .from(appFieldChanges)
      .innerJoin(apps, eq(appFieldChanges.appId, apps.id))
      .where(whereClause)
      .orderBy(sortOrder === "asc" ? appFieldChanges.detectedAt : desc(appFieldChanges.detectedAt))
      .limit(limit)
      .offset(offset);

    // Fetch labels for each change in the result set
    const changeIds = rows.map((r) => r.id);
    let labelMap: Record<number, { id: number; name: string; color: string }[]> = {};
    if (changeIds.length > 0) {
      const assignments = await db
        .select({
          changeId: appUpdateLabelAssignments.changeId,
          labelId: appUpdateLabels.id,
          labelName: appUpdateLabels.name,
          labelColor: appUpdateLabels.color,
        })
        .from(appUpdateLabelAssignments)
        .innerJoin(appUpdateLabels, eq(appUpdateLabelAssignments.labelId, appUpdateLabels.id))
        .where(inArray(appUpdateLabelAssignments.changeId, changeIds));

      for (const a of assignments) {
        if (!labelMap[a.changeId]) labelMap[a.changeId] = [];
        labelMap[a.changeId].push({ id: a.labelId, name: a.labelName, color: a.labelColor });
      }
    }

    const data = rows.map((r) => ({
      ...r,
      labels: labelMap[r.id] || [],
    }));

    // Get distinct field names, platforms, and all labels for filter dropdowns
    const [distinctFields, distinctPlatforms, allLabels, distinctDismissReasons] = await Promise.all([
      db
        .selectDistinct({ field: appFieldChanges.field })
        .from(appFieldChanges)
        .orderBy(appFieldChanges.field),
      db
        .selectDistinct({ platform: apps.platform })
        .from(appFieldChanges)
        .innerJoin(apps, eq(appFieldChanges.appId, apps.id))
        .orderBy(apps.platform),
      db
        .select()
        .from(appUpdateLabels)
        .orderBy(appUpdateLabels.name),
      db
        .selectDistinct({ dismissReason: appFieldChanges.dismissReason })
        .from(appFieldChanges)
        .where(sql`${appFieldChanges.dismissReason} IS NOT NULL`)
        .orderBy(appFieldChanges.dismissReason),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        fields: distinctFields.map((r) => r.field),
        platforms: distinctPlatforms.map((r) => r.platform),
        labels: allLabels,
        dismissReasons: distinctDismissReasons.map((r) => r.dismissReason).filter(Boolean) as string[],
      },
    };
  });

  // PATCH /api/system-admin/app-updates/:id/dismiss — set or clear dismiss reason
  app.patch<{ Params: { id: string } }>("/app-updates/:id/dismiss", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const { reason } = request.body as { reason: string | null };
    await db
      .update(appFieldChanges)
      .set({ dismissReason: reason })
      .where(eq(appFieldChanges.id, id));
    return reply.code(200).send({ ok: true });
  });

  // DELETE /api/system-admin/app-updates/:id — permanently delete a single app update
  app.delete<{ Params: { id: string } }>("/app-updates/:id", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    // Delete label assignments first (FK constraint)
    await db.delete(appUpdateLabelAssignments).where(eq(appUpdateLabelAssignments.changeId, id));
    await db.delete(appFieldChanges).where(eq(appFieldChanges.id, id));
    return reply.code(204).send();
  });

  // POST /api/system-admin/app-updates/bulk-delete — permanently delete multiple app updates
  app.post("/app-updates/bulk-delete", async (request, reply) => {
    const { ids } = request.body as { ids: number[] };
    if (!ids || ids.length === 0) {
      return reply.code(400).send({ error: "ids array is required and must not be empty" });
    }
    // Delete label assignments first (FK constraint)
    await db.delete(appUpdateLabelAssignments).where(inArray(appUpdateLabelAssignments.changeId, ids));
    const result = await db.delete(appFieldChanges).where(inArray(appFieldChanges.id, ids));
    return reply.code(200).send({ deleted: ids.length });
  });

  // POST /api/system-admin/app-updates/bulk-dismiss — set dismiss_reason on multiple updates
  app.post("/app-updates/bulk-dismiss", async (request, reply) => {
    const { ids, reason } = request.body as { ids: number[]; reason: string };
    if (!ids || ids.length === 0 || !reason) {
      return reply.code(400).send({ error: "ids array and reason are required" });
    }
    await db
      .update(appFieldChanges)
      .set({ dismissReason: reason })
      .where(inArray(appFieldChanges.id, ids));
    return reply.code(200).send({ updated: ids.length });
  });

  // POST /api/system-admin/app-updates/bulk-restore — clear dismiss_reason on multiple updates
  app.post("/app-updates/bulk-restore", async (request, reply) => {
    const { ids } = request.body as { ids: number[] };
    if (!ids || ids.length === 0) {
      return reply.code(400).send({ error: "ids array is required and must not be empty" });
    }
    await db
      .update(appFieldChanges)
      .set({ dismissReason: null })
      .where(inArray(appFieldChanges.id, ids));
    return reply.code(200).send({ restored: ids.length });
  });

  // -----------------------------------------------------------------------
  // App Update Labels — CRUD
  // -----------------------------------------------------------------------

  // GET /api/system-admin/app-update-labels
  app.get("/app-update-labels", async () => {
    return db.select().from(appUpdateLabels).orderBy(appUpdateLabels.name);
  });

  // POST /api/system-admin/app-update-labels — create a label
  app.post("/app-update-labels", async (request, reply) => {
    const { name, color } = request.body as { name: string; color?: string };
    if (!name || name.trim().length === 0) {
      return reply.code(400).send({ error: "Label name is required" });
    }
    const [label] = await db
      .insert(appUpdateLabels)
      .values({ name: name.trim(), color: color || "#6b7280" })
      .returning();
    return reply.code(201).send(label);
  });

  // DELETE /api/system-admin/app-update-labels/:id
  app.delete<{ Params: { id: string } }>("/app-update-labels/:id", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    await db.delete(appUpdateLabels).where(eq(appUpdateLabels.id, id));
    return reply.code(204).send();
  });

  // POST /api/system-admin/app-updates/:changeId/labels — assign label to a change
  app.post<{ Params: { changeId: string } }>("/app-updates/:changeId/labels", async (request, reply) => {
    const changeId = parseInt(request.params.changeId, 10);
    const { labelId } = request.body as { labelId: number };
    if (!labelId) {
      return reply.code(400).send({ error: "labelId is required" });
    }
    const [assignment] = await db
      .insert(appUpdateLabelAssignments)
      .values({ changeId, labelId })
      .onConflictDoNothing()
      .returning();
    return reply.code(201).send(assignment || { changeId, labelId });
  });

  // DELETE /api/system-admin/app-updates/:changeId/labels/:labelId — remove label from a change
  app.delete<{ Params: { changeId: string; labelId: string } }>(
    "/app-updates/:changeId/labels/:labelId",
    async (request, reply) => {
      const changeId = parseInt(request.params.changeId, 10);
      const labelId = parseInt(request.params.labelId, 10);
      await db
        .delete(appUpdateLabelAssignments)
        .where(
          and(
            eq(appUpdateLabelAssignments.changeId, changeId),
            eq(appUpdateLabelAssignments.labelId, labelId)
          )
        );
      return reply.code(204).send();
    }
  );

  // GET /api/system-admin/apps/delisted — list apps with delisted_at set
  app.get<{
    Querystring: {
      platform?: string;
      search?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
  }>("/apps/delisted", async (request, reply) => {
    const { platform, search, from, to } = request.query;
    const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 200);
    const offset = parseInt(request.query.offset ?? "0", 10);

    if (platform && !isPlatformId(platform)) {
      return reply.code(400).send({ error: "invalid platform" });
    }

    const conds = [sql`${apps.delistedAt} IS NOT NULL`];
    if (platform) conds.push(eq(apps.platform, platform));
    if (search) {
      const pat = `%${search}%`;
      conds.push(sql`(${apps.name} ILIKE ${pat} OR ${apps.slug} ILIKE ${pat})`);
    }
    if (from) conds.push(gte(apps.delistedAt, new Date(from)));
    if (to) conds.push(lte(apps.delistedAt, new Date(to)));

    const where = and(...conds);

    const rows = await db
      .select({
        id: apps.id,
        slug: apps.slug,
        name: apps.name,
        platform: apps.platform,
        iconUrl: apps.iconUrl,
        delistedAt: apps.delistedAt,
      })
      .from(apps)
      .where(where)
      .orderBy(desc(apps.delistedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apps)
      .where(where);

    const ids = rows.map((r) => r.id);
    const snapshotStats = ids.length
      ? await db
          .select({
            appId: appSnapshots.appId,
            lastSnapshotAt: sql<Date>`max(${appSnapshots.scrapedAt})`,
            totalSnapshots: sql<number>`count(*)::int`,
          })
          .from(appSnapshots)
          .where(inArray(appSnapshots.appId, ids))
          .groupBy(appSnapshots.appId)
      : [];
    const statMap = new Map(snapshotStats.map((s) => [s.appId, s]));

    return {
      total: count,
      apps: rows.map((r) => {
        const s = statMap.get(r.id);
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          platform: r.platform,
          icon_url: r.iconUrl,
          delisted_at: r.delistedAt,
          last_snapshot_at: s?.lastSnapshotAt ?? null,
          total_snapshots: s?.totalSnapshots ?? 0,
        };
      }),
    };
  });

  // POST /api/system-admin/apps/:id/mark-relisted — clear delisted_at
  app.post<{ Params: { id: string } }>(
    "/apps/:id/mark-relisted",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }
      const result = await db
        .update(apps)
        .set({ delistedAt: null, updatedAt: new Date() })
        .where(eq(apps.id, id))
        .returning({ id: apps.id, slug: apps.slug });
      if (result.length === 0) {
        return reply.code(404).send({ error: "app not found" });
      }
      return { ok: true, app: result[0] };
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
