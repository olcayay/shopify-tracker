/**
 * Email analytics API routes — time-series metrics, trends,
 * type comparison, and engagement data for admin dashboard.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql, desc, gte } from "drizzle-orm";
import { emailDailyStats, emailLogs } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const emailAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/email-analytics/overview — last 30 days summary
  app.get("/overview", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookbackDays = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const [result]: any[] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
        COUNT(*) FILTER (WHERE status = 'complained') AS complained,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
    `);

    const row = (result as any)?.rows?.[0] ?? result;
    const sent = Number(row?.sent || 0);
    const opened = Number(row?.opened || 0);
    const clicked = Number(row?.clicked || 0);
    const bounced = Number(row?.bounced || 0);
    const total = Number(row?.total || 0);

    return reply.send({
      days: lookbackDays,
      sent,
      delivered: Number(row?.delivered || 0),
      opened,
      clicked,
      bounced,
      complained: Number(row?.complained || 0),
      failed: Number(row?.failed || 0),
      total,
      deliveryRate: sent > 0 ? Math.round((Number(row?.delivered || 0) / sent) * 10000) / 100 : 0,
      openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 10000) / 100 : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
    });
  });

  // GET /api/system-admin/email-analytics/trends — daily time-series data
  app.get("/trends", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookbackDays = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const trends = await db.execute(sql`
      SELECT
        date_trunc('day', created_at)::date::text AS date,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) AS sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
      GROUP BY 1
      ORDER BY 1
    `);

    const rows = (trends as any)?.rows ?? trends;
    return reply.send({ data: rows, days: lookbackDays });
  });

  // GET /api/system-admin/email-analytics/by-type — per email type breakdown
  app.get("/by-type", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookbackDays = Math.min(parseInt(days || "30", 10) || 30, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const byType = await db.execute(sql`
      SELECT
        email_type,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) AS sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
      GROUP BY email_type
      ORDER BY COUNT(*) DESC
    `);

    const rows = (byType as any)?.rows ?? byType;

    // Calculate rates
    const data = (rows as any[]).map((r: any) => {
      const sent = Number(r.sent || 0);
      const opened = Number(r.opened || 0);
      return {
        emailType: r.email_type,
        total: Number(r.total || 0),
        sent,
        opened,
        clicked: Number(r.clicked || 0),
        bounced: Number(r.bounced || 0),
        failed: Number(r.failed || 0),
        openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
        clickRate: opened > 0 ? Math.round((Number(r.clicked || 0) / opened) * 10000) / 100 : 0,
      };
    });

    return reply.send({ data, days: lookbackDays });
  });

  // GET /api/system-admin/email-analytics/engagement — hourly/daily heatmap data
  app.get("/engagement", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Opens by day-of-week and hour
    const heatmap = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM opened_at) AS day_of_week,
        EXTRACT(HOUR FROM opened_at) AS hour,
        COUNT(*) AS opens
      FROM email_logs
      WHERE opened_at IS NOT NULL
        AND opened_at >= ${cutoff.toISOString()}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    const rows = (heatmap as any)?.rows ?? heatmap;
    return reply.send({ data: rows });
  });

  // GET /api/system-admin/email-analytics/hourly — hourly counts grouped by email type
  app.get("/hourly", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { hours } = request.query as { hours?: string };
    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 72);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    const hourly = await db.execute(sql`
      SELECT
        date_trunc('hour', created_at)::text AS hour,
        email_type,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) AS sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
        COUNT(*) AS total
      FROM email_logs
      WHERE created_at >= ${cutoff.toISOString()}
      GROUP BY 1, 2
      ORDER BY 1
    `);

    const rows = (hourly as any)?.rows ?? hourly;

    // Pivot: group by hour, with each email_type as a key
    const hourMap = new Map<string, Record<string, number>>();
    const emailTypes = new Set<string>();

    for (const row of rows as any[]) {
      const hour = row.hour;
      emailTypes.add(row.email_type);
      if (!hourMap.has(hour)) hourMap.set(hour, {});
      const entry = hourMap.get(hour)!;
      entry[row.email_type] = Number(row.total || 0);
    }

    const data = Array.from(hourMap.entries()).map(([hour, counts]) => ({
      time: hour,
      ...counts,
    }));

    return reply.send({
      data,
      emailTypes: Array.from(emailTypes).sort(),
      hours: lookbackHours,
    });
  });
};
