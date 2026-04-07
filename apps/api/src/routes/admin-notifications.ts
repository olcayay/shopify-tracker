import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc, ilike } from "drizzle-orm";
import { notifications, notificationDeliveryLog } from "@appranks/db";

export const adminNotificationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /notifications/stats — Aggregate notification stats
  app.get("/notifications/stats", async () => {
    const [stats] = await db.execute(sql`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE is_read = true) AS read_count,
        count(*) FILTER (WHERE push_sent = true) AS push_sent,
        count(*) FILTER (WHERE push_clicked = true) AS push_clicked,
        count(*) FILTER (WHERE push_error IS NOT NULL) AS failed,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h,
        count(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d
      FROM notifications
    `);

    const row = ((stats as any).rows ?? [stats])[0] || {};
    const total = parseInt(row.total || "0", 10);
    const readCount = parseInt(row.read_count || "0", 10);
    const pushSent = parseInt(row.push_sent || "0", 10);
    const pushClicked = parseInt(row.push_clicked || "0", 10);

    return {
      total,
      readCount,
      readRate: total > 0 ? Math.round((readCount / total) * 10000) / 100 : 0,
      pushSent,
      pushClicked,
      pushClickRate: pushSent > 0 ? Math.round((pushClicked / pushSent) * 10000) / 100 : 0,
      failed: parseInt(row.failed || "0", 10),
      last24h: parseInt(row.last_24h || "0", 10),
      last7d: parseInt(row.last_7d || "0", 10),
    };
  });

  // GET /notifications — List notifications (paginated, filterable)
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      type?: string;
      category?: string;
      status?: string;
      search?: string;
    };
  }>("/notifications", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "50", 10), 200);
    const offset = parseInt(request.query.offset || "0", 10);
    const { type, category, status, search } = request.query;

    const conditions = [];
    if (type) conditions.push(eq(notifications.type, type));
    if (category) conditions.push(eq(notifications.category, category));
    if (status === "read") conditions.push(eq(notifications.isRead, true));
    if (status === "unread") conditions.push(eq(notifications.isRead, false));
    if (search) conditions.push(ilike(notifications.title, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [countRow]] = await Promise.all([
      db
        .select({
          id: notifications.id,
          type: notifications.type,
          category: notifications.category,
          userId: notifications.userId,
          title: notifications.title,
          isRead: notifications.isRead,
          pushSent: notifications.pushSent,
          pushClicked: notifications.pushClicked,
          priority: notifications.priority,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(where),
    ]);

    return { notifications: rows, total: countRow?.count ?? 0, limit, offset };
  });

  // GET /notifications/:id — Notification detail with delivery log
  app.get<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, request.params.id))
      .limit(1);

    if (!notification) {
      return reply.status(404).send({ error: "Notification not found" });
    }

    const deliveryLogs = await db
      .select()
      .from(notificationDeliveryLog)
      .where(eq(notificationDeliveryLog.notificationId, notification.id))
      .orderBy(desc(notificationDeliveryLog.sentAt));

    return { notification, deliveryLogs };
  });

  // ── Retention management (PLA-688) ──────────────────────────────

  // GET /notifications/retention — Get retention stats
  app.get("/notifications/retention", async () => {
    const retentionDays = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || "90", 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const [stats] = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at < ${cutoff.toISOString()})::int AS expired
      FROM notifications
    `);

    const row = ((stats as any).rows ?? [stats])[0] || {};

    return {
      retentionDays,
      cutoffDate: cutoff.toISOString(),
      totalNotifications: parseInt(row.total || "0", 10),
      expiredNotifications: parseInt(row.expired || "0", 10),
    };
  });
};
