import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc, gte, lte, ilike, inArray } from "drizzle-orm";
import {
  emailLogs,
  emailTypeConfigs,
  emailTypeAccountOverrides,
  userEmailPreferences,
} from "@appranks/db";

export const adminEmailRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // --- Email Logs ---

  // GET /emails — List sent emails (paginated, filterable)
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      type?: string;
      status?: string;
      recipient?: string;
      from?: string;
      to?: string;
    };
  }>("/emails", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "50", 10), 200);
    const offset = parseInt(request.query.offset || "0", 10);
    const { type, status, recipient, from, to } = request.query;

    const conditions = [];
    if (type) conditions.push(eq(emailLogs.emailType, type));
    if (status) conditions.push(eq(emailLogs.status, status));
    if (recipient) conditions.push(ilike(emailLogs.recipientEmail, `%${recipient}%`));
    if (from) conditions.push(gte(emailLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(emailLogs.createdAt, new Date(to)));

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
        count(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        count(*) FILTER (WHERE status = 'sent' AND created_at > now() - interval '24 hours') AS sent_24h,
        count(*) FILTER (WHERE status = 'sent' AND created_at > now() - interval '7 days') AS sent_7d,
        count(*) AS total
      FROM email_logs
    `);

    const row = ((stats as any).rows ?? [stats])[0] || {};
    const total = parseInt(row.total || "0", 10);
    const sent = parseInt(row.sent || "0", 10);
    const opened = parseInt(row.opened || "0", 10);
    const clicked = parseInt(row.clicked || "0", 10);

    return {
      total,
      sent,
      failed: parseInt(row.failed || "0", 10),
      opened,
      clicked,
      sent24h: parseInt(row.sent_24h || "0", 10),
      sent7d: parseInt(row.sent_7d || "0", 10),
      openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 10000) / 100 : 0,
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
};
