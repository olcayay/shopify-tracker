import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc, gte, lte, ilike, inArray } from "drizzle-orm";
import {
  emailLogs,
  emailTypeConfigs,
  emailTypeAccountOverrides,
  userEmailPreferences,
} from "@appranks/db";
import {
  EMAIL_TEMPLATE_VARIABLES,
  NOTIFICATION_TEMPLATE_VARIABLES,
  renderTemplate,
  buildEmailSampleData,
  buildNotificationSampleData,
  buildNotificationContent,
} from "@appranks/shared";
import type { EmailType, TemplateVariable } from "@appranks/shared";
import type { NotificationType } from "@appranks/shared";

export const adminEmailRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // --- Email Logs ---

  // GET /emails — List sent emails (paginated, filterable, searchable)
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      type?: string;
      status?: string;
      recipient?: string;
      from?: string;
      to?: string;
      search?: string;
    };
  }>("/emails", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "50", 10), 200);
    const offset = parseInt(request.query.offset || "0", 10);
    const { type, status, recipient, from, to, search } = request.query;

    const conditions = [];
    if (type) conditions.push(eq(emailLogs.emailType, type));
    if (status) conditions.push(eq(emailLogs.status, status));
    if (recipient) conditions.push(ilike(emailLogs.recipientEmail, `%${recipient}%`));
    if (from) conditions.push(gte(emailLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(emailLogs.createdAt, new Date(to)));
    if (search) conditions.push(ilike(emailLogs.subject, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [countRow]] = await Promise.all([
      db
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
          createdAt: emailLogs.createdAt,
          errorMessage: emailLogs.errorMessage,
        })
        .from(emailLogs)
        .where(where)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(where),
    ]);

    return { emails: rows, total: countRow?.count ?? 0, limit, offset };
  });

  // GET /emails/stats — Aggregate stats
  app.get("/emails/stats", async () => {
    const [stats] = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'sent') AS sent,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        count(*) FILTER (WHERE status = 'skipped') AS skipped,
        count(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        count(*) FILTER (WHERE status = 'sent' AND created_at > now() - interval '24 hours') AS sent_24h,
        count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '24 hours') AS failed_24h,
        count(*) FILTER (WHERE status = 'skipped' AND created_at > now() - interval '24 hours') AS skipped_24h,
        count(*) FILTER (WHERE status IN ('queued', 'pending') AND created_at > now() - interval '24 hours') AS queued_24h,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS total_24h,
        count(*) FILTER (WHERE opened_at IS NOT NULL AND created_at > now() - interval '24 hours') AS opened_24h,
        count(*) FILTER (WHERE status = 'sent' AND created_at > now() - interval '7 days') AS sent_7d,
        count(*) AS total
      FROM email_logs
    `);

    const row = ((stats as any).rows ?? [stats])[0] || {};
    const total = parseInt(row.total || "0", 10);
    const sent = parseInt(row.sent || "0", 10);
    const opened = parseInt(row.opened || "0", 10);
    const clicked = parseInt(row.clicked || "0", 10);

    const sent24h = parseInt(row.sent_24h || "0", 10);
    const opened24h = parseInt(row.opened_24h || "0", 10);

    return {
      total,
      sent,
      failed: parseInt(row.failed || "0", 10),
      skipped: parseInt(row.skipped || "0", 10),
      opened,
      clicked,
      sent24h,
      sent7d: parseInt(row.sent_7d || "0", 10),
      openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 10000) / 100 : 0,
      // Last 24h per-status breakdown
      last24h: {
        total: parseInt(row.total_24h || "0", 10),
        sent: sent24h,
        failed: parseInt(row.failed_24h || "0", 10),
        skipped: parseInt(row.skipped_24h || "0", 10),
        queued: parseInt(row.queued_24h || "0", 10),
        openRate: sent24h > 0 ? Math.round((opened24h / sent24h) * 10000) / 100 : 0,
      },
    };
  });

  // GET /emails/:id — Email detail
  app.get<{ Params: { id: string } }>("/emails/:id", async (request, reply) => {
    const [email] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.id, request.params.id))
      .limit(1);

    if (!email) return reply.code(404).send({ error: "Email not found" });
    return email;
  });

  // --- Email Configs ---

  // GET /email-configs — List all email type configs
  app.get("/email-configs", async () => {
    return db
      .select()
      .from(emailTypeConfigs)
      .orderBy(emailTypeConfigs.emailType);
  });

  // PATCH /email-configs/:type — Update config
  app.patch<{
    Params: { type: string };
    Body: { enabled?: boolean; frequencyLimitHours?: number | null; config?: Record<string, unknown> };
  }>("/email-configs/:type", async (request, reply) => {
    const { type } = request.params;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (request.body.enabled !== undefined) updates.enabled = request.body.enabled;
    if (request.body.frequencyLimitHours !== undefined) updates.frequencyLimitHours = request.body.frequencyLimitHours;
    if (request.body.config !== undefined) updates.config = request.body.config;

    const result = await db
      .update(emailTypeConfigs)
      .set(updates)
      .where(eq(emailTypeConfigs.emailType, type))
      .returning();

    if (result.length === 0) return reply.code(404).send({ error: "Email type not found" });
    return result[0];
  });

  // POST /email-configs/:type/toggle — Enable/disable globally
  app.post<{ Params: { type: string } }>(
    "/email-configs/:type/toggle",
    async (request, reply) => {
      const { type } = request.params;
      const [current] = await db
        .select({ enabled: emailTypeConfigs.enabled })
        .from(emailTypeConfigs)
        .where(eq(emailTypeConfigs.emailType, type))
        .limit(1);

      if (!current) return reply.code(404).send({ error: "Email type not found" });

      const [updated] = await db
        .update(emailTypeConfigs)
        .set({ enabled: !current.enabled, updatedAt: new Date() })
        .where(eq(emailTypeConfigs.emailType, type))
        .returning();

      return updated;
    }
  );

  // --- Account Overrides ---

  // GET /email-configs/:type/overrides
  app.get<{ Params: { type: string } }>(
    "/email-configs/:type/overrides",
    async (request) => {
      return db
        .select()
        .from(emailTypeAccountOverrides)
        .where(eq(emailTypeAccountOverrides.emailType, request.params.type))
        .orderBy(desc(emailTypeAccountOverrides.createdAt));
    }
  );

  // POST /email-configs/:type/overrides
  app.post<{
    Params: { type: string };
    Body: { accountId: string; enabled?: boolean; config?: Record<string, unknown> };
  }>("/email-configs/:type/overrides", async (request) => {
    const { type } = request.params;
    const { accountId, enabled, config } = request.body;

    const [result] = await db
      .insert(emailTypeAccountOverrides)
      .values({
        accountId,
        emailType: type,
        enabled: enabled ?? null,
        config: config ?? null,
      })
      .onConflictDoUpdate({
        target: [emailTypeAccountOverrides.accountId, emailTypeAccountOverrides.emailType],
        set: { enabled: enabled ?? null, config: config ?? null },
      })
      .returning();

    return result;
  });

  // DELETE /email-configs/:type/overrides/:id
  app.delete<{ Params: { type: string; id: string } }>(
    "/email-configs/:type/overrides/:id",
    async (request, reply) => {
      const result = await db
        .delete(emailTypeAccountOverrides)
        .where(eq(emailTypeAccountOverrides.id, request.params.id))
        .returning();

      if (result.length === 0) return reply.code(404).send({ error: "Override not found" });
      return { deleted: true };
    }
  );

  // --- Manual Send ---

  // POST /emails/send — Send specific email type to user/account
  app.post<{
    Body: { emailType: string; userId?: string; accountId?: string };
  }>("/emails/send", async (request, reply) => {
    const { emailType, userId, accountId } = request.body;

    if (!emailType || (!userId && !accountId)) {
      return reply.code(400).send({ error: "emailType and either userId or accountId required" });
    }

    // Enqueue digest job via BullMQ (reuses existing job processing)
    try {
      const { Queue } = await import("bullmq");
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      const url = new URL(redisUrl);
      const queue = new Queue("scraper", {
        connection: { host: url.hostname, port: parseInt(url.port || "6379", 10) },
      });

      await queue.add(emailType, {
        platform: "shopify",
        scraperType: emailType,
        userId,
        accountId,
      });
      await queue.close();

      return { queued: true, emailType, userId, accountId };
    } catch (err) {
      return reply.code(500).send({ error: `Failed to enqueue: ${String(err)}` });
    }
  });

  // POST /emails/resend/:id — Resend a previously sent email
  app.post<{ Params: { id: string } }>(
    "/emails/resend/:id",
    async (request, reply) => {
      const [original] = await db
        .select({
          emailType: emailLogs.emailType,
          recipientEmail: emailLogs.recipientEmail,
          recipientName: emailLogs.recipientName,
          subject: emailLogs.subject,
          htmlBody: emailLogs.htmlBody,
          userId: emailLogs.userId,
          accountId: emailLogs.accountId,
        })
        .from(emailLogs)
        .where(eq(emailLogs.id, request.params.id))
        .limit(1);

      if (!original) return reply.code(404).send({ error: "Email not found" });
      if (!original.htmlBody) return reply.code(400).send({ error: "No HTML body to resend" });

      // Create new log entry for the resend
      const [newLog] = await db
        .insert(emailLogs)
        .values({
          emailType: original.emailType,
          userId: original.userId,
          accountId: original.accountId,
          recipientEmail: original.recipientEmail,
          recipientName: original.recipientName,
          subject: `[Resend] ${original.subject}`,
          htmlBody: original.htmlBody,
          dataSnapshot: { resendOf: request.params.id },
          status: "pending",
        })
        .returning({ id: emailLogs.id });

      return { logId: newLog.id, status: "pending", note: "Resend logged — use /emails/send to trigger delivery" };
    }
  );

  // --- Variable Registry & Preview Endpoints ---

  // GET /emails/variables/:emailType — list available variables for an email type
  app.get<{ Params: { emailType: string } }>("/emails/variables/:emailType", async (request, reply) => {
    const emailType = request.params.emailType as EmailType;
    const variables = EMAIL_TEMPLATE_VARIABLES[emailType];
    if (!variables) {
      return reply.code(404).send({ error: `Unknown email type: ${emailType}` });
    }
    return { emailType, variables };
  });

  // POST /emails/preview — render email preview with provided variables
  app.post<{
    Body: {
      emailType: string;
      variables?: Record<string, string | number>;
      customSubject?: string;
      customBody?: string;
    };
  }>("/emails/preview", async (request, reply) => {
    const { emailType, variables: userVars, customSubject, customBody } = request.body;
    const type = emailType as EmailType;
    const templateVars = EMAIL_TEMPLATE_VARIABLES[type];
    if (!templateVars) {
      return reply.code(400).send({ error: `Unknown email type: ${emailType}` });
    }

    // Merge user variables with defaults from sample data
    const sampleData = buildEmailSampleData(type);
    const mergedVars: Record<string, string | number> = { ...sampleData, ...userVars };

    // Render subject and body
    const subject = customSubject
      ? renderTemplate(customSubject, mergedVars)
      : `Preview: ${emailType.replace(/_/g, " ")}`;
    const body = customBody
      ? renderTemplate(customBody, mergedVars)
      : `<p>Email preview for type <strong>${emailType}</strong> with variables:</p>
         <pre>${JSON.stringify(mergedVars, null, 2)}</pre>`;

    return {
      subject,
      html: body,
      variables: templateVars,
      resolvedVariables: mergedVars,
    };
  });

  // GET /notifications/variables/:notificationType — list available variables for a notification type
  app.get<{ Params: { notificationType: string } }>("/notifications/variables/:notificationType", async (request, reply) => {
    const notificationType = request.params.notificationType as NotificationType;
    const variables = NOTIFICATION_TEMPLATE_VARIABLES[notificationType];
    if (!variables) {
      return reply.code(404).send({ error: `Unknown notification type: ${notificationType}` });
    }
    return { notificationType, variables };
  });

  // POST /notifications/preview — render notification preview with provided variables
  app.post<{
    Body: {
      notificationType: string;
      variables?: Record<string, string | number>;
      customTitle?: string;
      customBody?: string;
    };
  }>("/notifications/preview", async (request, reply) => {
    const { notificationType, variables: userVars, customTitle, customBody } = request.body;
    const type = notificationType as NotificationType;
    const templateVars = NOTIFICATION_TEMPLATE_VARIABLES[type];
    if (!templateVars) {
      return reply.code(400).send({ error: `Unknown notification type: ${notificationType}` });
    }

    // Merge user variables with defaults
    const sampleData = buildNotificationSampleData(type);
    const mergedVars: Record<string, string | number> = { ...sampleData, ...userVars };

    // Build notification content using the shared template engine
    const content = buildNotificationContent(type, mergedVars as any);

    // Apply custom overrides if provided
    const title = customTitle ? renderTemplate(customTitle, mergedVars) : content.title;
    const body = customBody ? renderTemplate(customBody, mergedVars) : content.body;

    return {
      title,
      body,
      url: content.url,
      icon: content.icon,
      priority: content.priority,
      variables: templateVars,
      resolvedVariables: mergedVars,
    };
  });

  // ── Email Log Export (PLA-683) ──────────────────────────────────

  // GET /emails/export — Export email logs as CSV or JSON
  app.get<{
    Querystring: {
      format?: string;
      type?: string;
      status?: string;
      recipient?: string;
      from?: string;
      to?: string;
      search?: string;
      limit?: string;
    };
  }>("/emails/export", async (request, reply) => {
    const format = request.query.format || "csv";
    const maxExport = Math.min(parseInt(request.query.limit || "5000", 10), 10000);
    const { type, status, recipient, from, to, search } = request.query;

    const conditions = [];
    if (type) conditions.push(eq(emailLogs.emailType, type));
    if (status) conditions.push(eq(emailLogs.status, status));
    if (recipient) conditions.push(ilike(emailLogs.recipientEmail, `%${recipient}%`));
    if (from) conditions.push(gte(emailLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(emailLogs.createdAt, new Date(to)));
    if (search) conditions.push(ilike(emailLogs.subject, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
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
        createdAt: emailLogs.createdAt,
        errorMessage: emailLogs.errorMessage,
      })
      .from(emailLogs)
      .where(where)
      .orderBy(desc(emailLogs.createdAt))
      .limit(maxExport);

    if (format === "json") {
      const filename = `email-logs-${new Date().toISOString().slice(0, 10)}.json`;
      void reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      void reply.header("Content-Type", "application/json");
      return rows;
    }

    // CSV format (default)
    const filename = `email-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    void reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    void reply.header("Content-Type", "text/csv");

    const csvHeader = "id,emailType,recipientEmail,recipientName,subject,status,sentAt,openedAt,clickedAt,createdAt,errorMessage";
    const csvRows = rows.map((r) => {
      const escape = (v: string | null | undefined) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };
      return [
        r.id,
        r.emailType,
        escape(r.recipientEmail),
        escape(r.recipientName),
        escape(r.subject),
        r.status,
        r.sentAt?.toISOString() ?? "",
        r.openedAt?.toISOString() ?? "",
        r.clickedAt?.toISOString() ?? "",
        r.createdAt?.toISOString() ?? "",
        escape(r.errorMessage),
      ].join(",");
    });

    return [csvHeader, ...csvRows].join("\n");
  });
};
