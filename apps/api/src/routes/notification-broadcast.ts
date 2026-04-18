/**
 * Admin broadcast notification API (PLA-695, PLA-704).
 * Send notifications to all users or targeted audiences.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql, desc } from "drizzle-orm";
import { notifications } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("notification-broadcast");

/**
 * Build a SQL user query from an audience string.
 * Supported formats:
 *  - "all" — all active users
 *  - "active_last_7d" / "active_last_30d" — recently active
 *  - "platform:<id>" — users tracking a specific platform (e.g. "platform:shopify")
 *  - "user:<uuid>" — single user
 *  - "users:<id1>,<id2>,..." — specific user list
 *  - "account:<uuid>" — all users in an account
 */
function buildAudienceQuery(audience: string): string {
  if (audience === "active_last_7d") {
    return "SELECT id, account_id FROM users WHERE status = 'active' AND last_login_at >= now() - interval '7 days'";
  }
  if (audience === "active_last_30d") {
    return "SELECT id, account_id FROM users WHERE status = 'active' AND last_login_at >= now() - interval '30 days'";
  }
  if (audience.startsWith("platform:")) {
    const platform = audience.slice("platform:".length).replace(/[^a-z0-9_-]/gi, "");
    return `SELECT DISTINCT u.id, u.account_id FROM users u JOIN account_platforms ap ON ap.account_id = u.account_id WHERE u.status = 'active' AND ap.platform = '${platform}'`;
  }
  if (audience.startsWith("user:")) {
    const userId = audience.slice("user:".length).replace(/[^a-f0-9-]/gi, "");
    return `SELECT id, account_id FROM users WHERE id = '${userId}'`;
  }
  if (audience.startsWith("users:")) {
    const ids = audience
      .slice("users:".length)
      .split(",")
      .map((id) => id.trim().replace(/[^a-f0-9-]/gi, ""))
      .filter(Boolean)
      .map((id) => `'${id}'`)
      .join(",");
    if (!ids) return "SELECT id, account_id FROM users WHERE false";
    return `SELECT id, account_id FROM users WHERE id IN (${ids})`;
  }
  if (audience.startsWith("account:")) {
    const accountId = audience.slice("account:".length).replace(/[^a-f0-9-]/gi, "");
    return `SELECT id, account_id FROM users WHERE account_id = '${accountId}' AND status = 'active'`;
  }
  // Default: all active users
  return "SELECT id, account_id FROM users WHERE status = 'active'";
}

export const notificationBroadcastRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // POST /api/system-admin/notifications/broadcast/preview — preview audience size
  app.post("/broadcast/preview", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { audience } = request.body as { audience: string };
    if (!audience) {
      return reply.code(400).send({ error: "audience is required" });
    }

    try {
      const countQuery = `SELECT count(*)::int AS count FROM (${buildAudienceQuery(audience)}) sub`;
      const result: any = await db.execute(sql.raw(countQuery));
      const rows = (result as any)?.rows ?? result ?? [];
      const count = parseInt(rows[0]?.count || "0", 10);

      return { audience, recipientCount: count };
    } catch (err) {
      log.error("broadcast preview failed", { audience, error: String(err) });
      return reply.code(400).send({ error: "Invalid audience filter" });
    }
  });

  // POST /api/system-admin/notifications/broadcast — send to audience (PLA-705: scheduling)
  app.post("/broadcast", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const {
      title,
      body,
      url,
      icon,
      priority,
      audience,
      category,
      scheduledAt,
      useLocalTime,
      localTimeHour,
    } = request.body as {
      title: string;
      body: string;
      url?: string;
      icon?: string;
      priority?: string;
      audience: string;
      category?: string;
      /** ISO8601 timestamp — schedule broadcast for later */
      scheduledAt?: string;
      /** If true, deliver at localTimeHour in each user's timezone */
      useLocalTime?: boolean;
      /** Hour (0-23) to deliver in user's local timezone (default: 9) */
      localTimeHour?: number;
    };

    if (!title || !body || !audience) {
      return reply.code(400).send({ error: "title, body, and audience are required" });
    }

    // If scheduledAt is in the past, reject
    if (scheduledAt && new Date(scheduledAt) <= new Date()) {
      return reply.code(400).send({ error: "scheduledAt must be in the future" });
    }

    try {
      // Extend the query to include timezone for local-time delivery
      const baseQuery = buildAudienceQuery(audience);
      const userQuery = useLocalTime
        ? baseQuery.replace("SELECT ", "SELECT u.timezone, ").replace("SELECT DISTINCT ", "SELECT DISTINCT u.timezone, ")
        : baseQuery;

      const usersResult: any = await db.execute(sql.raw(userQuery));
      const users = (usersResult as any)?.rows ?? usersResult ?? [];
      const batchId = `broadcast-${Date.now()}`;

      // Calculate per-user delay for timezone-aware delivery
      const targetHour = localTimeHour ?? 9;
      const globalDelay = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;

      let inserted = 0;
      let scheduled = 0;
      for (const user of users as any[]) {
        try {
          // Calculate timezone-specific delay if useLocalTime is enabled
          let userDelay = globalDelay;
          if (useLocalTime && user.timezone) {
            try {
              const now = new Date();
              const userNow = new Date(now.toLocaleString("en-US", { timeZone: user.timezone }));
              const targetTime = new Date(userNow);
              targetTime.setHours(targetHour, 0, 0, 0);
              if (targetTime <= userNow) targetTime.setDate(targetTime.getDate() + 1); // next day
              userDelay = targetTime.getTime() - userNow.getTime();
            } catch {
              // Invalid timezone — use global delay
            }
          }

          if (userDelay > 0) {
            // Schedule for later — store in notifications with a scheduledFor marker
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
              // Use eventData to store scheduling info
              eventData: { scheduledFor: new Date(Date.now() + userDelay).toISOString() },
            });
            scheduled++;
          } else {
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
          }
          inserted++;
        } catch (err) {
          log.warn("failed to insert broadcast notification", {
            userId: user.id,
            error: String(err),
          });
        }
      }

      const status = scheduledAt || useLocalTime ? "scheduled" : "sent";
      log.info("broadcast processed", {
        audience,
        totalUsers: (users as any[]).length,
        inserted,
        scheduled,
        status,
        batchId,
      });

      return reply.send({
        message: status === "scheduled" ? "Broadcast scheduled" : "Broadcast sent",
        audience,
        totalUsers: (users as any[]).length,
        inserted,
        scheduled,
        batchId,
        status,
      });
    } catch (err) {
      log.error("broadcast failed", { error: String(err) });
      return reply.code(500).send({ error: "Broadcast failed" });
    }
  });

  // DELETE /api/system-admin/notifications/broadcast/:batchId — cancel scheduled broadcast (PLA-705)
  app.delete<{ Params: { batchId: string } }>("/broadcast/:batchId", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { batchId } = request.params;

    // Delete unread scheduled notifications for this batch
    const result: any = await db.execute(sql`
      DELETE FROM notifications
      WHERE batch_id = ${batchId}
        AND is_read = false
        AND type = 'system_broadcast'
    `);

    const deleted = (result as any)?.rowCount ?? 0;
    log.info("broadcast cancelled", { batchId, deleted });

    return { success: true, deleted, batchId };
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
