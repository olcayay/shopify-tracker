/**
 * Email error diagnostics routes for system admins.
 * Error listing, categorization breakdown, and detail view.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, gte } from "drizzle-orm";
import { emailLogs } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const emailErrorRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/email-errors — list recent errors with optional category filter
  app.get("/", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { hours, category, limit } = request.query as {
      hours?: string;
      category?: string;
      limit?: string;
    };

    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 168); // max 7 days
    const pageSize = Math.min(parseInt(limit || "50", 10) || 50, 200);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    let categoryFilter = "";
    if (category) {
      categoryFilter = `AND error_message ILIKE '%${category.replace(/'/g, "''")}%'`;
    }

    const errors = await db.execute(sql`
      SELECT
        id, email_type, recipient_email, status, error_message,
        message_id, created_at, sent_at, bounced_at
      FROM email_logs
      WHERE status = 'failed'
        AND created_at >= ${cutoff}
        ${sql.raw(categoryFilter)}
      ORDER BY created_at DESC
      LIMIT ${pageSize}
    `);

    const rows = (errors as any)?.rows ?? errors;
    return reply.send({ data: rows, count: (rows as any[]).length });
  });

  // GET /api/system-admin/email-errors/breakdown — error distribution by inferred category
  app.get("/breakdown", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { hours } = request.query as { hours?: string };
    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 168);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    const breakdown = await db.execute(sql`
      SELECT
        CASE
          WHEN error_message ILIKE '%authentication%' OR error_message ILIKE '%credentials%' THEN 'smtp_auth'
          WHEN error_message ILIKE '%ECONNREFUSED%' OR error_message ILIKE '%ETIMEDOUT%' OR error_message ILIKE '%connection%timeout%' THEN 'smtp_connection'
          WHEN error_message ILIKE '%all smtp%' OR error_message ILIKE '%ALL_PROVIDERS_DOWN%' THEN 'provider_down'
          WHEN error_message ILIKE '%55_%' OR error_message ILIKE '%rejected%' OR error_message ILIKE '%unknown%user%' THEN 'smtp_rejected'
          WHEN error_message ILIKE '%template%' OR error_message ILIKE '%render%' OR error_message ILIKE '%undefined%' THEN 'template_render'
          WHEN error_message ILIKE '%rate%limit%' THEN 'rate_limited'
          ELSE 'unknown'
        END AS category,
        COUNT(*)::int AS count
      FROM email_logs
      WHERE status = 'failed'
        AND created_at >= ${cutoff}
      GROUP BY 1
      ORDER BY count DESC
    `);

    const rows = (breakdown as any)?.rows ?? breakdown;
    return reply.send({ data: rows, hours: lookbackHours });
  });

  // GET /api/system-admin/email-errors/trend — hourly error trend
  app.get("/trend", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { hours } = request.query as { hours?: string };
    const lookbackHours = Math.min(parseInt(hours || "24", 10) || 24, 168);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - lookbackHours);

    const trend = await db.execute(sql`
      SELECT
        date_trunc('hour', created_at) AS hour,
        COUNT(*)::int AS count,
        COUNT(DISTINCT email_type)::int AS types_affected
      FROM email_logs
      WHERE status = 'failed'
        AND created_at >= ${cutoff}
      GROUP BY 1
      ORDER BY 1
    `);

    const rows = (trend as any)?.rows ?? trend;
    return reply.send({ data: rows, hours: lookbackHours });
  });

  // GET /api/system-admin/email-errors/:id — single error detail
  app.get("/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [error] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.id, id))
      .limit(1);

    if (!error) {
      return reply.code(404).send({ error: "Email log not found" });
    }

    return reply.send({ data: error });
  });
};
