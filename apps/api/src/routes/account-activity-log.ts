import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { accountActivityLog, users, apps } from "@appranks/db";

export const accountActivityLogRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/account/activity-log
  app.get("/activity-log", async (request) => {
    const { accountId } = request.user;
    const {
      page: pageStr = "1",
      limit: limitStr = "25",
      action,
      entityType,
      userId,
    } = request.query as {
      page?: string;
      limit?: string;
      action?: string;
      entityType?: string;
      userId?: string;
    };

    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [eq(accountActivityLog.accountId, accountId)];
    if (action) {
      conditions.push(eq(accountActivityLog.action, action));
    }
    if (entityType) {
      conditions.push(eq(accountActivityLog.entityType, entityType));
    }
    if (userId) {
      conditions.push(eq(accountActivityLog.userId, userId));
    }

    const where = and(...conditions);

    // Fetch logs with user info
    const [logs, [{ total }]] = await Promise.all([
      db
        .select({
          id: accountActivityLog.id,
          action: accountActivityLog.action,
          entityType: accountActivityLog.entityType,
          entityId: accountActivityLog.entityId,
          metadata: accountActivityLog.metadata,
          createdAt: accountActivityLog.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(accountActivityLog)
        .leftJoin(users, eq(accountActivityLog.userId, users.id))
        .where(where)
        .orderBy(desc(accountActivityLog.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(accountActivityLog)
        .where(where),
    ]);

    // Enrich metadata: resolve missing app names from slugs
    const slugsToResolve = new Set<string>();
    for (const log of logs) {
      const m = log.metadata as Record<string, unknown> | null;
      if (!m) continue;
      const action = log.action;
      if (action === "competitor_added" || action === "competitor_removed") {
        if (m.competitorSlug && !m.competitorName) slugsToResolve.add(m.competitorSlug as string);
        if (m.trackedAppSlug && !m.trackedAppName) slugsToResolve.add(m.trackedAppSlug as string);
      } else if (action === "app_tracked" || action === "app_untracked") {
        if (m.slug && !m.appName) slugsToResolve.add(m.slug as string);
      } else if (action === "keyword_tracked") {
        if (m.appSlug && !m.appName) slugsToResolve.add(m.appSlug as string);
      }
    }

    if (slugsToResolve.size > 0) {
      const slugArr = [...slugsToResolve];
      const appRows = await db
        .select({ slug: apps.slug, name: apps.name, platform: apps.platform })
        .from(apps)
        .where(inArray(apps.slug, slugArr));
      // Build lookup: "platform:slug" → name (fallback to slug-only key)
      const nameMap = new Map<string, string>();
      for (const row of appRows) {
        nameMap.set(`${row.platform}:${row.slug}`, row.name);
        if (!nameMap.has(row.slug)) nameMap.set(row.slug, row.name);
      }

      for (const log of logs) {
        const m = log.metadata as Record<string, unknown> | null;
        if (!m) continue;
        const platform = m.platform as string | undefined;
        const action = log.action;
        if (action === "competitor_added" || action === "competitor_removed") {
          if (m.competitorSlug && !m.competitorName) {
            const key = platform ? `${platform}:${m.competitorSlug}` : (m.competitorSlug as string);
            m.competitorName = nameMap.get(key) ?? nameMap.get(m.competitorSlug as string);
          }
          if (m.trackedAppSlug && !m.trackedAppName) {
            const key = platform ? `${platform}:${m.trackedAppSlug}` : (m.trackedAppSlug as string);
            m.trackedAppName = nameMap.get(key) ?? nameMap.get(m.trackedAppSlug as string);
          }
        } else if (action === "app_tracked" || action === "app_untracked") {
          if (m.slug && !m.appName) {
            const key = platform ? `${platform}:${m.slug}` : (m.slug as string);
            m.appName = nameMap.get(key) ?? nameMap.get(m.slug as string);
          }
        } else if (action === "keyword_tracked") {
          if (m.appSlug && !m.appName) {
            const key = platform ? `${platform}:${m.appSlug}` : (m.appSlug as string);
            m.appName = nameMap.get(key) ?? nameMap.get(m.appSlug as string);
          }
        }
      }
    }

    return { logs, total, page, limit };
  });
};
