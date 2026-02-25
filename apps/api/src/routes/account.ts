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
} from "@shopify-tracking/db";
import { requireRole } from "../middleware/authorize.js";

const QUEUE_NAME = "scraper-jobs";

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
    scraperQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scraperQueue;
}

type Db = ReturnType<typeof createDb>;

/** After adding/removing a tracked app, sync the global isTracked flag */
async function syncAppTrackedFlag(db: Db, appSlug: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountTrackedApps)
    .where(eq(accountTrackedApps.appSlug, appSlug));

  const [{ countComp }] = await db
    .select({ countComp: sql<number>`count(*)::int` })
    .from(accountCompetitorApps)
    .where(eq(accountCompetitorApps.appSlug, appSlug));

  await db
    .update(apps)
    .set({
      isTracked: count + countComp > 0,
      updatedAt: new Date(),
    })
    .where(eq(apps.slug, appSlug));
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
      .select({ count: sql<number>`count(distinct ${accountCompetitorApps.appSlug})::int` })
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
          }
        : null,
      limits: {
        maxTrackedApps: account.maxTrackedApps,
        maxTrackedKeywords: account.maxTrackedKeywords,
        maxCompetitorApps: account.maxCompetitorApps,
        maxUsers: account.maxUsers,
      },
      usage: {
        trackedApps: trackedAppsCount.count,
        trackedKeywords: trackedKeywordsCount.count,
        competitorApps: competitorAppsCount.count,
        starredFeatures: starredFeaturesCount.count,
        users: usersCount.count,
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

    const rows = await db
      .select({
        appSlug: accountTrackedApps.appSlug,
        createdAt: accountTrackedApps.createdAt,
        appName: apps.name,
        iconUrl: apps.iconUrl,
        isBuiltForShopify: apps.isBuiltForShopify,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.slug, accountTrackedApps.appSlug))
      .where(eq(accountTrackedApps.accountId, accountId));

    return rows;
  });

  // POST /api/account/tracked-apps
  app.post(
    "/tracked-apps",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = request.body as { slug?: string };

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
        .select({ slug: apps.slug })
        .from(apps)
        .where(eq(apps.slug, slug))
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
        .where(eq(apps.slug, slug));

      // Add to account tracking
      const [result] = await db
        .insert(accountTrackedApps)
        .values({ accountId, appSlug: slug })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "App already tracked" });
      }

      // If app has no snapshots yet, enqueue a scraper job
      const [existingSnapshot] = await db
        .select({ id: appSnapshots.id })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, slug))
        .limit(1);

      let scraperEnqueued = false;
      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:app_details", {
            type: "app_details",
            slug,
            triggeredBy: "api",
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable — scraper will pick it up on next scheduled run
        }
      }

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

      // Check if tracked app exists
      const [existing] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, slug)
          )
        );

      if (!existing) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      // Cascade: collect affected competitors and keywords before deleting
      const affectedCompetitors = await db
        .select({ appSlug: accountCompetitorApps.appSlug })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, slug)
          )
        );

      const affectedKeywords = await db
        .select({ keywordId: accountTrackedKeywords.keywordId })
        .from(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppSlug, slug)
          )
        );

      // Delete associated competitors and keywords
      await db
        .delete(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, slug)
          )
        );

      await db
        .delete(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppSlug, slug)
          )
        );

      // Delete the tracked app itself
      await db
        .delete(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, slug)
          )
        );

      // Sync flags for the tracked app and all removed competitors
      await syncAppTrackedFlag(db, slug);
      for (const c of affectedCompetitors) {
        await syncAppTrackedFlag(db, c.appSlug);
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
        trackedAppSlug: accountTrackedKeywords.trackedAppSlug,
        createdAt: accountTrackedKeywords.createdAt,
        keyword: trackedKeywords.keyword,
      })
      .from(accountTrackedKeywords)
      .innerJoin(
        trackedKeywords,
        eq(trackedKeywords.id, accountTrackedKeywords.keywordId)
      )
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

      // Verify the tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, trackedAppSlug)
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
        .values({ keyword, slug })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      // Add to account tracking with trackedAppSlug
      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppSlug, keywordId: kw.id })
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
        whereConditions.push(
          eq(accountTrackedKeywords.trackedAppSlug, trackedAppSlug)
        );
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

    const rows = await db
      .select({
        appSlug: accountCompetitorApps.appSlug,
        trackedAppSlug: accountCompetitorApps.trackedAppSlug,
        sortOrder: accountCompetitorApps.sortOrder,
        createdAt: accountCompetitorApps.createdAt,
        appName: apps.name,
        isBuiltForShopify: apps.isBuiltForShopify,
        launchedDate: apps.launchedDate,
        iconUrl: apps.iconUrl,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, accountId))
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
    let rankedKeywordMap = new Map<string, number>();
    if (trackedKeywordIds.length > 0 && competitorSlugs.length > 0) {
      const slugList = sql.join(competitorSlugs.map((s) => sql`${s}`), sql`, `);
      const idList = sql.join(trackedKeywordIds.map((id) => sql`${id}`), sql`, `);
      const rankedRows = await db.execute(sql`
        SELECT app_slug, COUNT(DISTINCT keyword_id)::int AS ranked_keywords
        FROM (
          SELECT DISTINCT ON (app_slug, keyword_id) app_slug, keyword_id, position
          FROM app_keyword_rankings
          WHERE app_slug IN (${slugList})
            AND keyword_id IN (${idList})
          ORDER BY app_slug, keyword_id, scraped_at DESC
        ) latest
        WHERE position IS NOT NULL
        GROUP BY app_slug
      `);
      const rankedData: any[] = (rankedRows as any).rows ?? rankedRows;
      for (const r of rankedData) {
        rankedKeywordMap.set(r.app_slug, r.ranked_keywords);
      }
    }

    // Ad keyword counts (last 30 days)
    const adKeywordMap = new Map<string, number>();
    const adSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    if (competitorSlugs.length > 0) {
      const adCounts = await db
        .select({
          appSlug: keywordAdSightings.appSlug,
          count: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
        })
        .from(keywordAdSightings)
        .where(
          and(
            inArray(keywordAdSightings.appSlug, competitorSlugs),
            sql`${keywordAdSightings.seenDate} >= ${adSinceStr}`
          )
        )
        .groupBy(keywordAdSightings.appSlug);
      for (const ac of adCounts) {
        adKeywordMap.set(ac.appSlug, ac.count);
      }
    }

    // Batch-fetch featured section counts (last 30 days)
    const featuredCountMap = new Map<string, number>();
    if (competitorSlugs.length > 0) {
      const featuredSinceStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const featuredCounts = await db
        .select({
          appSlug: featuredAppSightings.appSlug,
          sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
        })
        .from(featuredAppSightings)
        .where(
          and(
            inArray(featuredAppSightings.appSlug, competitorSlugs),
            sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
          )
        )
        .groupBy(featuredAppSightings.appSlug);
      for (const fc of featuredCounts) {
        featuredCountMap.set(fc.appSlug, fc.sectionCount);
      }
    }

    // Latest category rankings for each competitor
    const categoryRankingMap = new Map<string, { categorySlug: string; categoryTitle: string; position: number }[]>();
    if (competitorSlugs.length > 0) {
      const catRankRows: any[] = await db.execute(sql`
        SELECT DISTINCT ON (r.app_slug, r.category_slug)
          r.app_slug, r.category_slug, c.title AS category_title, r.position
        FROM app_category_rankings r
        JOIN categories c ON c.slug = r.category_slug
        WHERE r.app_slug IN (${sql.join(competitorSlugs.map((s) => sql`${s}`), sql`, `)})
          AND c.is_listing_page = true
        ORDER BY r.app_slug, r.category_slug, r.scraped_at DESC
      `).then((res: any) => (res as any).rows ?? res);
      for (const r of catRankRows) {
        const arr = categoryRankingMap.get(r.app_slug) ?? [];
        arr.push({ categorySlug: r.category_slug, categoryTitle: r.category_title, position: r.position });
        categoryRankingMap.set(r.app_slug, arr);
      }
    }

    // Batch-fetch review velocity metrics (graceful if table not yet migrated)
    const velocityMap = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();
    if (competitorSlugs.length > 0) {
      try {
        const velRows: any[] = await db.execute(sql`
          SELECT DISTINCT ON (app_slug)
            app_slug, v7d, v30d, v90d, momentum
          FROM app_review_metrics
          WHERE app_slug IN (${sql.join(competitorSlugs.map(s => sql`${s}`), sql`, `)})
          ORDER BY app_slug, computed_at DESC
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of velRows) {
          velocityMap.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
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
          .where(eq(appSnapshots.appSlug, row.appSlug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        const [change] = await db
          .select({ detectedAt: sql<string | null>`max(detected_at)` })
          .from(sql`app_field_changes`)
          .where(sql`app_slug = ${row.appSlug}`);

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
          categories: appCategories.map((c: any) => {
            const slug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
            return { type: c.type || "primary", title: c.title, slug };
          }),
          categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
          reviewVelocity: velocityMap.get(row.appSlug) ?? null,
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

      // Verify the tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, trackedAppSlug)
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
          count: sql<number>`count(distinct ${accountCompetitorApps.appSlug})::int`,
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
        .select({ slug: apps.slug })
        .from(apps)
        .where(eq(apps.slug, slug))
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
        .where(eq(apps.slug, slug));

      // Determine next sortOrder for this (account, trackedApp) group
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${accountCompetitorApps.sortOrder}), 0)` })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, trackedAppSlug)
          )
        );

      // Add to account competitors with trackedAppSlug
      const [result] = await db
        .insert(accountCompetitorApps)
        .values({ accountId, trackedAppSlug, appSlug: slug, sortOrder: maxOrder + 1 })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Competitor already added for this app" });
      }

      // If app has no snapshots yet, enqueue a scraper job
      const [existingSnapshot] = await db
        .select({ id: appSnapshots.id })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, slug))
        .limit(1);

      let scraperEnqueued = false;
      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:app_details", {
            type: "app_details",
            slug,
            triggeredBy: "api",
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable — scraper will pick it up on next scheduled run
        }
      }

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

      const whereConditions = [
        eq(accountCompetitorApps.accountId, accountId),
        eq(accountCompetitorApps.appSlug, slug),
      ];
      if (trackedAppSlug) {
        whereConditions.push(
          eq(accountCompetitorApps.trackedAppSlug, trackedAppSlug)
        );
      }

      const deleted = await db
        .delete(accountCompetitorApps)
        .where(and(...whereConditions))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      await syncAppTrackedFlag(db, slug);

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

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, slug)
          )
        );
      if (!trackedApp) {
        return reply.code(404).send({ error: "App not in your apps" });
      }

      const includeSelf = (request.query as any).includeSelf === "true";

      const rows = await db
        .select({
          appSlug: accountCompetitorApps.appSlug,
          sortOrder: accountCompetitorApps.sortOrder,
          createdAt: accountCompetitorApps.createdAt,
          appName: apps.name,
          isBuiltForShopify: apps.isBuiltForShopify,
          launchedDate: apps.launchedDate,
          iconUrl: apps.iconUrl,
        })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, slug)
          )
        )
        .orderBy(asc(accountCompetitorApps.sortOrder));

      // Optionally prepend the tracked app itself for side-by-side comparison
      let allRows: typeof rows = [...rows];
      if (includeSelf) {
        const [selfApp] = await db
          .select({
            appName: apps.name,
            isBuiltForShopify: apps.isBuiltForShopify,
            launchedDate: apps.launchedDate,
            iconUrl: apps.iconUrl,
          })
          .from(apps)
          .where(eq(apps.slug, slug));
        if (selfApp) {
          allRows = [{ appSlug: slug, sortOrder: -1, createdAt: new Date(), ...selfApp } as any, ...rows];
        }
      }

      // Batch-fetch featured section counts (last 30 days)
      const competitorSlugs = allRows.map((r) => r.appSlug);
      const featuredSince = new Date();
      featuredSince.setDate(featuredSince.getDate() - 30);
      const featuredSinceStr = featuredSince.toISOString().slice(0, 10);

      const featuredCountMap = new Map<string, number>();
      if (competitorSlugs.length > 0) {
        const featuredCounts = await db
          .select({
            appSlug: featuredAppSightings.appSlug,
            sectionCount: sql<number>`count(distinct ${featuredAppSightings.surface} || ':' || ${featuredAppSightings.surfaceDetail} || ':' || ${featuredAppSightings.sectionHandle})`,
          })
          .from(featuredAppSightings)
          .where(
            and(
              inArray(featuredAppSightings.appSlug, competitorSlugs),
              sql`${featuredAppSightings.seenDate} >= ${featuredSinceStr}`
            )
          )
          .groupBy(featuredAppSightings.appSlug);

        for (const fc of featuredCounts) {
          featuredCountMap.set(fc.appSlug, fc.sectionCount);
        }
      }

      // Batch-fetch ad keyword counts (last 30 days)
      const adKeywordCountMap = new Map<string, number>();
      if (competitorSlugs.length > 0) {
        const adKeywordCounts = await db
          .select({
            appSlug: keywordAdSightings.appSlug,
            keywordCount: sql<number>`count(distinct ${keywordAdSightings.keywordId})`,
          })
          .from(keywordAdSightings)
          .where(
            and(
              inArray(keywordAdSightings.appSlug, competitorSlugs),
              sql`${keywordAdSightings.seenDate} >= ${featuredSinceStr}`
            )
          )
          .groupBy(keywordAdSightings.appSlug);

        for (const ac of adKeywordCounts) {
          adKeywordCountMap.set(ac.appSlug, ac.keywordCount);
        }
      }

      // Latest category rankings for each competitor
      const categoryRankingMap = new Map<string, { categorySlug: string; categoryTitle: string; position: number }[]>();
      if (competitorSlugs.length > 0) {
        const catRankRows: any[] = await db.execute(sql`
          SELECT DISTINCT ON (r.app_slug, r.category_slug)
            r.app_slug, r.category_slug, c.title AS category_title, r.position
          FROM app_category_rankings r
          JOIN categories c ON c.slug = r.category_slug
          WHERE r.app_slug IN (${sql.join(competitorSlugs.map((s) => sql`${s}`), sql`, `)})
            AND c.is_listing_page = true
          ORDER BY r.app_slug, r.category_slug, r.scraped_at DESC
        `).then((res: any) => (res as any).rows ?? res);
        for (const r of catRankRows) {
          const arr = categoryRankingMap.get(r.app_slug) ?? [];
          arr.push({ categorySlug: r.category_slug, categoryTitle: r.category_title, position: r.position });
          categoryRankingMap.set(r.app_slug, arr);
        }
      }

      // Batch-fetch reverse similar counts (how many apps list each competitor as similar)
      const reverseSimilarMap = new Map<string, number>();
      if (competitorSlugs.length > 0) {
        const rsCounts = await db
          .select({
            similarAppSlug: similarAppSightings.similarAppSlug,
            count: sql<number>`count(distinct ${similarAppSightings.appSlug})::int`,
          })
          .from(similarAppSightings)
          .where(inArray(similarAppSightings.similarAppSlug, competitorSlugs))
          .groupBy(similarAppSightings.similarAppSlug);
        for (const r of rsCounts) {
          reverseSimilarMap.set(r.similarAppSlug, r.count);
        }
      }

      // Batch-fetch review velocity metrics (graceful if table not yet migrated)
      const velocityMap2 = new Map<string, { v7d: number | null; v30d: number | null; v90d: number | null; momentum: string | null }>();
      if (competitorSlugs.length > 0) {
        try {
          const velRows: any[] = await db.execute(sql`
            SELECT DISTINCT ON (app_slug)
              app_slug, v7d, v30d, v90d, momentum
            FROM app_review_metrics
            WHERE app_slug IN (${sql.join(competitorSlugs.map(s => sql`${s}`), sql`, `)})
            ORDER BY app_slug, computed_at DESC
          `).then((res: any) => (res as any).rows ?? res);
          for (const r of velRows) {
            velocityMap2.set(r.app_slug, { v7d: r.v7d, v30d: r.v30d, v90d: r.v90d, momentum: r.momentum });
          }
        } catch { /* table may not exist yet */ }
      }

      // Batch-fetch ranked keyword counts per competitor
      const rankedKeywordMap = new Map<string, number>();
      if (competitorSlugs.length > 0) {
        const kwRows = await db
          .select({ keywordId: accountTrackedKeywords.keywordId })
          .from(accountTrackedKeywords)
          .where(
            and(
              eq(accountTrackedKeywords.accountId, accountId),
              eq(accountTrackedKeywords.trackedAppSlug, slug)
            )
          );
        if (kwRows.length > 0) {
          const kwIds = kwRows.map((r) => r.keywordId);
          const idList = sql.join(kwIds.map((id) => sql`${id}`), sql`,`);
          const slugList = sql.join(competitorSlugs.map((s) => sql`${s}`), sql`,`);
          const rankedRows: any[] = await db.execute(sql`
            SELECT app_slug, COUNT(DISTINCT keyword_id)::int AS cnt
            FROM (
              SELECT DISTINCT ON (app_slug, keyword_id) app_slug, keyword_id, position
              FROM app_keyword_rankings
              WHERE app_slug IN (${slugList})
                AND keyword_id IN (${idList})
              ORDER BY app_slug, keyword_id, scraped_at DESC
            ) latest
            WHERE position IS NOT NULL
            GROUP BY app_slug
          `).then((res: any) => (res as any).rows ?? res);
          for (const r of rankedRows) {
            rankedKeywordMap.set(r.app_slug, r.cnt);
          }
        }
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
            .where(eq(appSnapshots.appSlug, row.appSlug))
            .orderBy(desc(appSnapshots.scrapedAt))
            .limit(1);

          const [change] = await db
            .select({ detectedAt: sql<string | null>`max(detected_at)` })
            .from(sql`app_field_changes`)
            .where(sql`app_slug = ${row.appSlug}`);

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
            categories: appCategories.map((c: any) => {
              const catSlug = c.url ? c.url.replace(/.*\/categories\//, "").replace(/\/.*/, "") : null;
              return { type: c.type || "primary", title: c.title, slug: catSlug };
            }),
            categoryRankings: categoryRankingMap.get(row.appSlug) ?? [],
            reverseSimilarCount: reverseSimilarMap.get(row.appSlug) ?? 0,
            rankedKeywordCount: rankedKeywordMap.get(row.appSlug) ?? 0,
            reviewVelocity: velocityMap2.get(row.appSlug) ?? null,
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

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, trackedAppSlug)
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
          count: sql<number>`count(distinct ${accountCompetitorApps.appSlug})::int`,
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
        .select({ slug: apps.slug })
        .from(apps)
        .where(eq(apps.slug, competitorSlug))
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
        .where(eq(apps.slug, competitorSlug));

      // Determine next sortOrder for this (account, trackedApp) group
      const [{ maxOrder: maxOrd }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${accountCompetitorApps.sortOrder}), 0)` })
        .from(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, trackedAppSlug)
          )
        );

      const [result] = await db
        .insert(accountCompetitorApps)
        .values({
          accountId,
          trackedAppSlug,
          appSlug: competitorSlug,
          sortOrder: maxOrd + 1,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply
          .code(409)
          .send({ error: "Competitor already added for this app" });
      }

      // Enqueue scraper if no snapshots
      const [existingSnapshot] = await db
        .select({ id: appSnapshots.id })
        .from(appSnapshots)
        .where(eq(appSnapshots.appSlug, competitorSlug))
        .limit(1);

      let scraperEnqueued = false;
      if (!existingSnapshot) {
        try {
          const queue = getScraperQueue();
          await queue.add("scrape:app_details", {
            type: "app_details",
            slug: competitorSlug,
            triggeredBy: "api",
          });
          scraperEnqueued = true;
        } catch {
          // Redis unavailable
        }
      }

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

      const deleted = await db
        .delete(accountCompetitorApps)
        .where(
          and(
            eq(accountCompetitorApps.accountId, accountId),
            eq(accountCompetitorApps.trackedAppSlug, trackedAppSlug),
            eq(accountCompetitorApps.appSlug, competitorSlug)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      await syncAppTrackedFlag(db, competitorSlug);

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

      // Update sort_order for each slug based on array index
      await Promise.all(
        slugs.map((slug, index) =>
          db
            .update(accountCompetitorApps)
            .set({ sortOrder: index + 1 })
            .where(
              and(
                eq(accountCompetitorApps.accountId, accountId),
                eq(accountCompetitorApps.trackedAppSlug, trackedAppSlug),
                eq(accountCompetitorApps.appSlug, slug)
              )
            )
        )
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

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, slug)
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
            eq(accountTrackedKeywords.trackedAppSlug, slug)
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
        const slugSql = sql.join(slugList.map((s) => sql`${s}`), sql`, `);
        const idSql = sql.join(keywordIds.map((id) => sql`${id}`), sql`, `);
        const rawResult = await db.execute(sql`
            SELECT DISTINCT ON (app_slug, keyword_id)
              app_slug, keyword_id, position
            FROM app_keyword_rankings
            WHERE app_slug IN (${slugSql})
              AND keyword_id IN (${idSql})
            ORDER BY app_slug, keyword_id, scraped_at DESC
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

      if (!keyword) {
        return reply.code(400).send({ error: "keyword is required" });
      }

      // Verify tracked app belongs to this account
      const [trackedApp] = await db
        .select({ id: accountTrackedApps.id })
        .from(accountTrackedApps)
        .where(
          and(
            eq(accountTrackedApps.accountId, accountId),
            eq(accountTrackedApps.appSlug, trackedAppSlug)
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
        .values({ keyword, slug: kwSlug })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, trackedAppSlug, keywordId: kw.id })
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

      const deleted = await db
        .delete(accountTrackedKeywords)
        .where(
          and(
            eq(accountTrackedKeywords.accountId, accountId),
            eq(accountTrackedKeywords.trackedAppSlug, trackedAppSlug),
            eq(accountTrackedKeywords.keywordId, keywordId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tracked keyword not found" });
      }

      await syncKeywordActiveFlag(db, keywordId);

      return { message: "Keyword removed from tracking" };
    }
  );

  // --- Starred Categories ---

  // GET /api/account/starred-categories
  app.get("/starred-categories", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        categorySlug: accountStarredCategories.categorySlug,
        createdAt: accountStarredCategories.createdAt,
        categoryTitle: categories.title,
        parentSlug: categories.parentSlug,
      })
      .from(accountStarredCategories)
      .innerJoin(
        categories,
        eq(categories.slug, accountStarredCategories.categorySlug)
      )
      .where(eq(accountStarredCategories.accountId, accountId));

    if (rows.length === 0) return rows;

    // Get tracked + competitor slugs for this account
    const [trackedApps, competitorApps] = await Promise.all([
      db.select({ appSlug: accountTrackedApps.appSlug }).from(accountTrackedApps).where(eq(accountTrackedApps.accountId, accountId)),
      db.select({ appSlug: accountCompetitorApps.appSlug }).from(accountCompetitorApps).where(eq(accountCompetitorApps.accountId, accountId)),
    ]);
    const trackedSet = new Set(trackedApps.map((a) => a.appSlug));
    const competitorSet = new Set(competitorApps.map((a) => a.appSlug));

    // Get latest snapshot per starred category for firstPageApps + appCount
    const categorySlugs = rows.map((r) => r.categorySlug);
    const snapshots = await db
      .select({
        categorySlug: categorySnapshots.categorySlug,
        appCount: categorySnapshots.appCount,
        firstPageApps: categorySnapshots.firstPageApps,
      })
      .from(categorySnapshots)
      .where(
        and(
          inArray(categorySnapshots.categorySlug, categorySlugs),
          sql`${categorySnapshots.id} = (
            SELECT s2.id FROM category_snapshots s2
            WHERE s2.category_slug = ${categorySnapshots.categorySlug}
            ORDER BY s2.scraped_at DESC LIMIT 1
          )`
        )
      );

    const snapshotMap = new Map(snapshots.map((s) => [s.categorySlug, s]));

    function extractSlug(appUrl: string): string {
      return appUrl.replace(/^https?:\/\/apps\.shopify\.com\//, "").replace(/^\/apps\//, "").split("?")[0];
    }

    return rows.map((row) => {
      const snap = snapshotMap.get(row.categorySlug);
      const fpApps = (snap?.firstPageApps ?? []) as any[];
      const trackedAppsInResults = fpApps
        .filter((a) => trackedSet.has(extractSlug(a.app_url)))
        .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
      const competitorAppsInResults = fpApps
        .filter((a) => competitorSet.has(extractSlug(a.app_url)))
        .map((a) => ({ ...a, app_slug: extractSlug(a.app_url) }));
      return {
        ...row,
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

      const [result] = await db
        .insert(accountStarredCategories)
        .values({ accountId, categorySlug: slug })
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

      const deleted = await db
        .delete(accountStarredCategories)
        .where(
          sql`${accountStarredCategories.accountId} = ${accountId} AND ${accountStarredCategories.categorySlug} = ${slug}`
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
        SELECT DISTINCT ON (app_slug) id, app_slug, categories
        FROM app_snapshots
        ORDER BY app_slug, scraped_at DESC
      ) s
      INNER JOIN apps a ON a.slug = s.app_slug,
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
      db.select({ appSlug: accountTrackedApps.appSlug }).from(accountTrackedApps).where(eq(accountTrackedApps.accountId, accountId)),
      db.select({ appSlug: accountCompetitorApps.appSlug }).from(accountCompetitorApps).where(eq(accountCompetitorApps.accountId, accountId)),
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
