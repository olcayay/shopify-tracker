/**
 * Email simulation API routes for system admins.
 * Preview what emails would look like and who would receive them.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("email-simulation");

export const emailSimulationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /api/system-admin/email-simulation/simulate — single user simulation
  app.post("/simulate", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { emailType, userId, accountId, recipientEmail, payload } = request.body as {
      emailType: string;
      userId: string;
      accountId: string;
      recipientEmail: string;
      payload?: Record<string, unknown>;
    };

    if (!emailType || !userId || !accountId || !recipientEmail) {
      return reply.code(400).send({ error: "emailType, userId, accountId, and recipientEmail are required" });
    }

    try {
      // Since simulator depends on scraper package, do a lightweight simulation here
      // using only what the API has access to (eligibility check via raw SQL)
      const eligibilityChecks: { check: string; passed: boolean; reason?: string }[] = [];

      // Check 1: Is email type globally enabled?
      const [typeConfig]: any[] = await db.execute(sql`
        SELECT enabled FROM email_type_configs WHERE email_type = ${emailType} LIMIT 1
      `);
      const typeRow = (typeConfig as any)?.rows?.[0] ?? typeConfig;
      if (typeRow && !typeRow.enabled) {
        eligibilityChecks.push({ check: "global_config", passed: false, reason: "Email type is globally disabled" });
      } else {
        eligibilityChecks.push({ check: "global_config", passed: true });
      }

      // Check 2: Account override
      const [accountOverride]: any[] = await db.execute(sql`
        SELECT enabled FROM email_type_account_overrides
        WHERE account_id = ${accountId}::uuid AND email_type = ${emailType}
        LIMIT 1
      `);
      const acctRow = (accountOverride as any)?.rows?.[0] ?? accountOverride;
      if (acctRow && acctRow.enabled === false) {
        eligibilityChecks.push({ check: "account_override", passed: false, reason: "Disabled for this account" });
      } else {
        eligibilityChecks.push({ check: "account_override", passed: true });
      }

      // Check 3: User preference
      const [userPref]: any[] = await db.execute(sql`
        SELECT enabled FROM user_email_preferences
        WHERE user_id = ${userId}::uuid AND email_type = ${emailType}
        LIMIT 1
      `);
      const prefRow = (userPref as any)?.rows?.[0] ?? userPref;
      if (prefRow && !prefRow.enabled) {
        eligibilityChecks.push({ check: "user_preference", passed: false, reason: "User opted out" });
      } else {
        eligibilityChecks.push({ check: "user_preference", passed: true });
      }

      // Check 4: Suppression list
      const [suppressed]: any[] = await db.execute(sql`
        SELECT id FROM email_suppression_list
        WHERE email = ${recipientEmail.toLowerCase()} AND removed_at IS NULL
        LIMIT 1
      `);
      const suppRow = (suppressed as any)?.rows?.[0] ?? suppressed;
      if (suppRow?.id) {
        eligibilityChecks.push({ check: "suppression_list", passed: false, reason: "Email is suppressed (bounce/complaint)" });
      } else {
        eligibilityChecks.push({ check: "suppression_list", passed: true });
      }

      // Check 5: Frequency cap (last send in freq window)
      const [recentSend]: any[] = await db.execute(sql`
        SELECT id FROM email_logs
        WHERE user_id = ${userId}::uuid AND email_type = ${emailType}
          AND status IN ('sent', 'delivered')
          AND created_at >= now() - interval '24 hours'
        LIMIT 1
      `);
      const recentRow = (recentSend as any)?.rows?.[0] ?? recentSend;
      if (recentRow?.id) {
        eligibilityChecks.push({ check: "frequency_cap", passed: false, reason: "Already sent in the last 24 hours" });
      } else {
        eligibilityChecks.push({ check: "frequency_cap", passed: true });
      }

      const allPassed = eligibilityChecks.every((c) => c.passed);
      const failedChecks = eligibilityChecks.filter((c) => !c.passed);

      return reply.send({
        wouldSend: allPassed,
        emailType,
        recipient: recipientEmail,
        eligibilityChecks,
        failedChecks,
        summary: allPassed
          ? "Email would be sent successfully"
          : `Blocked by: ${failedChecks.map((c) => c.check).join(", ")}`,
      });
    } catch (err) {
      log.error("simulation failed", { error: String(err) });
      return reply.code(500).send({ error: "Simulation failed", details: String(err) });
    }
  });

  // POST /api/system-admin/email-simulation/simulate-bulk — bulk estimation
  app.post("/simulate-bulk", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { emailType, limit: maxUsers } = request.body as {
      emailType: string;
      limit?: number;
    };

    if (!emailType) {
      return reply.code(400).send({ error: "emailType is required" });
    }

    const userLimit = Math.min(maxUsers || 100, 1000);

    try {
      // Count total active users
      const [totalResult]: any[] = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM users WHERE status = 'active'
      `);
      const totalUsers = Number((totalResult as any)?.rows?.[0]?.total ?? totalResult?.total ?? 0);

      // Count users who opted out of this email type
      const [optedOut]: any[] = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM user_email_preferences
        WHERE email_type = ${emailType} AND enabled = false
      `);
      const optedOutCount = Number((optedOut as any)?.rows?.[0]?.count ?? optedOut?.count ?? 0);

      // Count suppressed emails
      const [suppressedCount]: any[] = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM email_suppression_list
        WHERE removed_at IS NULL
      `);
      const suppressed = Number((suppressedCount as any)?.rows?.[0]?.count ?? suppressedCount?.count ?? 0);

      // Count recently sent (frequency cap)
      const [recentlySent]: any[] = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int AS count FROM email_logs
        WHERE email_type = ${emailType}
          AND status IN ('sent', 'delivered')
          AND created_at >= now() - interval '24 hours'
      `);
      const frequencyCapped = Number((recentlySent as any)?.rows?.[0]?.count ?? recentlySent?.count ?? 0);

      // Check if globally disabled
      const [typeConfig]: any[] = await db.execute(sql`
        SELECT enabled FROM email_type_configs WHERE email_type = ${emailType} LIMIT 1
      `);
      const typeRow = (typeConfig as any)?.rows?.[0] ?? typeConfig;
      const globallyDisabled = typeRow && !typeRow.enabled;

      const estimatedEligible = globallyDisabled
        ? 0
        : Math.max(0, totalUsers - optedOutCount - suppressed - frequencyCapped);

      return reply.send({
        emailType,
        totalUsers,
        estimatedEligible,
        estimatedIneligible: totalUsers - estimatedEligible,
        breakdown: {
          globallyDisabled: globallyDisabled || false,
          optedOut: optedOutCount,
          suppressed,
          frequencyCapped,
        },
        note: "Estimates based on current data. Actual eligibility may vary per-user.",
      });
    } catch (err) {
      log.error("bulk simulation failed", { error: String(err) });
      return reply.code(500).send({ error: "Simulation failed", details: String(err) });
    }
  });

  // GET /api/system-admin/email-simulation/types — available email types for simulation
  app.get("/types", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const instantTypes = [
      { type: "email_password_reset", label: "Password Reset", category: "transactional" },
      { type: "email_verification", label: "Email Verification", category: "transactional" },
      { type: "email_welcome", label: "Welcome Email", category: "transactional" },
      { type: "email_invitation", label: "Team Invitation", category: "transactional" },
      { type: "email_login_alert", label: "Login Alert", category: "transactional" },
      { type: "email_2fa_code", label: "Two-Factor Code", category: "transactional" },
    ];

    const bulkTypes = [
      { type: "email_daily_digest", label: "Daily Digest", category: "bulk" },
      { type: "email_weekly_summary", label: "Weekly Summary", category: "bulk" },
      { type: "email_ranking_alert", label: "Ranking Alert", category: "bulk" },
      { type: "email_competitor_alert", label: "Competitor Alert", category: "bulk" },
      { type: "email_review_alert", label: "Review Alert", category: "bulk" },
      { type: "email_win_celebration", label: "Win Celebration", category: "bulk" },
      { type: "email_re_engagement", label: "Re-engagement", category: "bulk" },
      { type: "email_onboarding", label: "Onboarding", category: "bulk" },
    ];

    return reply.send({ data: [...instantTypes, ...bulkTypes] });
  });
};
