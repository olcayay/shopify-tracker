/**
 * Notification analytics API (PLA-694).
 * Time-series metrics, per-type breakdown, push adoption.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const notificationAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/notification-analytics/overview
  app.get("/overview", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookback = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookback);

    const [result]: any[] = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_read = true)::int AS read_count,
        COUNT(*) FILTER (WHERE push_sent = true)::int AS push_sent,
        COUNT(*) FILTER (WHERE push_clicked = true)::int AS push_clicked,
        COUNT(*) FILTER (WHERE push_dismissed = true)::int AS push_dismissed,
        COUNT(*) FILTER (WHERE is_archived = true)::int AS archived
      FROM notifications
      WHERE created_at >= ${cutoff}
    `);
    const row = (result as any)?.rows?.[0] ?? result;
    const total = Number(row?.total || 0);
    const pushSent = Number(row?.push_sent || 0);

    return reply.send({
      days: lookback,
      total,
      readCount: Number(row?.read_count || 0),
      readRate: total > 0 ? Math.round((Number(row?.read_count || 0) / total) * 100) : 0,
      pushSent,
      pushClicked: Number(row?.push_clicked || 0),
      pushClickRate: pushSent > 0 ? Math.round((Number(row?.push_clicked || 0) / pushSent) * 100) : 0,
      archived: Number(row?.archived || 0),
    });
  });

  // GET /api/system-admin/notification-analytics/trends
  app.get("/trends", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookback = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookback);

    const trends = await db.execute(sql`
      SELECT
        date_trunc('day', created_at)::date::text AS date,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_read = true)::int AS read_count,
        COUNT(*) FILTER (WHERE push_sent = true)::int AS push_sent
      FROM notifications
      WHERE created_at >= ${cutoff}
      GROUP BY 1
      ORDER BY 1
    `);
    return reply.send({ data: (trends as any)?.rows ?? trends });
  });

  // GET /api/system-admin/notification-analytics/by-type
  app.get("/by-type", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookback = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookback);

    const byType = await db.execute(sql`
      SELECT
        type,
        category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_read = true)::int AS read_count,
        COUNT(*) FILTER (WHERE push_sent = true)::int AS push_sent,
        COUNT(*) FILTER (WHERE push_clicked = true)::int AS push_clicked
      FROM notifications
      WHERE created_at >= ${cutoff}
      GROUP BY type, category
      ORDER BY total DESC
    `);
    return reply.send({ data: (byType as any)?.rows ?? byType });
  });

  // GET /api/system-admin/notification-analytics/push-adoption
  app.get("/push-adoption", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const [subs]: any[] = await db.execute(sql`
      SELECT
        COUNT(DISTINCT user_id)::int AS users_with_push,
        COUNT(*)::int AS total_subscriptions,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_subscriptions,
        COUNT(*) FILTER (WHERE failure_count >= 3)::int AS degraded
      FROM push_subscriptions
    `);
    const row = (subs as any)?.rows?.[0] ?? subs;

    const [totalUsers]: any[] = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM users WHERE status = 'active'
    `);
    const userRow = (totalUsers as any)?.rows?.[0] ?? totalUsers;
    const total = Number(userRow?.count || 0);
    const withPush = Number(row?.users_with_push || 0);

    return reply.send({
      totalActiveUsers: total,
      usersWithPush: withPush,
      adoptionRate: total > 0 ? Math.round((withPush / total) * 100) : 0,
      totalSubscriptions: Number(row?.total_subscriptions || 0),
      activeSubscriptions: Number(row?.active_subscriptions || 0),
      degraded: Number(row?.degraded || 0),
    });
  });
};
