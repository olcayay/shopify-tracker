import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { accountActivityLog, users } from "@appranks/db";

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

    return { logs, total, page, limit };
  });
};
