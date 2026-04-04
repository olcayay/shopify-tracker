/**
 * Admin broadcast notification API (PLA-695).
 * Send notifications to all users or targeted audiences.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql, desc } from "drizzle-orm";
import { notifications } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("notification-broadcast");

export const notificationBroadcastRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /api/system-admin/notifications/broadcast — send to audience
  app.post("/broadcast", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const {
      title,
      body,
      url,
      icon,
      priority,
      audience,
      category,
    } = request.body as {
      title: string;
      body: string;
      url?: string;
      icon?: string;
      priority?: string;
      audience: "all" | "active_last_7d" | "active_last_30d";
      category?: string;
    };

    if (!title || !body || !audience) {
      return reply.code(400).send({ error: "title, body, and audience are required" });
    }

    // Build user query based on audience
    let userQuery: string;
    switch (audience) {
      case "active_last_7d":
        userQuery = "SELECT id, account_id FROM users WHERE status = 'active' AND last_login_at >= now() - interval '7 days'";
        break;
      case "active_last_30d":
        userQuery = "SELECT id, account_id FROM users WHERE status = 'active' AND last_login_at >= now() - interval '30 days'";
        break;
      case "all":
      default:
        userQuery = "SELECT id, account_id FROM users WHERE status = 'active'";
        break;
    }

    try {
      const usersResult: any = await db.execute(sql.raw(userQuery));
      const users = (usersResult as any)?.rows ?? usersResult ?? [];
      const batchId = `broadcast-${Date.now()}`;

      let inserted = 0;
      for (const user of users as any[]) {
        try {
          await db.insert(notifications).values({
            userId: user.id,
            accountId: user.account_id,
            type: "system_broadcast",
            category: category || "system",
            title,
            body,
            url: url || null,
            icon: icon || null,
            priority: priority || "normal",
            batchId,
          });
          inserted++;
        } catch (err) {
          log.warn("failed to insert broadcast notification", {
            userId: user.id,
            error: String(err),
          });
        }
      }

      log.info("broadcast sent", { audience, totalUsers: (users as any[]).length, inserted, batchId });

      return reply.send({
        message: "Broadcast sent",
        audience,
        totalUsers: (users as any[]).length,
        inserted,
        batchId,
      });
    } catch (err) {
      log.error("broadcast failed", { error: String(err) });
      return reply.code(500).send({ error: "Broadcast failed" });
    }
  });

  // GET /api/system-admin/notifications/broadcasts — list past broadcasts
  app.get("/broadcasts", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const pageSize = Math.min(parseInt(limit || "20", 10) || 20, 100);

    const broadcasts = await db.execute(sql`
      SELECT
        batch_id,
        MIN(title) AS title,
        MIN(body) AS body,
        MIN(category) AS category,
        COUNT(*)::int AS recipient_count,
        COUNT(*) FILTER (WHERE is_read = true)::int AS read_count,
        MIN(created_at) AS created_at
      FROM notifications
      WHERE batch_id IS NOT NULL AND batch_id LIKE 'broadcast-%'
      GROUP BY batch_id
      ORDER BY MIN(created_at) DESC
      LIMIT ${pageSize}
    `);

    const rows = (broadcasts as any)?.rows ?? broadcasts;
    return reply.send({ data: rows });
  });
};
