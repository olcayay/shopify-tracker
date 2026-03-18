import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, asc, desc, inArray } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Queue } from "bullmq";
import {
  createDb,
  packages,
  accounts,
  users,
  invitations,
  apps,
  appSnapshots,
  trackedKeywords,
  keywordSnapshots,
  keywordToSlug,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountStarredCategories,
  accountTrackedFeatures,
  categories,
  categorySnapshots,
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
  researchProjects,
  categoryParents,
} from "@appranks/db";
import { computeWeightedPowerScore } from "@appranks/shared";
import { requireRole } from "../middleware/authorize.js";
import { getPlatformFromQuery } from "../utils/platform.js";

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
async function enqueueAppScrapeJobs(slug: string, platform: string): Promise<boolean> {
  try {
    const queue = getScraperQueue();
    await queue.add("scrape:app_details", {
      type: "app_details",
      slug,
      platform,
      triggeredBy: "api:track",
    });
    await queue.add("scrape:reviews", {
      type: "reviews",
      slug,
      platform,
      triggeredBy: "api:track",
    });
    return true;
  } catch {
    return false;
  }
}

type Db = ReturnType<typeof createDb>;

/** After adding/removing a tracked app, sync the global isTracked flag */
async function syncAppTrackedFlag(db: Db, appId: number) {
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
async function syncKeywordActiveFlag(db: Db, keywordId: number) {
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

export const accountRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/account — account details + limits + usage
  app.get("/", async (request) => {
    const { accountId } = request.user;

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));

    const [trackedAppsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedApps)
      .where(eq(accountTrackedApps.accountId, accountId));

    const [trackedKeywordsCount] = await db
      .select({ count: sql<number>`count(distinct ${accountTrackedKeywords.keywordId})::int` })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));

    const [competitorAppsCount] = await db
      .select({ count: sql<number>`count(distinct ${accountCompetitorApps.competitorAppId})::int` })
      .from(accountCompetitorApps)
      .where(eq(accountCompetitorApps.accountId, accountId));

    const [starredFeaturesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, accountId));

    const [usersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.accountId, accountId));

    const [researchProjectsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchProjects)
      .where(eq(researchProjects.accountId, accountId));

    // Fetch package details
    let pkg = null;
    if (account.packageId) {
      const [found] = await db.select().from(packages).where(eq(packages.id, account.packageId));
      pkg = found ?? null;
    }

    return {
      id: account.id,
      name: account.name,
      isSuspended: account.isSuspended,
      package: pkg ? { slug: pkg.slug, name: pkg.name } : null,
      packageLimits: pkg
        ? {
            maxTrackedApps: pkg.maxTrackedApps,
            maxTrackedKeywords: pkg.maxTrackedKeywords,
            maxCompetitorApps: pkg.maxCompetitorApps,
            maxUsers: pkg.maxUsers,
            maxResearchProjects: pkg.maxResearchProjects,
          }
        : null,
      limits: {
        maxTrackedApps: account.maxTrackedApps,
        maxTrackedKeywords: account.maxTrackedKeywords,
        maxCompetitorApps: account.maxCompetitorApps,
        maxUsers: account.maxUsers,
        maxResearchProjects: account.maxResearchProjects,
      },
      usage: {
        trackedApps: trackedAppsCount.count,
        trackedKeywords: trackedKeywordsCount.count,
        competitorApps: competitorAppsCount.count,
        starredFeatures: starredFeaturesCount.count,
        users: usersCount.count,
        researchProjects: researchProjectsCount.count,
      },
    };
  });

  // PUT /api/account — update account name and company
  app.put(
    "/",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { name, company } = request.body as { name?: string; company?: string };

      const updates: Record<string, unknown> = {};
      if (typeof name === "string" && name.trim().length > 0) {
        updates.name = name.trim();
      }
      if (typeof company === "string") {
        updates.company = company.trim() || null;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(accounts)
        .set(updates)
        .where(eq(accounts.id, accountId))
        .returning();

      return updated;
    }
  );

  // --- Members ---

  // GET /api/account/members
  app.get("/members", async (request) => {
    const { accountId } = request.user;

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.accountId, accountId));

    return members;
  });

  // POST /api/account/members — create a user directly (owner only)
  app.post(
    "/members",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { email, name, password, role = "viewer" } = request.body as {
        email?: string;
        name?: string;
        password?: string;
        role?: "editor" | "viewer";
      };

      if (!email || !name || !password) {
        return reply.code(400).send({ error: "email, name, and password are required" });
      }

      if (password.length < 8) {
        return reply.code(400).send({ error: "Password must be at least 8 characters" });
      }

      if (!["editor", "viewer"].includes(role)) {
        return reply.code(400).send({ error: "role must be editor or viewer" });
      }

      // Check user limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ memberCount }] = await db
        .select({ memberCount: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountId, accountId));

      if (memberCount >= account.maxUsers) {
        return reply.code(403).send({
          error: "User limit reached",
          current: memberCount,
          max: account.maxUsers,
        });
      }

      // Check if email is already taken
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existingUser) {
        return reply.code(409).send({ error: "User with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          name,
          accountId,
          role: role as "editor" | "viewer",
        })
        .returning();

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
      };
    }
  );

  // POST /api/account/members/invite
  app.post(
    "/members/invite",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId } = request.user;
      const { email, role = "viewer" } = request.body as {
        email?: string;
        role?: "editor" | "viewer";
      };

      if (!email) {
        return reply.code(400).send({ error: "email is required" });
      }

      if (!["editor", "viewer"].includes(role)) {
        return reply
          .code(400)
          .send({ error: "role must be editor or viewer" });
      }

      // Check user limit (members + pending invitations)
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ memberCount }] = await db
        .select({ memberCount: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountId, accountId));

      const [{ pendingCount }] = await db
        .select({ pendingCount: sql<number>`count(*)::int` })
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            sql`${invitations.acceptedAt} IS NULL`,
            sql`${invitations.expiresAt} > NOW()`
          )
        );

      if (memberCount + pendingCount >= account.maxUsers) {
        return reply.code(403).send({
          error: "User limit reached",
          current: memberCount + pendingCount,
          max: account.maxUsers,
        });
      }

      // Check if email is already a member
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existingUser) {
        return reply
          .code(409)
          .send({ error: "User with this email already exists" });
      }

      // Check if there's already a pending invitation for this email
      const [existingInvite] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.accountId, accountId),
            eq(invitations.email, email.toLowerCase()),
            sql`${invitations.acceptedAt} IS NULL`
          )
        );

      if (existingInvite) {
        return reply
          .code(409)
          .send({ error: "An invitation has already been sent to this email" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await db
        .insert(invitations)
        .values({
          accountId,
          email: email.toLowerCase(),
          role: role as "editor" | "viewer",
          invitedByUserId: userId,
          token,
          expiresAt,
        })
        .returning();

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      };
    }
  );

  // GET /api/account/invitations — pending invitations
  app.get(
    "/invitations",
    { preHandler: [requireRole("owner")] },
    async (request) => {
      const { accountId } = request.user;

      const rows = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          token: invitations.token,
          createdAt: invitations.createdAt,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
        })
        .from(invitations)
        .where(eq(invitations.accountId, accountId));

      return rows.map((r) => ({
        ...r,
        expired: r.expiresAt < new Date() && !r.acceptedAt,
        accepted: !!r.acceptedAt,
      }));
    }
  );

  // DELETE /api/account/invitations/:id — cancel/revoke invitation
  app.delete<{ Params: { id: string } }>(
    "/invitations/:id",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      const deleted = await db
        .delete(invitations)
        .where(
          and(eq(invitations.id, id), eq(invitations.accountId, accountId))
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Invitation not found" });
      }

      return { message: "Invitation cancelled" };
    }
  );

  // DELETE /api/account/members/:userId
  app.delete<{ Params: { userId: string } }>(
    "/members/:userId",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId: currentUserId } = request.user;
      const { userId } = request.params;

      if (userId === currentUserId) {
        return reply.code(400).send({ error: "Cannot remove yourself" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user || user.accountId !== accountId) {
        return reply.code(404).send({ error: "User not found in account" });
      }

      await db.delete(users).where(eq(users.id, userId));

      return { message: "User removed" };
    }
  );

  // PATCH /api/account/members/:userId/role
  app.patch<{ Params: { userId: string } }>(
    "/members/:userId/role",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId, userId: currentUserId } = request.user;
      const { userId } = request.params;
      const { role } = request.body as { role?: string };

      if (userId === currentUserId) {
        return reply.code(400).send({ error: "Cannot change your own role" });
      }

      if (!role || !["editor", "viewer"].includes(role)) {
        return reply
          .code(400)
          .send({ error: "role must be editor or viewer" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user || user.accountId !== accountId) {
        return reply.code(404).send({ error: "User not found in account" });
      }

      const [updated] = await db
        .update(users)
        .set({ role: role as "editor" | "viewer", updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      };
    }
  );

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

  // POST /api/account/tracked-apps
  app.post(
    "/tracked-apps",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = request.body as { slug?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      if (!slug) {
        return reply.code(400).send({ error: "slug is required" });
      }

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
          error: "Tracked apps limit reached",
          current: count,
          max: account.maxTrackedApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
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

      const scraperEnqueued = await enqueueAppScrapeJobs(slug, existingApp.platform);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug
  app.delete<{ Params: { slug: string } }>(
    "/tracked-apps/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug
      const [appRow] = await db
        .select({ id: apps.id })
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
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { keyword, trackedAppSlug } = request.body as {
        keyword?: string;
        trackedAppSlug?: string;
      };

      if (!keyword) {
        return reply.code(400).send({ error: "keyword is required" });
      }
      if (!trackedAppSlug) {
        return reply.code(400).send({ error: "trackedAppSlug is required" });
      }

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app ID from slug
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
          error: "Tracked keywords limit reached",
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

      // Add to account tracking with trackedAppId
      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppId: trackedAppRow.id, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Keyword already tracked for this app" });
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
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable — scraper will pick it up on next scheduled run
        }
      }

      return { ...result, keyword: kw.keyword, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-keywords/:id
  app.delete<{ Params: { id: string } }>(
    "/tracked-keywords/:id",
    { preHandler: [requireRole("owner", "editor")] },
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

      return { message: "Keyword removed from tracking" };
    }
  );

  // --- Competitor Apps ---

  // GET /api/account/competitors — aggregate view (all competitors with trackedAppSlug)
  app.get("/competitors", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    // Need to join twice: once for competitor app, once for tracked app slug
    const competitorAppsAlias = apps;
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

    if (rows.length === 0) return [];

    // Get account's tracked keyword IDs (deduplicated)
    const accountKeywords = await db
      .select({ keywordId: accountTrackedKeywords.keywordId })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));
    const trackedKeywordIds = [...new Set(accountKeywords.map((k) => k.keywordId))];

    // Count distinct keywords each competitor is ranked in (latest ranking per keyword, non-null position)
    const competitorSlugs = [...new Set(rows.map((r) => r.appSlug))];
    const competitorAppIds = [...new Set(rows.map((r) => r._appId))];
    // Build id->slug map for competitors
    const compIdToSlug = new Map<number, string>();
    for (const r of rows) compIdToSlug.set(r._appId, r.appSlug);

    let rankedKeywordMap = new Map<string, number>();
    if (trackedKeywordIds.length > 0 && competitorAppIds.length > 0) {
      const appIdList = sql.join(competitorAppIds.map((id) => sql`${id}`), sql`, `);
      const idList = sql.join(trackedKeywordIds.map((id) => sql`${id}`), sql`, `);
      const rankedRows = await db.execute(sql`
        SELECT a.slug AS app_slug, COUNT(DISTINCT keyword_id)::int AS ranked_keywords
        FROM (
          SELECT DISTINCT ON (app_id, keyword_id) app_id, keyword_id, position
          FROM app_keyword_rankings
          WHERE app_id IN (${appIdList})
            AND keyword_id IN (${idList})
          ORDER BY app_id, keyword_id, scraped_at DESC
        ) latest
        INNER JOIN apps a ON a.id = latest.app_id
        WHERE position IS NOT NULL
        GROUP BY a.slug
      `);
      const rankedData: any[] = (rankedRows as any).rows ?? rankedRows;
      for (const r of rankedData) {
        rankedKeywordMap.set(r.app_slug, r.ranked_keywords);
      }
    }

    // Ad keyword counts (last 30 days)
    const adKeywordMap = new Map<string, number>();
    const adSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    if (competitorAppIds.length > 0) {
      const adCounts = await db
        .select({
          appSlug: apps.slug,
          count: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
        })
        .from(keywordAdSightings)
        .innerJoin(apps, eq(apps.id, keywordAdSightings.appId))
        .where(
          and(
            inArray(keywordAdSightings.appId, competitorAppIds),
            sql`${keywordAdSightings.seenDate} >= ${adSinceStr}`
          )
        )
        .groupBy(apps.slug);
      for (const ac of adCounts) {
        adKeywordMap.set(ac.appSlug, ac.count);
      }
    }

    // Batch-fetch featured section counts (last 30 days)
    const featuredCountMap = new Map<string, number>();
    if (competitorAppIds.length > 0) {
      const featuredSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
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

    // Batch-fetch reverse similar counts
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

    // Batch-fetch similarity scores per (trackedApp, competitor) pair
    const similarityMap = new Map<string, Map<string, { overall: string; category: string; feature: string; keyword: string; text: string }>>();
    if (competitorAppIds.length > 0) {
      try {
        const trackedAppIds = [...new Set(rows.map((r) => r._trackedAppId))];
        const allPairIds = [...new Set([...trackedAppIds, ...competitorAppIds])];
        const idList = sql.join(allPairIds.map((id) => sql`${id}`), sql`, `);
        const simRows: any[] = await db.execute(sql`
          SELECT a1.slug AS app_slug_a, a2.slug AS app_slug_b,
            s.overall_score, s.category_score, s.feature_score, s.keyword_score, s.text_score
          FROM app_similarity_scores s
          INNER JOIN apps a1 ON a1.id = s.app_id_a
          INNER JOIN apps a2 ON a2.id = s.app_id_b
          WHERE s.app_id_a IN (${idList}) AND s.app_id_b IN (${idList})
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of simRows) {
          // Store both directions for easy lookup
          for (const [tracked, comp] of [[r.app_slug_a, r.app_slug_b], [r.app_slug_b, r.app_slug_a]]) {
            if (!similarityMap.has(tracked)) similarityMap.set(tracked, new Map());
            similarityMap.get(tracked)!.set(comp, {
              overall: r.overall_score,
              category: r.category_score,
              feature: r.feature_score,
              keyword: r.keyword_score,
              text: r.text_score,
            });
          }
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch review velocity metrics (graceful if table not yet migrated)
    const velocityMap = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();
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
          velocityMap.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch visibility scores per (trackedAppId, competitorId) for this account
    const visibilityMap = new Map<string, { visibilityScore: number; keywordCount: number; visibilityRaw: number }>(); // key: "trackedAppSlug:competitorSlug"
    if (competitorAppIds.length > 0) {
      try {
        const visRows = await db
          .select({
            trackedAppSlug: sql<string>`ta.slug`,
            appSlug: sql<string>`ca.slug`,
            visibilityScore: appVisibilityScores.visibilityScore,
            keywordCount: appVisibilityScores.keywordCount,
            visibilityRaw: appVisibilityScores.visibilityRaw,
          })
          .from(appVisibilityScores)
          .innerJoin(sql`apps ta`, sql`ta.id = ${appVisibilityScores.trackedAppId}`)
          .innerJoin(sql`apps ca`, sql`ca.id = ${appVisibilityScores.appId}`)
          .where(
            and(
              eq(appVisibilityScores.accountId, accountId),
              inArray(appVisibilityScores.appId, competitorAppIds),
              sql`${appVisibilityScores.computedAt} = (
                SELECT MAX(v2.computed_at) FROM app_visibility_scores v2
                WHERE v2.account_id = ${appVisibilityScores.accountId}
                  AND v2.tracked_app_id = ${appVisibilityScores.trackedAppId}
                  AND v2.app_id = ${appVisibilityScores.appId}
              )`,
            )
          );
        for (const r of visRows) {
          visibilityMap.set(`${r.trackedAppSlug}:${r.appSlug}`, {
            visibilityScore: r.visibilityScore,
            keywordCount: r.keywordCount,
            visibilityRaw: parseFloat(String(r.visibilityRaw)),
          });
        }
      } catch { /* table may not exist yet */ }
    }

    // Batch-fetch weighted power scores per competitor
    const weightedPowerMap = new Map<string, number>();
    const powerCategoriesMap = new Map<string, { title: string; powerScore: number; appCount: number; position: number | null; ratingScore: number; reviewScore: number; categoryScore: number; momentumScore: number }[]>();
    if (competitorAppIds.length > 0) {
      try {
        const powRows: any[] = await db.execute(sql`
          SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                 cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
          FROM app_power_scores p
          INNER JOIN apps a ON a.id = p.app_id
          INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
          LEFT JOIN LATERAL (
            SELECT s.app_count FROM category_snapshots s
            WHERE s.category_id = c.id
            ORDER BY s.scraped_at DESC LIMIT 1
          ) cs ON true
          LEFT JOIN LATERAL (
            SELECT r.position FROM app_category_rankings r
            WHERE r.app_id = p.app_id AND r.category_slug = p.category_slug AND r.position IS NOT NULL
            ORDER BY r.scraped_at DESC LIMIT 1
          ) rk ON true
          WHERE p.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
            AND p.computed_at = (
              SELECT MAX(p2.computed_at) FROM app_power_scores p2
              WHERE p2.app_id = p.app_id AND p2.category_slug = p.category_slug
            )
        `).then((res: any) => (res as any).rows ?? res);

        // Group by app, compute weighted average
        const appPowerInputs = new Map<string, { powerScore: number; appCount: number }[]>();
        for (const r of powRows) {
          if (!appPowerInputs.has(r.app_slug)) appPowerInputs.set(r.app_slug, []);
          appPowerInputs.get(r.app_slug)!.push({
            powerScore: r.power_score,
            appCount: r.app_count ?? 1,
          });
          if (!powerCategoriesMap.has(r.app_slug)) powerCategoriesMap.set(r.app_slug, []);
          powerCategoriesMap.get(r.app_slug)!.push({
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
          weightedPowerMap.set(appSlug, computeWeightedPowerScore(inputs));
        }
      } catch { /* table may not exist yet */ }
    }

    // Attach latest snapshot summary for each competitor
    const result = await Promise.all(
      rows.map(async (row) => {
        const [snapshot] = await db
          .select({
            averageRating: appSnapshots.averageRating,
            ratingCount: appSnapshots.ratingCount,
            pricing: appSnapshots.pricing,
            pricingPlans: appSnapshots.pricingPlans,
            categories: appSnapshots.categories,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, row._appId))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        const [change] = await db
          .select({ detectedAt: sql<string | null>`max(detected_at)` })
          .from(sql`app_field_changes`)
          .where(sql`app_id = ${row._appId}`);

        const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
        const { pricingPlans: _, categories: cats, ...snapshotRest } = snapshot || ({} as any);
        const appCategories = (cats as any[]) || [];

        return {
          ...row,
          latestSnapshot: snapshot ? snapshotRest : null,
          minPaidPrice,
          lastChangeAt: change?.detectedAt || null,
          rankedKeywords: rankedKeywordMap.get(row.appSlug) ?? 0,
          adKeywords: adKeywordMap.get(row.appSlug) ?? 0,
          featuredSections: featuredCountMap.get(row.appSlug) ?? 0,
          reverseSimilarCount: reverseSimilarMap.get(row.appSlug) ?? 0,
          visibilityScore: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityScore ?? null,
          visibilityKeywordCount: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.keywordCount ?? null,
          visibilityRaw: visibilityMap.get(`${row.trackedAppSlug}:${row.appSlug}`)?.visibilityRaw ?? null,
          weightedPowerScore: weightedPowerMap.get(row.appSlug) ?? null,
          powerCategories: powerCategoriesMap.get(row.appSlug) ?? [],
          categories: appCategories.map((c: any) => {
            const slug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
            return { type: c.type || "primary", title: c.title, slug };
          }),
          categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
          reviewVelocity: velocityMap.get(row.appSlug) ?? null,
          similarityScore: similarityMap.get(row.trackedAppSlug)?.get(row.appSlug) ?? null,
        };
      })
    );

    return result;
  });

  // POST /api/account/competitors — add competitor (requires trackedAppSlug)
  app.post(
    "/competitors",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug, trackedAppSlug } = request.body as {
        slug?: string;
        trackedAppSlug?: string;
      };

      if (!slug) {
        return reply.code(400).send({ error: "slug is required" });
      }
      if (!trackedAppSlug) {
        return reply
          .code(400)
          .send({ error: "trackedAppSlug is required" });
      }

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [trackedAppRow] = await db
        .select({ id: apps.id })
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
          error: "Competitor apps limit reached",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists in global table
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
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

      const scraperEnqueued = await enqueueAppScrapeJobs(slug, existingApp.platform);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/competitors/:slug
  app.delete<{ Params: { slug: string } }>(
    "/competitors/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { trackedAppSlug } = request.query as {
        trackedAppSlug?: string;
      };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up competitor app ID from slug
      const [compAppRow] = await db
        .select({ id: apps.id })
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
      if (trackedAppSlug) {
        const [trackedAppRow] = await db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
          .limit(1);
        if (trackedAppRow) {
          whereConditions.push(
            eq(accountCompetitorApps.trackedAppId, trackedAppRow.id)
          );
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

      return { message: "Competitor removed" };
    }
  );

  // --- Per-app nested routes ---

  // GET /api/account/tracked-apps/:slug/competitors
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

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

      const includeSelf = (request.query as any).includeSelf === "true";

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
      const similarityMap = new Map<string, { overall: string; category: string; feature: string; keyword: string; text: string }>();
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
            similarityMap.set(compSlug, {
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
            const visRows = await db
              .select({
                appSlug: sql<string>`ca.slug`,
                visibilityScore: appVisibilityScores.visibilityScore,
                keywordCount: appVisibilityScores.keywordCount,
                visibilityRaw: appVisibilityScores.visibilityRaw,
              })
              .from(appVisibilityScores)
              .innerJoin(sql`apps ca`, sql`ca.id = ${appVisibilityScores.appId}`)
              .where(
                and(
                  eq(appVisibilityScores.accountId, accountId),
                  eq(appVisibilityScores.trackedAppId, visTrackedAppRow.id),
                  inArray(appVisibilityScores.appId, competitorAppIds),
                  sql`${appVisibilityScores.computedAt} = (
                    SELECT MAX(v2.computed_at) FROM app_visibility_scores v2
                    WHERE v2.account_id = ${appVisibilityScores.accountId}
                      AND v2.tracked_app_id = ${appVisibilityScores.trackedAppId}
                      AND v2.app_id = ${appVisibilityScores.appId}
                  )`,
                )
              );
            for (const r of visRows) {
              visibilityMap2.set(r.appSlug, {
                visibilityScore: r.visibilityScore,
                keywordCount: r.keywordCount,
                visibilityRaw: parseFloat(String(r.visibilityRaw)),
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
            SELECT a.slug AS app_slug, p.power_score, p.rating_score, p.review_score, p.category_score, p.momentum_score,
                   cs.app_count, rk.position AS rank_position, p.category_slug, c.title AS category_title
            FROM app_power_scores p
            INNER JOIN apps a ON a.id = p.app_id
            INNER JOIN categories c ON c.slug = p.category_slug AND c.is_listing_page = true
            LEFT JOIN LATERAL (
              SELECT s.app_count FROM category_snapshots s
              WHERE s.category_id = c.id
              ORDER BY s.scraped_at DESC LIMIT 1
            ) cs ON true
            LEFT JOIN LATERAL (
              SELECT r.position FROM app_category_rankings r
              WHERE r.app_id = p.app_id AND r.category_slug = p.category_slug AND r.position IS NOT NULL
              ORDER BY r.scraped_at DESC LIMIT 1
            ) rk ON true
            WHERE p.app_id IN (${sql.join(competitorAppIds.map(id => sql`${id}`), sql`, `)})
              AND p.computed_at = (
                SELECT MAX(p2.computed_at) FROM app_power_scores p2
                WHERE p2.app_id = p.app_id AND p2.category_slug = p.category_slug
              )
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

      const result = await Promise.all(
        allRows.map(async (row) => {
          const [snapshot] = await db
            .select({
              averageRating: appSnapshots.averageRating,
              ratingCount: appSnapshots.ratingCount,
              pricing: appSnapshots.pricing,
              pricingPlans: appSnapshots.pricingPlans,
              categories: appSnapshots.categories,
            })
            .from(appSnapshots)
            .where(eq(appSnapshots.appId, (row as any)._appId))
            .orderBy(desc(appSnapshots.scrapedAt))
            .limit(1);

          const [change] = await db
            .select({ detectedAt: sql<string | null>`max(detected_at)` })
            .from(sql`app_field_changes`)
            .where(sql`app_id = ${(row as any)._appId}`);

          const minPaidPrice = getMinPaidPrice(snapshot?.pricingPlans);
          const { pricingPlans: _, categories: cats, ...snapshotRest } = snapshot || ({} as any);
          const appCategories = (cats as any[]) || [];

          return {
            ...row,
            latestSnapshot: snapshot ? snapshotRest : null,
            minPaidPrice,
            lastChangeAt: change?.detectedAt || null,
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
            similarityScore: similarityMap.get(row.appSlug) ?? null,
            isSelf: includeSelf && row.appSlug === slug,
          };
        })
      );

      return result;
    }
  );

  // POST /api/account/tracked-apps/:slug/competitors
  app.post<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { slug: competitorSlug } = request.body as { slug?: string };

      if (!competitorSlug) {
        return reply.code(400).send({ error: "slug is required" });
      }

      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up tracked app ID from slug
      const [trackedAppRow2] = await db
        .select({ id: apps.id })
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
          error: "Competitor apps limit reached",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Check app exists
      const [existingApp] = await db
        .select({ id: apps.id, slug: apps.slug, platform: apps.platform })
        .from(apps)
        .where(and(eq(apps.slug, competitorSlug), eq(apps.platform, platform)))
        .limit(1);

      if (!existingApp) {
        return reply.code(404).send({
          error:
            "App not found. Only existing apps can be added as competitors.",
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

      const scraperEnqueued = await enqueueAppScrapeJobs(competitorSlug, existingApp.platform);

      return { ...result, scraperEnqueued };
    }
  );

  // DELETE /api/account/tracked-apps/:slug/competitors/:competitorSlug
  app.delete<{ Params: { slug: string; competitorSlug: string } }>(
    "/tracked-apps/:slug/competitors/:competitorSlug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const competitorSlug = decodeURIComponent(
        request.params.competitorSlug
      );
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      // Look up app IDs from slugs
      const [delTrackedAppRow] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.slug, trackedAppSlug), eq(apps.platform, platform)))
        .limit(1);
      const [delCompAppRow] = await db
        .select({ id: apps.id })
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

      return { message: "Competitor removed" };
    }
  );

  // PATCH /api/account/tracked-apps/:slug/competitors/reorder
  app.patch<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitors/reorder",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { slugs } = request.body as { slugs?: string[] };

      if (!Array.isArray(slugs) || slugs.length === 0) {
        return reply.code(400).send({ error: "slugs array is required" });
      }

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

      // Enrich with latest snapshot
      const result = await Promise.all(
        rows.map(async (row) => {
          const [snapshot] = await db
            .select({
              totalResults: keywordSnapshots.totalResults,
              scrapedAt: keywordSnapshots.scrapedAt,
            })
            .from(keywordSnapshots)
            .where(eq(keywordSnapshots.keywordId, row.keywordId))
            .orderBy(desc(keywordSnapshots.scrapedAt))
            .limit(1);

          return {
            ...row,
            latestSnapshot: snapshot || null,
          };
        })
      );

      // Batch-fetch tags for all keywords
      const keywordIds = rows.map((r) => r.keywordId);
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
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const trackedAppSlug = decodeURIComponent(request.params.slug);
      const { keyword } = request.body as { keyword?: string };
      const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

      if (!keyword) {
        return reply.code(400).send({ error: "keyword is required" });
      }

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
          error: "Tracked keywords limit reached",
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
    { preHandler: [requireRole("owner", "editor")] },
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

      return { message: "Keyword removed from tracking" };
    }
  );

  // GET /api/account/tracked-apps/:slug/keyword-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/keyword-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = "50", debug = "false" } = request.query as {
        limit?: string;
        debug?: string;
      };
      const isDebug = debug === "true";
      const maxResults = Math.min(parseInt(limitStr, 10) || 50, 200);
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

      // Extract keyword suggestions
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

  // GET /api/account/tracked-apps/:slug/competitor-suggestions
  app.get<{ Params: { slug: string } }>(
    "/tracked-apps/:slug/competitor-suggestions",
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);
      const { limit: limitStr = "20" } = request.query as { limit?: string };
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
      const slugList = sql.join(allSlugs.map((s) => sql`${s}`), sql`, `);

      // Fetch snapshots, app info, and keywords in parallel
      const [snapshotRows, appInfoRows, kwRows] = await Promise.all([
        db
          .execute(
            sql`
            SELECT DISTINCT ON (s.app_id)
              a.slug AS app_slug, s.categories, s.platform_data, s.app_introduction
            FROM app_snapshots s
            INNER JOIN apps a ON a.id = s.app_id
            WHERE a.slug IN (${slugList})
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
            WHERE slug IN (${slugList})
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
            WHERE a.slug IN (${slugList})
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

      return { suggestions: suggestions.slice(0, maxResults) };
    }
  );

  // --- Starred Categories ---

  // GET /api/account/starred-categories
  app.get("/starred-categories", async (request) => {
    const { accountId } = request.user;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);

    const rows = await db
      .select({
        categorySlug: categories.slug,
        createdAt: accountStarredCategories.createdAt,
        categoryTitle: categories.title,
        parentSlug: categories.parentSlug,
      })
      .from(accountStarredCategories)
      .innerJoin(
        categories,
        eq(categories.id, accountStarredCategories.categoryId)
      )
      .where(and(eq(accountStarredCategories.accountId, accountId), eq(categories.platform, platform)));

    if (rows.length === 0) return rows;

    // Get tracked + competitor slugs for this account
    const [trackedAppsRows2, competitorAppsRows2] = await Promise.all([
      db.select({ appSlug: apps.slug }).from(accountTrackedApps).innerJoin(apps, eq(apps.id, accountTrackedApps.appId)).where(eq(accountTrackedApps.accountId, accountId)),
      db.select({ appSlug: apps.slug }).from(accountCompetitorApps).innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId)).where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSet = new Set(trackedAppsRows2.map((a) => a.appSlug));
    const competitorSet = new Set(competitorAppsRows2.map((a) => a.appSlug));

    // Get latest snapshot per starred category for firstPageApps + appCount
    const categorySlugs = rows.map((r) => r.categorySlug);
    const catRows = await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(inArray(categories.slug, categorySlugs));
    const catSlugToId = new Map(catRows.map((c) => [c.slug, c.id]));
    const catIdToSlug = new Map(catRows.map((c) => [c.id, c.slug]));
    const categoryIds = catRows.map((c) => c.id);

    const snapshots = categoryIds.length > 0 ? await db
      .select({
        categoryId: categorySnapshots.categoryId,
        appCount: categorySnapshots.appCount,
        firstPageApps: categorySnapshots.firstPageApps,
        scrapeRunId: categorySnapshots.scrapeRunId,
      })
      .from(categorySnapshots)
      .where(
        and(
          inArray(categorySnapshots.categoryId, categoryIds),
          sql`${categorySnapshots.id} = (
            SELECT s2.id FROM category_snapshots s2
            WHERE s2.category_id = ${categorySnapshots.categoryId}
            ORDER BY s2.scraped_at DESC LIMIT 1
          )`
        )
      ) : [];

    const snapshotMap = new Map(snapshots.map((s) => [catIdToSlug.get(s.categoryId) ?? "", s]));

    function extractSlug(appUrl: string): string {
      return appUrl.replace(/^https?:\/\/apps\.shopify\.com\//, "").replace(/^\/apps\//, "").split("?")[0];
    }

    // For categories without firstPageApps (e.g. Salesforce), load ranked app slugs from appCategoryRankings
    const slugsNeedingRankings = rows
      .filter((r) => {
        const snap = snapshotMap.get(r.categorySlug);
        return !snap?.firstPageApps || (snap.firstPageApps as any[]).length === 0;
      })
      .map((r) => r.categorySlug);

    const rankingsMap = new Map<string, { app_slug: string; name: string; logo_url: string | null; position: number }[]>();
    if (slugsNeedingRankings.length > 0) {
      // Get scrape_run_ids from already-fetched snapshots (no correlated subquery needed)
      const scrapeRunIds = slugsNeedingRankings
        .map((slug) => snapshotMap.get(slug)?.scrapeRunId)
        .filter((id): id is string => id != null);

      if (scrapeRunIds.length > 0) {
        const rankingRows = await db
          .select({
            categorySlug: appCategoryRankings.categorySlug,
            appSlug: apps.slug,
            name: apps.name,
            iconUrl: apps.iconUrl,
            position: appCategoryRankings.position,
          })
          .from(appCategoryRankings)
          .innerJoin(apps, eq(apps.id, appCategoryRankings.appId))
          .where(
            and(
              inArray(appCategoryRankings.categorySlug, slugsNeedingRankings),
              inArray(appCategoryRankings.scrapeRunId, scrapeRunIds)
            )
          );
        for (const r of rankingRows) {
          const list = rankingsMap.get(r.categorySlug) ?? [];
          list.push({ app_slug: r.appSlug, name: r.name, logo_url: r.iconUrl, position: r.position });
          rankingsMap.set(r.categorySlug, list);
        }
      }
    }

    // Enrich with all parent titles from junction table
    const parentTitlesMap = new Map<string, { slug: string; title: string }[]>();
    try {
      const catIds = [...catSlugToId.values()];
      if (catIds.length > 0) {
        const parentRows = await db
          .select({
            categoryId: categoryParents.categoryId,
            parentSlug: categories.slug,
            parentTitle: categories.title,
          })
          .from(categoryParents)
          .innerJoin(categories, eq(categories.id, categoryParents.parentCategoryId))
          .where(inArray(categoryParents.categoryId, catIds));
        for (const pr of parentRows) {
          const slug = catIdToSlug.get(pr.categoryId) ?? "";
          const list = parentTitlesMap.get(slug) ?? [];
          list.push({ slug: pr.parentSlug, title: pr.parentTitle });
          parentTitlesMap.set(slug, list);
        }
      }
    } catch { /* category_parents table may not exist yet */ }

    return rows.map((row) => {
      const snap = snapshotMap.get(row.categorySlug);
      const fpApps = (snap?.firstPageApps ?? []) as any[];

      let trackedAppsInResults: any[];
      let competitorAppsInResults: any[];

      if (fpApps.length > 0) {
        // Shopify path: use firstPageApps from snapshot
        trackedAppsInResults = fpApps
          .filter((a) => trackedSet.has(extractSlug(a.app_url)))
          .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
        competitorAppsInResults = fpApps
          .filter((a) => competitorSet.has(extractSlug(a.app_url)))
          .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
      } else {
        // Non-Shopify path: use appCategoryRankings
        const rankedApps = rankingsMap.get(row.categorySlug) ?? [];
        trackedAppsInResults = rankedApps.filter((a) => trackedSet.has(a.app_slug));
        competitorAppsInResults = rankedApps.filter((a) => competitorSet.has(a.app_slug));
      }

      // Use junction table parents if available, fall back to single parentSlug
      const parents = parentTitlesMap.get(row.categorySlug) ?? (row.parentSlug ? [{ slug: row.parentSlug, title: row.parentSlug }] : []);

      return {
        ...row,
        parents,
        appCount: snap?.appCount ?? null,
        trackedInResults: trackedAppsInResults.length,
        competitorInResults: competitorAppsInResults.length,
        trackedAppsInResults,
        competitorAppsInResults,
      };
    });
  });

  // POST /api/account/starred-categories
  app.post(
    "/starred-categories",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = request.body as { slug?: string };

      if (!slug) {
        return reply.code(400).send({ error: "slug is required" });
      }

      // Look up category ID from slug
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      if (!catRow) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const [result] = await db
        .insert(accountStarredCategories)
        .values({ accountId, categoryId: catRow.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Category already starred" });
      }

      return result;
    }
  );

  // DELETE /api/account/starred-categories/:slug
  app.delete<{ Params: { slug: string } }>(
    "/starred-categories/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const slug = decodeURIComponent(request.params.slug);

      // Look up category ID from slug
      const [delCatRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!delCatRow) {
        return reply.code(404).send({ error: "Category not found" });
      }

      const deleted = await db
        .delete(accountStarredCategories)
        .where(
          and(
            eq(accountStarredCategories.accountId, accountId),
            eq(accountStarredCategories.categoryId, delCatRow.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Starred category not found" });
      }

      return { message: "Category unstarred" };
    }
  );

  // --- Tracked Features ---

  // GET /api/account/starred-features
  app.get("/starred-features", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
        createdAt: accountTrackedFeatures.createdAt,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, accountId));

    if (rows.length === 0) return rows;

    const handles = rows.map((r) => r.featureHandle);
    const handleList = sql.join(handles.map((h) => sql`${h}`), sql`,`);

    // Get category info + app slugs per feature in one query
    const enrichResult = await db.execute(sql`
      SELECT
        f->>'feature_handle' AS handle,
        cat->>'title' AS category_title,
        sub->>'title' AS subcategory_title,
        a.slug AS app_slug
      FROM (
        SELECT DISTINCT ON (s.app_id) s.id, s.app_id, s.categories
        FROM app_snapshots s
        ORDER BY s.app_id, s.scraped_at DESC
      ) s
      INNER JOIN apps a ON a.id = s.app_id,
      jsonb_array_elements(s.categories) AS cat,
      jsonb_array_elements(cat->'subcategories') AS sub,
      jsonb_array_elements(sub->'features') AS f
      WHERE f->>'feature_handle' IN (${handleList})
    `);
    const enrichRows: any[] = (enrichResult as any).rows ?? enrichResult;

    // Build category map (first match per handle) and app slugs per feature
    const catMap = new Map<string, { category_title: string; subcategory_title: string }>();
    const featureAppsMap = new Map<string, Set<string>>();
    for (const r of enrichRows) {
      if (!catMap.has(r.handle)) {
        catMap.set(r.handle, { category_title: r.category_title, subcategory_title: r.subcategory_title });
      }
      if (!featureAppsMap.has(r.handle)) featureAppsMap.set(r.handle, new Set());
      featureAppsMap.get(r.handle)!.add(r.app_slug);
    }

    // Get tracked + competitor slugs for this account
    const [trackedAppsRows, competitorAppsRows] = await Promise.all([
      db.select({ appSlug: apps.slug }).from(accountTrackedApps).innerJoin(apps, eq(apps.id, accountTrackedApps.appId)).where(eq(accountTrackedApps.accountId, accountId)),
      db.select({ appSlug: apps.slug }).from(accountCompetitorApps).innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId)).where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSet = new Set(trackedAppsRows.map((a) => a.appSlug));
    const competitorSet = new Set(competitorAppsRows.map((a) => a.appSlug));

    return rows.map((r) => {
      const cat = catMap.get(r.featureHandle);
      const appSlugs = featureAppsMap.get(r.featureHandle) ?? new Set<string>();
      const trackedInFeature = [...appSlugs].filter((s) => trackedSet.has(s)).length;
      const competitorInFeature = [...appSlugs].filter((s) => competitorSet.has(s)).length;
      return {
        ...r,
        categoryTitle: cat?.category_title || null,
        subcategoryTitle: cat?.subcategory_title || null,
        appCount: appSlugs.size,
        trackedInFeature,
        competitorInFeature,
      };
    });
  });

  // POST /api/account/starred-features
  app.post(
    "/starred-features",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { handle, title } = request.body as {
        handle?: string;
        title?: string;
      };

      if (!handle || !title) {
        return reply
          .code(400)
          .send({ error: "handle and title are required" });
      }

      const [result] = await db
        .insert(accountTrackedFeatures)
        .values({
          accountId,
          featureHandle: handle,
          featureTitle: title,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Feature already starred" });
      }

      return result;
    }
  );

  // DELETE /api/account/starred-features/:handle
  app.delete<{ Params: { handle: string } }>(
    "/starred-features/:handle",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { handle } = request.params;

      const deleted = await db
        .delete(accountTrackedFeatures)
        .where(
          and(
            eq(accountTrackedFeatures.accountId, accountId),
            eq(accountTrackedFeatures.featureHandle, handle)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Starred feature not found" });
      }

      return { message: "Feature unstarred" };
    }
  );

  // ── Keyword Tags ──────────────────────────────────────────────

  const TAG_COLORS = [
    "red",
    "orange",
    "amber",
    "emerald",
    "cyan",
    "blue",
    "violet",
    "pink",
    "slate",
    "rose",
  ];

  // GET /api/account/keyword-tags
  app.get("/keyword-tags", async (request) => {
    const { accountId } = request.user;
    return db
      .select()
      .from(keywordTags)
      .where(eq(keywordTags.accountId, accountId))
      .orderBy(keywordTags.name);
  });

  // POST /api/account/keyword-tags
  app.post(
    "/keyword-tags",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { name, color } = request.body as {
        name?: string;
        color?: string;
      };

      if (!name?.trim() || !color) {
        return reply
          .code(400)
          .send({ error: "name and color are required" });
      }
      if (!TAG_COLORS.includes(color)) {
        return reply.code(400).send({ error: "Invalid color" });
      }

      try {
        const [result] = await db
          .insert(keywordTags)
          .values({ accountId, name: name.trim(), color })
          .returning();
        return result;
      } catch (err: any) {
        if (err.code === "23505") {
          return reply
            .code(409)
            .send({ error: "Tag name already exists" });
        }
        throw err;
      }
    }
  );

  // PATCH /api/account/keyword-tags/:id
  app.patch<{ Params: { id: string } }>(
    "/keyword-tags/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;
      const { color, name } = request.body as {
        color?: string;
        name?: string;
      };

      const updates: Record<string, any> = {};
      if (color) {
        if (!TAG_COLORS.includes(color)) {
          return reply.code(400).send({ error: "Invalid color" });
        }
        updates.color = color;
      }
      if (name?.trim()) {
        updates.name = name.trim();
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "Nothing to update" });
      }

      const [updated] = await db
        .update(keywordTags)
        .set(updates)
        .where(
          and(eq(keywordTags.id, id), eq(keywordTags.accountId, accountId))
        )
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "Tag not found" });
      }
      return updated;
    }
  );

  // DELETE /api/account/keyword-tags/:id
  app.delete<{ Params: { id: string } }>(
    "/keyword-tags/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id } = request.params;

      const deleted = await db
        .delete(keywordTags)
        .where(
          and(eq(keywordTags.id, id), eq(keywordTags.accountId, accountId))
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tag not found" });
      }
      return { message: "Tag deleted" };
    }
  );

  // POST /api/account/keyword-tags/:id/keywords/:keywordId — assign tag
  app.post<{ Params: { id: string; keywordId: string } }>(
    "/keyword-tags/:id/keywords/:keywordId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id: tagId, keywordId } = request.params;

      // Verify tag belongs to account
      const [tag] = await db
        .select({ id: keywordTags.id })
        .from(keywordTags)
        .where(
          and(eq(keywordTags.id, tagId), eq(keywordTags.accountId, accountId))
        );
      if (!tag) {
        return reply.code(404).send({ error: "Tag not found" });
      }

      try {
        const [result] = await db
          .insert(keywordTagAssignments)
          .values({ tagId, keywordId: parseInt(keywordId, 10) })
          .returning();
        return result;
      } catch (err: any) {
        if (err.code === "23505") {
          return reply.code(409).send({ error: "Tag already assigned" });
        }
        throw err;
      }
    }
  );

  // DELETE /api/account/keyword-tags/:id/keywords/:keywordId — unassign tag
  app.delete<{ Params: { id: string; keywordId: string } }>(
    "/keyword-tags/:id/keywords/:keywordId",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { id: tagId, keywordId } = request.params;

      // Verify tag belongs to account
      const [tag] = await db
        .select({ id: keywordTags.id })
        .from(keywordTags)
        .where(
          and(eq(keywordTags.id, tagId), eq(keywordTags.accountId, accountId))
        );
      if (!tag) {
        return reply.code(404).send({ error: "Tag not found" });
      }

      const deleted = await db
        .delete(keywordTagAssignments)
        .where(
          and(
            eq(keywordTagAssignments.tagId, tagId),
            eq(
              keywordTagAssignments.keywordId,
              parseInt(keywordId, 10)
            )
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply
          .code(404)
          .send({ error: "Assignment not found" });
      }
      return { message: "Tag removed from keyword" };
    }
  );
};
