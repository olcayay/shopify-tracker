/**
 * Email alert evaluator — checks metrics against configured thresholds
 * and fires alerts when conditions are met, respecting cooldown periods.
 */
import { eq, sql, desc, gte, isNull } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { emailAlertRules, emailAlertsLog, deadLetterJobs } from "@appranks/db";
import { createLogger } from "@appranks/shared";
import { Queue } from "bullmq";

const log = createLogger("alert-evaluator");

export interface AlertRuleRow {
  id: string;
  ruleName: string;
  metric: string;
  operator: string;
  threshold: number;
  cooldownMinutes: number;
  enabled: boolean;
  channels: string[];
  webhookUrl: string | null;
}

export interface MetricValues {
  instant_queue_depth: number;
  bulk_queue_depth: number;
  error_rate_1h: number;
  bounce_rate_24h: number;
  dlq_depth: number;
}

export interface AlertResult {
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  triggered: boolean;
  cooledDown: boolean;
}

/**
 * Collect all metric values from BullMQ queues and DB.
 */
export async function collectMetrics(
  db: Database,
  redisConnection: { host: string; port: number; password?: string }
): Promise<MetricValues> {
  const metrics: MetricValues = {
    instant_queue_depth: 0,
    bulk_queue_depth: 0,
    error_rate_1h: 0,
    bounce_rate_24h: 0,
    dlq_depth: 0,
  };

  // Queue depths
  for (const [name, key] of [
    ["email-instant", "instant_queue_depth"],
    ["email-bulk", "bulk_queue_depth"],
  ] as const) {
    try {
      const q = new Queue(name, { connection: redisConnection });
      const counts = await q.getJobCounts();
      metrics[key] = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      await q.close();
    } catch {
      // Queue unavailable — leave at 0
    }
  }

  // Error rate (last 1 hour) — percentage of failed emails
  try {
    const [result]: any[] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
      FROM email_logs
      WHERE created_at >= now() - interval '1 hour'
    `);
    const row = (result as any)?.rows?.[0] ?? result;
    const total = Number(row?.total || 0);
    const failed = Number(row?.failed || 0);
    metrics.error_rate_1h = total > 0 ? Math.round((failed / total) * 100) : 0;
  } catch {
    // DB unavailable
  }

  // Bounce rate (last 24 hours) — percentage of bounced emails
  try {
    const [result]: any[] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'bounced' OR status = 'complained') AS bounced,
        COUNT(*) FILTER (WHERE status = 'sent' OR status = 'bounced' OR status = 'complained') AS delivered
      FROM email_logs
      WHERE created_at >= now() - interval '24 hours'
    `);
    const row = (result as any)?.rows?.[0] ?? result;
    const delivered = Number(row?.delivered || 0);
    const bounced = Number(row?.bounced || 0);
    metrics.bounce_rate_24h = delivered > 0 ? Math.round((bounced / delivered) * 100) : 0;
  } catch {
    // DB unavailable
  }

  // DLQ depth
  try {
    const [result]: any[] = await db.execute(sql`
      SELECT COUNT(*)::int AS depth FROM dead_letter_jobs WHERE replayed_at IS NULL
    `);
    const row = (result as any)?.rows?.[0] ?? result;
    metrics.dlq_depth = Number(row?.depth || 0);
  } catch {
    // DB unavailable
  }

  return metrics;
}

/**
 * Check if a threshold condition is met.
 */
export function evaluateCondition(
  currentValue: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case ">": return currentValue > threshold;
    case ">=": return currentValue >= threshold;
    case "<": return currentValue < threshold;
    case "<=": return currentValue <= threshold;
    case "==": return currentValue === threshold;
    default: return currentValue > threshold;
  }
}

/**
 * Check if the rule is in cooldown (was triggered within cooldown window).
 */
async function isInCooldown(
  db: Database,
  ruleId: string,
  cooldownMinutes: number
): Promise<boolean> {
  const [recent] = await db
    .select({ id: emailAlertsLog.id })
    .from(emailAlertsLog)
    .where(
      sql`${emailAlertsLog.ruleId} = ${ruleId}
        AND ${emailAlertsLog.createdAt} >= now() - interval '${sql.raw(String(cooldownMinutes))} minutes'`
    )
    .limit(1);

  return !!recent;
}

/**
 * Evaluate all enabled alert rules and fire alerts for triggered ones.
 * Returns list of results.
 */
export async function evaluateAlerts(
  db: Database,
  redisConnection: { host: string; port: number; password?: string },
  deliverFn?: (rule: AlertRuleRow, currentValue: number, message: string) => Promise<void>
): Promise<AlertResult[]> {
  // 1. Fetch all enabled rules
  const rules = await db
    .select()
    .from(emailAlertRules)
    .where(eq(emailAlertRules.enabled, true));

  if (rules.length === 0) return [];

  // 2. Collect current metrics
  const metrics = await collectMetrics(db, redisConnection);

  const results: AlertResult[] = [];

  for (const rule of rules) {
    const metricKey = rule.metric as keyof MetricValues;
    const currentValue = metrics[metricKey] ?? 0;
    const triggered = evaluateCondition(currentValue, rule.operator, rule.threshold);

    if (!triggered) {
      results.push({
        ruleName: rule.ruleName,
        metric: rule.metric,
        currentValue,
        threshold: rule.threshold,
        triggered: false,
        cooledDown: false,
      });
      continue;
    }

    // Check cooldown
    const cooledDown = await isInCooldown(db, rule.id, rule.cooldownMinutes);
    if (cooledDown) {
      results.push({
        ruleName: rule.ruleName,
        metric: rule.metric,
        currentValue,
        threshold: rule.threshold,
        triggered: true,
        cooledDown: true,
      });
      continue;
    }

    // Fire alert
    const message = `Alert: ${rule.ruleName} — ${rule.metric} is ${currentValue} (threshold: ${rule.operator} ${rule.threshold})`;

    // Log to alerts_log
    await db.insert(emailAlertsLog).values({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      message,
      channels: rule.channels,
    });

    // Deliver alert
    if (deliverFn) {
      try {
        await deliverFn(rule as unknown as AlertRuleRow, currentValue, message);
        // Update delivered_at
        const [latest] = await db
          .select({ id: emailAlertsLog.id })
          .from(emailAlertsLog)
          .where(eq(emailAlertsLog.ruleName, rule.ruleName))
          .orderBy(desc(emailAlertsLog.createdAt))
          .limit(1);
        if (latest) {
          await db
            .update(emailAlertsLog)
            .set({ deliveredAt: new Date() })
            .where(eq(emailAlertsLog.id, latest.id));
        }
      } catch (err) {
        log.error("alert delivery failed", { rule: rule.ruleName, error: String(err) });
      }
    }

    log.warn("alert triggered", { rule: rule.ruleName, metric: rule.metric, value: currentValue, threshold: rule.threshold });

    results.push({
      ruleName: rule.ruleName,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      triggered: true,
      cooledDown: false,
    });
  }

  return results;
}
