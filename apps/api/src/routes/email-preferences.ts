/**
 * Email preference center API — user-facing endpoints for managing
 * which emails they want to receive and at what frequency.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { userEmailPreferences } from "@appranks/db";

/** Email types grouped by category */
const EMAIL_TYPE_CATEGORIES = {
  transactional: {
    label: "Transactional",
    description: "Critical account emails — cannot be disabled",
    types: [
      { type: "email_password_reset", label: "Password Reset", required: true },
      { type: "email_verification", label: "Email Verification", required: true },
      { type: "email_2fa_code", label: "Two-Factor Code", required: true },
      { type: "email_login_alert", label: "Login Alert", required: false },
    ],
  },
  alerts: {
    label: "Alerts & Notifications",
    description: "Real-time updates about your tracked apps",
    types: [
      { type: "email_ranking_alert", label: "Ranking Changes", required: false },
      { type: "email_competitor_alert", label: "Competitor Activity", required: false },
      { type: "email_review_alert", label: "New Reviews", required: false },
    ],
  },
  digests: {
    label: "Digests & Summaries",
    description: "Periodic summaries of app performance",
    types: [
      { type: "email_daily_digest", label: "Daily Digest", required: false },
      { type: "email_weekly_summary", label: "Weekly Summary", required: false },
    ],
  },
  lifecycle: {
    label: "Lifecycle Emails",
    description: "Onboarding and engagement emails",
    types: [
      { type: "email_welcome", label: "Welcome Email", required: false },
      { type: "email_win_celebration", label: "Win Celebrations", required: false },
      { type: "email_re_engagement", label: "Re-engagement", required: false },
      { type: "email_onboarding", label: "Onboarding Tips", required: false },
    ],
  },
  team: {
    label: "Team",
    description: "Team and collaboration emails",
    types: [
      { type: "email_invitation", label: "Team Invitations", required: true },
    ],
  },
};

export const emailPreferenceRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/email-preferences — get current user's email preferences
  app.get("/", async (request, reply) => {
    const userId = request.user.userId;

    // Fetch all existing preferences for this user
    const prefs = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId));

    const prefMap = new Map(prefs.map((p: any) => [p.emailType, p.enabled]));

    // Build categorized response with current state
    const categories = Object.entries(EMAIL_TYPE_CATEGORIES).map(([key, cat]) => ({
      key,
      label: cat.label,
      description: cat.description,
      types: cat.types.map((t) => ({
        ...t,
        enabled: t.required ? true : (prefMap.get(t.type) ?? true), // Default to enabled
      })),
    }));

    return reply.send({ categories });
  });

  // PATCH /api/email-preferences — update preferences
  app.patch("/", async (request, reply) => {
    const userId = request.user.userId;
    const { preferences } = request.body as {
      preferences: { type: string; enabled: boolean }[];
    };

    if (!preferences || !Array.isArray(preferences)) {
      return reply.code(400).send({ error: "preferences array is required" });
    }

    // Collect all required types that can't be disabled
    const requiredTypes = new Set(
      Object.values(EMAIL_TYPE_CATEGORIES)
        .flatMap((cat) => cat.types)
        .filter((t) => t.required)
        .map((t) => t.type)
    );

    let updated = 0;
    for (const pref of preferences) {
      // Skip attempts to disable required email types
      if (requiredTypes.has(pref.type) && !pref.enabled) {
        continue;
      }

      // Upsert preference
      const [existing] = await db
        .select()
        .from(userEmailPreferences)
        .where(
          and(
            eq(userEmailPreferences.userId, userId),
            eq(userEmailPreferences.emailType, pref.type)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(userEmailPreferences)
          .set({ enabled: pref.enabled, updatedAt: new Date() })
          .where(eq(userEmailPreferences.id, (existing as any).id));
      } else {
        await db.insert(userEmailPreferences).values({
          userId,
          emailType: pref.type,
          enabled: pref.enabled,
        });
      }
      updated++;
    }

    return reply.send({ message: "Preferences updated", updated });
  });

  // GET /api/email-preferences/categories — list all available email types
  app.get("/categories", async (_request, reply) => {
    return reply.send({ categories: EMAIL_TYPE_CATEGORIES });
  });
};
