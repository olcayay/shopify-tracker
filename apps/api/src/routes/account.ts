import type { FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  createDb,
  accounts,
  users,
  invitations,
  apps,
  trackedKeywords,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
} from "@shopify-tracking/db";
import { requireRole } from "../middleware/authorize.js";

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
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, accountId));

    const [competitorAppsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountCompetitorApps)
      .where(eq(accountCompetitorApps.accountId, accountId));

    return {
      id: account.id,
      name: account.name,
      isSuspended: account.isSuspended,
      limits: {
        maxTrackedApps: account.maxTrackedApps,
        maxTrackedKeywords: account.maxTrackedKeywords,
        maxCompetitorApps: account.maxCompetitorApps,
      },
      usage: {
        trackedApps: trackedAppsCount.count,
        trackedKeywords: trackedKeywordsCount.count,
        competitorApps: competitorAppsCount.count,
      },
    };
  });

  // PUT /api/account — update account name
  app.put(
    "/",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { name } = request.body as { name?: string };

      if (!name) {
        return reply.code(400).send({ error: "name is required" });
      }

      const [updated] = await db
        .update(accounts)
        .set({ name, updatedAt: new Date() })
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

      // Check if email is already in this account
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existing) {
        return reply
          .code(409)
          .send({ error: "User with this email already exists" });
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

      // Ensure app exists in global table
      await db
        .insert(apps)
        .values({ slug, name: slug, isTracked: true })
        .onConflictDoUpdate({
          target: apps.slug,
          set: { isTracked: true, updatedAt: new Date() },
        });

      // Add to account tracking
      const [result] = await db
        .insert(accountTrackedApps)
        .values({ accountId, appSlug: slug })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "App already tracked" });
      }

      return result;
    }
  );

  // DELETE /api/account/tracked-apps/:slug
  app.delete<{ Params: { slug: string } }>(
    "/tracked-apps/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = request.params;

      const deleted = await db
        .delete(accountTrackedApps)
        .where(
          sql`${accountTrackedApps.accountId} = ${accountId} AND ${accountTrackedApps.appSlug} = ${slug}`
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tracked app not found" });
      }

      await syncAppTrackedFlag(db, slug);

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
      const { keyword } = request.body as { keyword?: string };

      if (!keyword) {
        return reply.code(400).send({ error: "keyword is required" });
      }

      // Check limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
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
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword })
        .onConflictDoUpdate({
          target: trackedKeywords.keyword,
          set: { isActive: true, updatedAt: new Date() },
        })
        .returning();

      // Add to account tracking
      const [result] = await db
        .insert(accountTrackedKeywords)
        .values({ accountId, keywordId: kw.id })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Keyword already tracked" });
      }

      return { ...result, keyword: kw.keyword };
    }
  );

  // DELETE /api/account/tracked-keywords/:id
  app.delete<{ Params: { id: string } }>(
    "/tracked-keywords/:id",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const keywordId = parseInt(request.params.id, 10);

      const deleted = await db
        .delete(accountTrackedKeywords)
        .where(
          sql`${accountTrackedKeywords.accountId} = ${accountId} AND ${accountTrackedKeywords.keywordId} = ${keywordId}`
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Tracked keyword not found" });
      }

      await syncKeywordActiveFlag(db, keywordId);

      return { message: "Keyword removed from tracking" };
    }
  );

  // --- Competitor Apps ---

  // GET /api/account/competitors
  app.get("/competitors", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        appSlug: accountCompetitorApps.appSlug,
        createdAt: accountCompetitorApps.createdAt,
        appName: apps.name,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, accountId));

    return rows;
  });

  // POST /api/account/competitors
  app.post(
    "/competitors",
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
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId));

      if (count >= account.maxCompetitorApps) {
        return reply.code(403).send({
          error: "Competitor apps limit reached",
          current: count,
          max: account.maxCompetitorApps,
        });
      }

      // Ensure app exists in global table
      await db
        .insert(apps)
        .values({ slug, name: slug, isTracked: true })
        .onConflictDoUpdate({
          target: apps.slug,
          set: { isTracked: true, updatedAt: new Date() },
        });

      // Add to account competitors
      const [result] = await db
        .insert(accountCompetitorApps)
        .values({ accountId, appSlug: slug })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Competitor already tracked" });
      }

      return result;
    }
  );

  // DELETE /api/account/competitors/:slug
  app.delete<{ Params: { slug: string } }>(
    "/competitors/:slug",
    { preHandler: [requireRole("owner", "editor")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { slug } = request.params;

      const deleted = await db
        .delete(accountCompetitorApps)
        .where(
          sql`${accountCompetitorApps.accountId} = ${accountId} AND ${accountCompetitorApps.appSlug} = ${slug}`
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Competitor not found" });
      }

      await syncAppTrackedFlag(db, slug);

      return { message: "Competitor removed" };
    }
  );
};
