import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { Queue } from "bullmq";
import {
  createDb,
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
} from "@shopify-tracking/db";
import { requireRole } from "../middleware/authorize.js";

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

    const [trackedFeaturesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, accountId));

    const [usersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.accountId, accountId));

    return {
      id: account.id,
      name: account.name,
      isSuspended: account.isSuspended,
      limits: {
        maxTrackedApps: account.maxTrackedApps,
        maxTrackedKeywords: account.maxTrackedKeywords,
        maxCompetitorApps: account.maxCompetitorApps,
        maxTrackedFeatures: account.maxTrackedFeatures,
        maxUsers: account.maxUsers,
      },
      usage: {
        trackedApps: trackedAppsCount.count,
        trackedKeywords: trackedKeywordsCount.count,
        competitorApps: competitorAppsCount.count,
        trackedFeatures: trackedFeaturesCount.count,
        users: usersCount.count,
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
      const slug = keywordToSlug(keyword);
      const [kw] = await db
        .insert(trackedKeywords)
        .values({ keyword, slug })
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
        isBuiltForShopify: apps.isBuiltForShopify,
        launchedDate: apps.launchedDate,
      })
      .from(accountCompetitorApps)
      .innerJoin(apps, eq(apps.slug, accountCompetitorApps.appSlug))
      .where(eq(accountCompetitorApps.accountId, accountId));

    // Attach latest snapshot summary for each competitor
    const result = await Promise.all(
      rows.map(async (row) => {
        const [snapshot] = await db
          .select({
            averageRating: appSnapshots.averageRating,
            ratingCount: appSnapshots.ratingCount,
            pricing: appSnapshots.pricing,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appSlug, row.appSlug))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        return { ...row, latestSnapshot: snapshot || null };
      })
    );

    return result;
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

      // Check app exists in global table
      const [existingApp] = await db
        .select({ slug: apps.slug })
        .from(apps)
        .where(eq(apps.slug, slug))
        .limit(1);

      if (!existingApp) {
        return reply
          .code(404)
          .send({ error: "App not found. Only existing apps can be added as competitors." });
      }

      // Mark as tracked
      await db
        .update(apps)
        .set({ isTracked: true, updatedAt: new Date() })
        .where(eq(apps.slug, slug));

      // Add to account competitors
      const [result] = await db
        .insert(accountCompetitorApps)
        .values({ accountId, appSlug: slug })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        return reply.code(409).send({ error: "Competitor already tracked" });
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

    return rows;
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

  // GET /api/account/tracked-features
  app.get("/tracked-features", async (request) => {
    const { accountId } = request.user;

    const rows = await db
      .select({
        featureHandle: accountTrackedFeatures.featureHandle,
        featureTitle: accountTrackedFeatures.featureTitle,
        createdAt: accountTrackedFeatures.createdAt,
      })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, accountId));

    // Enrich with category info from snapshots
    if (rows.length > 0) {
      const handles = rows.map((r) => r.featureHandle);
      const handleList = sql.join(handles.map((h) => sql`${h}`), sql`,`);
      const catResult = await db.execute(sql`
        SELECT DISTINCT ON (f->>'feature_handle')
          f->>'feature_handle' AS handle,
          cat->>'title' AS category_title,
          sub->>'title' AS subcategory_title
        FROM app_snapshots,
          jsonb_array_elements(categories) AS cat,
          jsonb_array_elements(cat->'subcategories') AS sub,
          jsonb_array_elements(sub->'features') AS f
        WHERE f->>'feature_handle' IN (${handleList})
        ORDER BY f->>'feature_handle'
      `);
      const catRows: any[] = (catResult as any).rows ?? catResult;
      const catMap = new Map(catRows.map((r: any) => [r.handle, r]));
      return rows.map((r) => {
        const cat = catMap.get(r.featureHandle);
        return {
          ...r,
          categoryTitle: cat?.category_title || null,
          subcategoryTitle: cat?.subcategory_title || null,
        };
      });
    }

    return rows;
  });

  // POST /api/account/tracked-features
  app.post(
    "/tracked-features",
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

      // Check limit
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accountTrackedFeatures)
        .where(eq(accountTrackedFeatures.accountId, accountId));

      if (count >= account.maxTrackedFeatures) {
        return reply.code(403).send({
          error: "Tracked features limit reached",
          current: count,
          max: account.maxTrackedFeatures,
        });
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
        return reply.code(409).send({ error: "Feature already tracked" });
      }

      return result;
    }
  );

  // DELETE /api/account/tracked-features/:handle
  app.delete<{ Params: { handle: string } }>(
    "/tracked-features/:handle",
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
        return reply.code(404).send({ error: "Tracked feature not found" });
      }

      return { message: "Feature removed from tracking" };
    }
  );
};
