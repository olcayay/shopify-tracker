/**
 * Suppression list management routes for system admins.
 * View, remove, and bulk import/export suppressed email addresses.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { emailSuppressionList, emailHealthMetrics } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../constants.js";

export const suppressionRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/system-admin/suppression — list suppressed addresses
  app.get("/", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { limit, offset, reason } = request.query as {
      limit?: string;
      offset?: string;
      reason?: string;
    };

    const pageSize = Math.min(
      Math.max(parseInt(limit || String(PAGINATION_DEFAULT_LIMIT), 10) || PAGINATION_DEFAULT_LIMIT, 1),
      PAGINATION_MAX_LIMIT
    );
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [isNull(emailSuppressionList.removedAt)];
    if (reason) {
      conditions.push(eq(emailSuppressionList.reason, reason));
    }

    const rows = await db
      .select()
      .from(emailSuppressionList)
      .where(and(...conditions))
      .orderBy(desc(emailSuppressionList.lastBounceAt))
      .limit(pageSize)
      .offset(skip);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailSuppressionList)
      .where(and(...conditions));

    return reply.send({
      data: rows,
      count: rows.length,
      total: countResult?.count ?? 0,
    });
  });

  // DELETE /api/system-admin/suppression/:id — remove suppression
  app.delete("/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [existing] = await db
      .select()
      .from(emailSuppressionList)
      .where(eq(emailSuppressionList.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Suppression entry not found" });
    }

    if (existing.removedAt) {
      return reply.code(409).send({ error: "Already removed" });
    }

    await db
      .update(emailSuppressionList)
      .set({
        removedAt: new Date(),
        removedBy: "admin",
      })
      .where(eq(emailSuppressionList.id, id));

    return reply.send({ message: "Suppression removed", email: existing.email });
  });

  // POST /api/system-admin/suppression/import — bulk import from CSV body
  app.post("/import", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { emails, reason } = request.body as {
      emails: string[];
      reason?: string;
    };

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return reply.code(400).send({ error: "emails array is required" });
    }

    let imported = 0;
    let skipped = 0;

    for (const email of emails) {
      const normalized = email.toLowerCase().trim();
      if (!normalized || !normalized.includes("@")) {
        skipped++;
        continue;
      }

      try {
        await db
          .insert(emailSuppressionList)
          .values({
            email: normalized,
            reason: reason || "manual",
            source: "admin",
            bounceCount: 1,
            lastBounceAt: new Date(),
          })
          .onConflictDoNothing();
        imported++;
      } catch {
        skipped++;
      }
    }

    return reply.send({ imported, skipped, total: emails.length });
  });

  // GET /api/system-admin/suppression/export — export as JSON array
  app.get("/export", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const rows = await db
      .select({
        email: emailSuppressionList.email,
        reason: emailSuppressionList.reason,
        bounceCount: emailSuppressionList.bounceCount,
        lastBounceAt: emailSuppressionList.lastBounceAt,
        createdAt: emailSuppressionList.createdAt,
      })
      .from(emailSuppressionList)
      .where(isNull(emailSuppressionList.removedAt))
      .orderBy(desc(emailSuppressionList.lastBounceAt));

    return reply.send({ data: rows, count: rows.length });
  });

  // GET /api/system-admin/suppression/bounce-rate — bounce rate overview
  app.get("/bounce-rate", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const lookbackDays = Math.min(parseInt(days || "7", 10) || 7, 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    cutoff.setHours(0, 0, 0, 0);

    // Aggregate metrics
    const [aggregate]: any[] = await db.execute(sql`
      SELECT
        COALESCE(SUM(sent), 0) AS total_sent,
        COALESCE(SUM(delivered), 0) AS total_delivered,
        COALESCE(SUM(bounced), 0) AS total_bounced,
        COALESCE(SUM(complained), 0) AS total_complained
      FROM email_health_metrics
      WHERE date >= ${cutoff}
    `);

    const row = (aggregate as any)?.rows?.[0] ?? aggregate;
    const totalSent = Number(row?.total_sent || 0);
    const totalBounced = Number(row?.total_bounced || 0);
    const totalComplained = Number(row?.total_complained || 0);

    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (totalComplained / totalSent) * 100 : 0;

    // Daily trend
    const dailyTrend = await db
      .select({
        date: sql<string>`${emailHealthMetrics.date}::date::text`,
        sent: emailHealthMetrics.sent,
        bounced: emailHealthMetrics.bounced,
        complained: emailHealthMetrics.complained,
      })
      .from(emailHealthMetrics)
      .where(sql`${emailHealthMetrics.date} >= ${cutoff}`)
      .orderBy(emailHealthMetrics.date);

    // Suppression by reason
    const byReason = await db
      .select({
        reason: emailSuppressionList.reason,
        count: sql<number>`count(*)::int`,
      })
      .from(emailSuppressionList)
      .where(isNull(emailSuppressionList.removedAt))
      .groupBy(emailSuppressionList.reason);

    return reply.send({
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100,
      totalSent,
      totalBounced,
      totalComplained,
      alert: bounceRate > 5,
      critical: bounceRate > 10,
      days: lookbackDays,
      dailyTrend,
      byReason,
    });
  });
};
