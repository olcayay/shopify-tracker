/**
 * Email log search and export routes for system admins.
 * Full-text search, advanced filtering, and CSV/JSON export.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, gte, lte, like, ilike } from "drizzle-orm";
import { emailLogs } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const emailLogRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/email-logs — search and filter email logs
  app.get("/", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const query = request.query as {
      search?: string;
      status?: string;
      email_type?: string;
      recipient?: string;
      from_date?: string;
      to_date?: string;
      limit?: string;
      offset?: string;
    };

    const pageSize = Math.min(parseInt(query.limit || "50", 10) || 50, 200);
    const skip = Math.max(parseInt(query.offset || "0", 10) || 0, 0);

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (query.status) {
      conditions.push(eq(emailLogs.status, query.status));
    }
    if (query.email_type) {
      conditions.push(eq(emailLogs.emailType, query.email_type));
    }
    if (query.recipient) {
      conditions.push(ilike(emailLogs.recipientEmail, `%${query.recipient}%`));
    }
    if (query.from_date) {
      conditions.push(gte(emailLogs.createdAt, new Date(query.from_date)));
    }
    if (query.to_date) {
      conditions.push(lte(emailLogs.createdAt, new Date(query.to_date)));
    }
    if (query.search) {
      // Search in subject and recipient
      conditions.push(
        sql`(${emailLogs.subject} ILIKE ${"%" + query.search + "%"} OR ${emailLogs.recipientEmail} ILIKE ${"%" + query.search + "%"})`
      );
    }

    let dbQuery = db
      .select({
        id: emailLogs.id,
        emailType: emailLogs.emailType,
        recipientEmail: emailLogs.recipientEmail,
        recipientName: emailLogs.recipientName,
        subject: emailLogs.subject,
        status: emailLogs.status,
        sentAt: emailLogs.sentAt,
        openedAt: emailLogs.openedAt,
        clickedAt: emailLogs.clickedAt,
        bouncedAt: emailLogs.bouncedAt,
        errorMessage: emailLogs.errorMessage,
        messageId: emailLogs.messageId,
        createdAt: emailLogs.createdAt,
      })
      .from(emailLogs)
      .orderBy(desc(emailLogs.createdAt))
      .limit(pageSize)
      .offset(skip);

    for (const cond of conditions) {
      dbQuery = dbQuery.where(cond) as typeof dbQuery;
    }

    const rows = await dbQuery;

    // Get total count for pagination
    let countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailLogs);

    for (const cond of conditions) {
      countQuery = countQuery.where(cond) as typeof countQuery;
    }

    const [countResult] = await countQuery;
    const total = countResult?.count ?? 0;

    return reply.send({
      data: rows,
      count: rows.length,
      total,
      offset: skip,
      limit: pageSize,
    });
  });

  // GET /api/system-admin/email-logs/export — export as CSV
  app.get("/export", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const query = request.query as {
      format?: string;
      status?: string;
      email_type?: string;
      from_date?: string;
      to_date?: string;
      limit?: string;
    };

    const maxRows = Math.min(parseInt(query.limit || "5000", 10) || 5000, 10000);

    const conditions: ReturnType<typeof eq>[] = [];
    if (query.status) conditions.push(eq(emailLogs.status, query.status));
    if (query.email_type) conditions.push(eq(emailLogs.emailType, query.email_type));
    if (query.from_date) conditions.push(gte(emailLogs.createdAt, new Date(query.from_date)));
    if (query.to_date) conditions.push(lte(emailLogs.createdAt, new Date(query.to_date)));

    let dbQuery = db
      .select({
        id: emailLogs.id,
        emailType: emailLogs.emailType,
        recipientEmail: emailLogs.recipientEmail,
        recipientName: emailLogs.recipientName,
        subject: emailLogs.subject,
        status: emailLogs.status,
        sentAt: emailLogs.sentAt,
        openedAt: emailLogs.openedAt,
        clickedAt: emailLogs.clickedAt,
        bouncedAt: emailLogs.bouncedAt,
        errorMessage: emailLogs.errorMessage,
        messageId: emailLogs.messageId,
        createdAt: emailLogs.createdAt,
      })
      .from(emailLogs)
      .orderBy(desc(emailLogs.createdAt))
      .limit(maxRows);

    for (const cond of conditions) {
      dbQuery = dbQuery.where(cond) as typeof dbQuery;
    }

    const rows = await dbQuery;

    if (query.format === "csv") {
      const csvHeader = "id,email_type,recipient_email,recipient_name,subject,status,sent_at,opened_at,clicked_at,bounced_at,error_message,message_id,created_at";
      const csvRows = rows.map((r) =>
        [
          r.id,
          r.emailType,
          `"${(r.recipientEmail || "").replace(/"/g, '""')}"`,
          `"${(r.recipientName || "").replace(/"/g, '""')}"`,
          `"${(r.subject || "").replace(/"/g, '""')}"`,
          r.status,
          r.sentAt || "",
          r.openedAt || "",
          r.clickedAt || "",
          r.bouncedAt || "",
          `"${(r.errorMessage || "").replace(/"/g, '""')}"`,
          r.messageId || "",
          r.createdAt,
        ].join(",")
      );

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", "attachment; filename=email-logs.csv");
      return reply.send([csvHeader, ...csvRows].join("\n"));
    }

    // Default: JSON
    return reply.send({ data: rows, count: rows.length });
  });

  // GET /api/system-admin/email-logs/types — distinct email types
  app.get("/types", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const types = await db.execute(sql`
      SELECT DISTINCT email_type, COUNT(*)::int AS count
      FROM email_logs
      GROUP BY email_type
      ORDER BY count DESC
    `);
    const rows = (types as any)?.rows ?? types;
    return reply.send({ data: rows });
  });
};
