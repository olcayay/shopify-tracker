import type { FastifyPluginAsync } from "fastify";
import { eq, sql, desc } from "drizzle-orm";
import {
  packages,
  accounts,
  users,
  apps,
  trackedKeywords,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountTrackedFeatures,
  researchProjects,
  accountActivityLog,
} from "@appranks/db";
import { requireRole } from "../middleware/authorize.js";
import { updateAccountSchema } from "../schemas/account.js";


export const accountInfoRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/account — account details + limits + usage
  app.get("/", async (request) => {
    const { accountId } = request.user;

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));

    if (!account) {
      return { error: "Account not found" };
    }

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

  // GET /api/account/stats — per-platform counts (apps, keywords, competitors)
  // Returns counts and single-item slugs for each platform in one response.
  app.get("/stats", async (request) => {
    const { accountId } = request.user;

    // Batch: counts + single-item slugs per platform in 3 queries
    const [appRows, kwRows, compRows] = await Promise.all([
      // Apps per platform with slug when count=1
      db.execute(sql`
        SELECT a.platform,
               count(*)::int AS count,
               CASE WHEN count(*) = 1 THEN min(a.slug) END AS single_slug
        FROM account_tracked_apps t
        JOIN apps a ON a.id = t.app_id
        WHERE t.account_id = ${accountId}
        GROUP BY a.platform
      `),
      // Distinct keywords per platform (via tracked app's platform)
      db.execute(sql`
        SELECT a.platform,
               count(DISTINCT tk.keyword_id)::int AS count,
               CASE WHEN count(DISTINCT tk.keyword_id) = 1 THEN min(k.slug) END AS single_slug
        FROM account_tracked_keywords tk
        JOIN apps a ON a.id = tk.tracked_app_id
        JOIN tracked_keywords k ON k.id = tk.keyword_id
        WHERE tk.account_id = ${accountId}
        GROUP BY a.platform
      `),
      // Distinct competitors per platform (via tracked app's platform)
      db.execute(sql`
        SELECT a.platform,
               count(DISTINCT c.competitor_app_id)::int AS count,
               CASE WHEN count(DISTINCT c.competitor_app_id) = 1 THEN min(ca.slug) END AS single_slug
        FROM account_competitor_apps c
        JOIN apps a ON a.id = c.tracked_app_id
        JOIN apps ca ON ca.id = c.competitor_app_id
        WHERE c.account_id = ${accountId}
        GROUP BY a.platform
      `),
    ]);

    const appData: any[] = (appRows as any).rows ?? appRows;
    const kwData: any[] = (kwRows as any).rows ?? kwRows;
    const compData: any[] = (compRows as any).rows ?? compRows;

    // Build per-platform stats map
    const stats: Record<string, { apps: number; keywords: number; competitors: number; appSlug?: string; keywordSlug?: string; competitorSlug?: string }> = {};

    for (const r of appData) {
      if (!stats[r.platform]) stats[r.platform] = { apps: 0, keywords: 0, competitors: 0 };
      stats[r.platform].apps = r.count;
      if (r.single_slug) stats[r.platform].appSlug = r.single_slug;
    }
    for (const r of kwData) {
      if (!stats[r.platform]) stats[r.platform] = { apps: 0, keywords: 0, competitors: 0 };
      stats[r.platform].keywords = r.count;
      if (r.single_slug) stats[r.platform].keywordSlug = r.single_slug;
    }
    for (const r of compData) {
      if (!stats[r.platform]) stats[r.platform] = { apps: 0, keywords: 0, competitors: 0 };
      stats[r.platform].competitors = r.count;
      if (r.single_slug) stats[r.platform].competitorSlug = r.single_slug;
    }

    return stats;
  });

  // PUT /api/account — update account name and company
  app.put(
    "/",
    { preHandler: [requireRole("owner")] },
    async (request, reply) => {
      const { accountId } = request.user;
      const { name, company } = updateAccountSchema.parse(request.body);

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

  // GET /api/account/activity — recent account activity feed
  app.get("/activity", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const { limit = "20", offset = "0" } = request.query as { limit?: string; offset?: string };
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = Math.max(0, parseInt(offset, 10) || 0);

    const activities = await db
      .select({
        id: accountActivityLog.id,
        action: accountActivityLog.action,
        entityType: accountActivityLog.entityType,
        entityId: accountActivityLog.entityId,
        metadata: accountActivityLog.metadata,
        createdAt: accountActivityLog.createdAt,
        userEmail: sql<string>`(SELECT email FROM users WHERE id = ${accountActivityLog.userId})`,
      })
      .from(accountActivityLog)
      .where(eq(accountActivityLog.accountId, request.user.accountId))
      .orderBy(desc(accountActivityLog.createdAt))
      .limit(pageSize)
      .offset(skip);

    return { activities };
  });
};
