/**
 * Email alert management routes for system admins.
 * CRUD for alert rules + alert history.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { emailAlertRules, emailAlertsLog } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";

export const emailAlertRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // GET /api/system-admin/email-alerts/rules — list all alert rules
  app.get("/rules", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const rules = await db
      .select()
      .from(emailAlertRules)
      .orderBy(emailAlertRules.ruleName);

    return reply.send({ data: rules });
  });

  // PUT /api/system-admin/email-alerts/rules/:id — update a rule
  app.put("/rules/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      threshold?: number;
      cooldownMinutes?: number;
      enabled?: boolean;
      channels?: string[];
      webhookUrl?: string | null;
    };

    const [existing] = await db
      .select()
      .from(emailAlertRules)
      .where(eq(emailAlertRules.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Alert rule not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.threshold !== undefined) updates.threshold = body.threshold;
    if (body.cooldownMinutes !== undefined) updates.cooldownMinutes = body.cooldownMinutes;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.channels !== undefined) updates.channels = body.channels;
    if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;

    await db
      .update(emailAlertRules)
      .set(updates)
      .where(eq(emailAlertRules.id, id));

    return reply.send({ message: "Rule updated", id });
  });

  // GET /api/system-admin/email-alerts/history — alert history
  app.get("/history", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { limit, days } = request.query as { limit?: string; days?: string };
    const pageSize = Math.min(parseInt(limit || "50", 10) || 50, 200);
    const lookbackDays = Math.min(parseInt(days || "30", 10) || 30, 90);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const logs = await db
      .select()
      .from(emailAlertsLog)
      .where(sql`${emailAlertsLog.createdAt} >= ${cutoff.toISOString()}`)
      .orderBy(desc(emailAlertsLog.createdAt))
      .limit(pageSize);

    return reply.send({ data: logs, count: logs.length });
  });

  // POST /api/system-admin/email-alerts/test — trigger a test alert
  app.post("/test", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { ruleId } = request.body as { ruleId?: string };

    let rule;
    if (ruleId) {
      [rule] = await db
        .select()
        .from(emailAlertRules)
        .where(eq(emailAlertRules.id, ruleId))
        .limit(1);
    } else {
      // Use first rule
      [rule] = await db
        .select()
        .from(emailAlertRules)
        .limit(1);
    }

    if (!rule) {
      return reply.code(404).send({ error: "No alert rule found" });
    }

    // Create a test alert log entry
    await db.insert(emailAlertsLog).values({
      ruleId: rule.id,
      ruleName: `[TEST] ${rule.ruleName}`,
      metric: rule.metric,
      currentValue: rule.threshold + 1,
      threshold: rule.threshold,
      message: `Test alert: ${rule.ruleName} — simulated threshold breach`,
      channels: rule.channels,
      deliveredAt: new Date(),
    });

    return reply.send({
      message: "Test alert created",
      ruleName: rule.ruleName,
    });
  });
};
