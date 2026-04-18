/**
 * Editable template API endpoints (PLA-444).
 *
 * System-admin only endpoints for managing notification and email templates.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
  notificationTemplates,
  emailTemplates,
} from "@appranks/db";
import {
  NOTIFICATION_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATE_VARIABLES,
  renderTemplate,
  buildNotificationSampleData,
  buildEmailSampleData,
  NOTIFICATION_TYPES,
} from "@appranks/shared";
import type { NotificationType, EmailType } from "@appranks/shared";

// Default templates (code-based fallbacks)
const DEFAULT_NOTIFICATION_TEMPLATES: Record<string, { title: string; body: string }> = {
  ranking_top3_entry: { title: "{{appName}} entered Top 3 for \"{{keyword}}\"", body: "Now at position {{position}} in {{categoryName}}." },
  ranking_top3_exit: { title: "{{appName}} dropped out of Top 3 for \"{{keyword}}\"", body: "Now at position {{position}}. Was in Top 3." },
  ranking_significant_change: { title: "{{appName}} ranking changed for \"{{keyword}}\"", body: "Position changed from {{previousPosition}} to {{position}}." },
  ranking_new_entry: { title: "{{appName}} appeared in \"{{categoryName}}\"", body: "New entry at position {{position}}." },
  ranking_dropped_out: { title: "{{appName}} dropped out of \"{{categoryName}}\"", body: "No longer listed in this category. Was at position {{previousPosition}}." },
  ranking_category_change: { title: "{{appName}} rank changed in \"{{categoryName}}\"", body: "Category rank changed from {{previousPosition}} to {{position}}." },
  competitor_overtook: { title: "{{competitorName}} overtook {{appName}}", body: "For \"{{keyword}}\": {{competitorName}} is now at {{position}}." },
  competitor_featured: { title: "{{competitorName}} got featured", body: "Spotted in {{surfaceName}}." },
  competitor_review_surge: { title: "{{competitorName}} review surge", body: "{{reviewCount}} new reviews detected." },
  competitor_pricing_change: { title: "{{competitorName}} changed pricing", body: "Pricing update detected for {{competitorName}}." },
  review_new_positive: { title: "New {{rating}} star review for {{appName}}", body: "A positive review was posted." },
  review_new_negative: { title: "New {{rating}} star review for {{appName}}", body: "A negative review needs attention." },
  review_velocity_spike: { title: "Review velocity spike for {{appName}}", body: "{{reviewCount}} reviews in recent period." },
  keyword_position_gained: { title: "{{appName}} gained position for \"{{keyword}}\"", body: "Moved from {{previousPosition}} to {{position}}." },
  keyword_position_lost: { title: "{{appName}} lost position for \"{{keyword}}\"", body: "Dropped from {{previousPosition}} to {{position}}." },
  keyword_new_ranking: { title: "{{appName}} ranked for \"{{keyword}}\"", body: "First appearance at position {{position}}." },
  featured_new_placement: { title: "{{appName}} got featured", body: "Spotted in {{surfaceName}}." },
  featured_removed: { title: "{{appName}} removed from featured", body: "No longer in {{surfaceName}}." },
  system_scrape_complete: { title: "Scrape completed: {{scraperType}}", body: "{{platform}} {{scraperType}} run finished successfully." },
  system_scrape_failed: { title: "Scrape failed: {{scraperType}}", body: "{{errorMessage}}" },
  account_member_joined: { title: "{{memberName}} joined your team", body: "A new team member has joined your account." },
  account_limit_warning: { title: "Approaching {{limitType}} limit", body: "Using {{current}} of {{max}}. Consider upgrading." },
  account_limit_reached: { title: "{{limitType}} limit reached", body: "You have reached {{max}}. Upgrade to add more." },
};

const DEFAULT_EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  email_password_reset: { subject: "Reset your password", body: "Click the link to reset your password. This link expires in {{expiryMinutes}} minutes." },
  email_verification: { subject: "Verify your email address", body: "Click the link to verify your email address." },
  email_welcome: { subject: "Welcome to AppRanks", body: "Welcome {{name}}! Your account is ready." },
  email_invitation: { subject: "You have been invited to {{accountName}}", body: "{{inviterName}} invited you to join {{accountName}} as {{role}}." },
  email_login_alert: { subject: "New login detected", body: "A new login was detected from {{ipAddress}} ({{userAgent}})." },
  email_2fa_code: { subject: "Your verification code", body: "Your verification code is {{code}}. It expires in {{expiryMinutes}} minutes." },
  email_daily_digest: { subject: "Daily Digest — {{date}}", body: "Your daily app tracking summary." },
  email_weekly_summary: { subject: "Weekly Summary — {{dateRange}}", body: "Your weekly app performance summary." },
  email_ranking_alert: { subject: "Ranking Alert: {{appName}}", body: "{{appName}} ranking changed in {{categoryName}}." },
  email_competitor_alert: { subject: "Competitor Alert: {{competitorName}}", body: "{{competitorName}} activity detected." },
  email_review_alert: { subject: "Review Alert: {{appName}}", body: "New review activity for {{appName}}." },
  email_win_celebration: { subject: "Congratulations! {{appName}} reached #{{position}}", body: "{{appName}} is now ranked #{{position}} in {{categoryName}}." },
  email_re_engagement: { subject: "We miss you! Check your app rankings", body: "Your tracked apps have had new activity since your last visit." },
  email_onboarding: { subject: "Getting started with AppRanks", body: "Welcome! Here is how to get the most out of AppRanks." },
};

const VALID_NOTIFICATION_TYPES = new Set(Object.keys(NOTIFICATION_TEMPLATE_VARIABLES));
const VALID_EMAIL_TYPES = new Set(Object.keys(EMAIL_TEMPLATE_VARIABLES));

export const templateRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // -----------------------------------------------------------------------
  // Notification Templates
  // -----------------------------------------------------------------------

  // GET /templates/notifications — List all
  app.get("/templates/notifications", async () => {
    const rows = await db.select().from(notificationTemplates);
    const rowMap = new Map(rows.map(r => [r.notificationType, r]));

    return Object.keys(NOTIFICATION_TEMPLATE_VARIABLES).map(type => {
      const row = rowMap.get(type);
      const defaults = DEFAULT_NOTIFICATION_TEMPLATES[type];
      return {
        notificationType: type,
        titleTemplate: row?.titleTemplate ?? defaults?.title ?? "",
        bodyTemplate: row?.bodyTemplate ?? defaults?.body ?? "",
        isCustomized: row?.isCustomized ?? false,
        variables: NOTIFICATION_TEMPLATE_VARIABLES[type as NotificationType],
        updatedAt: row?.updatedAt ?? null,
      };
    });
  });

  // GET /templates/notifications/:type — Get single
  app.get<{ Params: { type: string } }>(
    "/templates/notifications/:type",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_NOTIFICATION_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown notification type" });
      }

      const [row] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.notificationType, type));

      const defaults = DEFAULT_NOTIFICATION_TEMPLATES[type];
      return {
        notificationType: type,
        titleTemplate: row?.titleTemplate ?? defaults?.title ?? "",
        bodyTemplate: row?.bodyTemplate ?? defaults?.body ?? "",
        isCustomized: row?.isCustomized ?? false,
        variables: NOTIFICATION_TEMPLATE_VARIABLES[type as NotificationType],
        updatedAt: row?.updatedAt ?? null,
      };
    }
  );

  // PATCH /templates/notifications/:type — Update
  app.patch<{ Params: { type: string }; Body: { titleTemplate?: string; bodyTemplate?: string } }>(
    "/templates/notifications/:type",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_NOTIFICATION_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown notification type" });
      }

      const { titleTemplate, bodyTemplate } = request.body || {};
      if (!titleTemplate && !bodyTemplate) {
        return reply.code(400).send({ error: "Provide titleTemplate or bodyTemplate" });
      }

      const defaults = DEFAULT_NOTIFICATION_TEMPLATES[type];
      const now = new Date();

      const [result] = await db
        .insert(notificationTemplates)
        .values({
          notificationType: type,
          titleTemplate: titleTemplate ?? defaults?.title ?? "",
          bodyTemplate: bodyTemplate ?? defaults?.body ?? "",
          isCustomized: true,
          updatedAt: now,
          updatedBy: request.user?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: notificationTemplates.notificationType,
          set: {
            ...(titleTemplate !== undefined && { titleTemplate }),
            ...(bodyTemplate !== undefined && { bodyTemplate }),
            isCustomized: true,
            updatedAt: now,
            updatedBy: request.user?.userId ?? null,
          },
        })
        .returning();

      return result;
    }
  );

  // POST /templates/notifications/:type/reset — Reset to default
  app.post<{ Params: { type: string } }>(
    "/templates/notifications/:type/reset",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_NOTIFICATION_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown notification type" });
      }

      const defaults = DEFAULT_NOTIFICATION_TEMPLATES[type];
      if (!defaults) {
        return reply.code(404).send({ error: "No default template found" });
      }

      const now = new Date();
      const [result] = await db
        .insert(notificationTemplates)
        .values({
          notificationType: type,
          titleTemplate: defaults.title,
          bodyTemplate: defaults.body,
          isCustomized: false,
          updatedAt: now,
          updatedBy: request.user?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: notificationTemplates.notificationType,
          set: {
            titleTemplate: defaults.title,
            bodyTemplate: defaults.body,
            isCustomized: false,
            updatedAt: now,
            updatedBy: request.user?.userId ?? null,
          },
        })
        .returning();

      return result;
    }
  );

  // POST /templates/notifications/:type/preview — Preview with sample data
  app.post<{ Params: { type: string }; Body: { data?: Record<string, string> } }>(
    "/templates/notifications/:type/preview",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_NOTIFICATION_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown notification type" });
      }

      const [row] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.notificationType, type));

      const defaults = DEFAULT_NOTIFICATION_TEMPLATES[type];
      const titleTemplate = row?.titleTemplate ?? defaults?.title ?? "";
      const bodyTemplate = row?.bodyTemplate ?? defaults?.body ?? "";

      const sampleData = request.body?.data ?? buildNotificationSampleData(type as NotificationType);

      return {
        title: renderTemplate(titleTemplate, sampleData),
        body: renderTemplate(bodyTemplate, sampleData),
        variables: sampleData,
      };
    }
  );

  // -----------------------------------------------------------------------
  // Email Templates
  // -----------------------------------------------------------------------

  // GET /templates/emails — List all
  app.get("/templates/emails", async () => {
    const rows = await db.select().from(emailTemplates);
    const rowMap = new Map(rows.map(r => [r.emailType, r]));

    return Object.keys(EMAIL_TEMPLATE_VARIABLES).map(type => {
      const row = rowMap.get(type);
      const defaults = DEFAULT_EMAIL_TEMPLATES[type];
      return {
        emailType: type,
        subjectTemplate: row?.subjectTemplate ?? defaults?.subject ?? "",
        bodyTemplate: row?.bodyTemplate ?? defaults?.body ?? "",
        isCustomized: row?.isCustomized ?? false,
        variables: EMAIL_TEMPLATE_VARIABLES[type as EmailType],
        updatedAt: row?.updatedAt ?? null,
      };
    });
  });

  // GET /templates/emails/:type — Get single
  app.get<{ Params: { type: string } }>(
    "/templates/emails/:type",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_EMAIL_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown email type" });
      }

      const [row] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.emailType, type));

      const defaults = DEFAULT_EMAIL_TEMPLATES[type];
      return {
        emailType: type,
        subjectTemplate: row?.subjectTemplate ?? defaults?.subject ?? "",
        bodyTemplate: row?.bodyTemplate ?? defaults?.body ?? "",
        isCustomized: row?.isCustomized ?? false,
        variables: EMAIL_TEMPLATE_VARIABLES[type as EmailType],
        updatedAt: row?.updatedAt ?? null,
      };
    }
  );

  // PATCH /templates/emails/:type — Update
  app.patch<{ Params: { type: string }; Body: { subjectTemplate?: string; bodyTemplate?: string } }>(
    "/templates/emails/:type",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_EMAIL_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown email type" });
      }

      const { subjectTemplate, bodyTemplate } = request.body || {};
      if (!subjectTemplate && !bodyTemplate) {
        return reply.code(400).send({ error: "Provide subjectTemplate or bodyTemplate" });
      }

      const defaults = DEFAULT_EMAIL_TEMPLATES[type];
      const now = new Date();

      const [result] = await db
        .insert(emailTemplates)
        .values({
          emailType: type,
          subjectTemplate: subjectTemplate ?? defaults?.subject ?? "",
          bodyTemplate: bodyTemplate ?? defaults?.body ?? "",
          isCustomized: true,
          updatedAt: now,
          updatedBy: request.user?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: emailTemplates.emailType,
          set: {
            ...(subjectTemplate !== undefined && { subjectTemplate }),
            ...(bodyTemplate !== undefined && { bodyTemplate }),
            isCustomized: true,
            updatedAt: now,
            updatedBy: request.user?.userId ?? null,
          },
        })
        .returning();

      return result;
    }
  );

  // POST /templates/emails/:type/reset — Reset to default
  app.post<{ Params: { type: string } }>(
    "/templates/emails/:type/reset",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_EMAIL_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown email type" });
      }

      const defaults = DEFAULT_EMAIL_TEMPLATES[type];
      if (!defaults) {
        return reply.code(404).send({ error: "No default template found" });
      }

      const now = new Date();
      const [result] = await db
        .insert(emailTemplates)
        .values({
          emailType: type,
          subjectTemplate: defaults.subject,
          bodyTemplate: defaults.body,
          isCustomized: false,
          updatedAt: now,
          updatedBy: request.user?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: emailTemplates.emailType,
          set: {
            subjectTemplate: defaults.subject,
            bodyTemplate: defaults.body,
            isCustomized: false,
            updatedAt: now,
            updatedBy: request.user?.userId ?? null,
          },
        })
        .returning();

      return result;
    }
  );

  // POST /templates/emails/:type/preview — Preview with sample data
  app.post<{ Params: { type: string }; Body: { data?: Record<string, string> } }>(
    "/templates/emails/:type/preview",
    async (request, reply) => {
      const { type } = request.params;
      if (!VALID_EMAIL_TYPES.has(type)) {
        return reply.code(404).send({ error: "Unknown email type" });
      }

      const [row] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.emailType, type));

      const defaults = DEFAULT_EMAIL_TEMPLATES[type];
      const subjectTemplate = row?.subjectTemplate ?? defaults?.subject ?? "";
      const bodyTemplate = row?.bodyTemplate ?? defaults?.body ?? "";

      const sampleData = request.body?.data ?? buildEmailSampleData(type as EmailType);

      return {
        subject: renderTemplate(subjectTemplate, sampleData),
        body: renderTemplate(bodyTemplate, sampleData),
        variables: sampleData,
      };
    }
  );
};
