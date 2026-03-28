import type { FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import {
  createDb,
  packages,
  accounts,
  users,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountTrackedFeatures,
  researchProjects,
} from "@appranks/db";
import { requireRole } from "../middleware/authorize.js";
import { updateAccountSchema } from "../schemas/account.js";

type Db = ReturnType<typeof createDb>;

export const accountInfoRoutes: FastifyPluginAsync = async (app) => {
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
};
