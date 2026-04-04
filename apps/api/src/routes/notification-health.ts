/**
 * Notification health monitoring API (PLA-696).
 * Worker metrics, delivery success rates, queue depth.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { Queue } from "bullmq";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export const notificationHealthRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/notification-health — system health overview
  app.get("/", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const result: Record<string, unknown> = {};

    // Queue stats
    try {
      const q = new Queue("notifications", { connection: getRedisConnection() });
      const counts = await q.getJobCounts();
      result.queue = {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      };
      await q.close();
    } catch {
      result.queue = { error: "unavailable" };
    }

    // Delivery stats (last 24h)
    try {
      const [stats]: any[] = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_read = true)::int AS read_count,
          COUNT(*) FILTER (WHERE push_sent = true)::int AS push_sent,
          COUNT(*) FILTER (WHERE push_clicked = true)::int AS push_clicked,
          COUNT(*) FILTER (WHERE push_dismissed = true)::int AS push_dismissed,
          COUNT(*) FILTER (WHERE push_error IS NOT NULL)::int AS push_errors
        FROM notifications
        WHERE created_at >= now() - interval '24 hours'
      `);
      const row = (stats as any)?.rows?.[0] ?? stats;
      const total = Number(row?.total || 0);
      const pushSent = Number(row?.push_sent || 0);
      result.last24h = {
        total,
        readCount: Number(row?.read_count || 0),
        readRate: total > 0 ? Math.round((Number(row?.read_count || 0) / total) * 100) : 0,
        pushSent,
        pushClicked: Number(row?.push_clicked || 0),
        pushDismissed: Number(row?.push_dismissed || 0),
        pushErrors: Number(row?.push_errors || 0),
        pushClickRate: pushSent > 0 ? Math.round((Number(row?.push_clicked || 0) / pushSent) * 100) : 0,
      };
    } catch {
      result.last24h = { error: "unavailable" };
    }

    // Active push subscriptions
    try {
      const [subs]: any[] = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active,
          COUNT(*) FILTER (WHERE failure_count >= 3)::int AS degraded
        FROM push_subscriptions
      `);
      const row = (subs as any)?.rows?.[0] ?? subs;
      result.pushSubscriptions = {
        total: Number(row?.total || 0),
        active: Number(row?.active || 0),
        degraded: Number(row?.degraded || 0),
      };
    } catch {
      result.pushSubscriptions = { error: "unavailable" };
    }

    // Per-type breakdown (last 7 days)
    try {
      const byType = await db.execute(sql`
        SELECT
          type,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE is_read = true)::int AS read_count
        FROM notifications
        WHERE created_at >= now() - interval '7 days'
        GROUP BY type
        ORDER BY count DESC
        LIMIT 20
      `);
      result.byType = (byType as any)?.rows ?? byType;
    } catch {
      result.byType = [];
    }

    // Overall status
    const queueStats = result.queue as any;
    const stats24h = result.last24h as any;
    let status = "healthy";
    if ((queueStats?.waiting ?? 0) > 100 || (stats24h?.pushErrors ?? 0) > 50) {
      status = "unhealthy";
    } else if ((queueStats?.waiting ?? 0) > 30 || (queueStats?.failed ?? 0) > 10) {
      status = "degraded";
    }

    return reply.send({
      timestamp: new Date().toISOString(),
      status,
      ...result,
    });
  });
};
