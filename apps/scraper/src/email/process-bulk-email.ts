/**
 * Core processing logic for bulk (marketing/digest) email jobs.
 * Uses the full email pipeline: eligibility → unsubscribe → log → track → send.
 */
import type { Job } from "bullmq";
import type { BulkEmailJobData, BulkEmailJobType } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { sendEmail } from "./pipeline.js";

const log = createLogger("email-bulk");

interface BulkEmailBuilder {
  buildData: (db: any, accountId: string, timezone?: string) => Promise<any>;
  buildHtml: (data: any) => string;
  buildSubject: (data: any) => string;
}

async function getBuilder(type: BulkEmailJobType): Promise<BulkEmailBuilder | null> {
  switch (type) {
    case "email_daily_digest": {
      const { buildDigestForAccount } = await import("./digest-builder.js");
      const { buildDigestHtml, buildDigestSubject } = await import("./digest-template.js");
      return {
        buildData: (db, accountId, tz) => buildDigestForAccount(db, accountId, tz),
        buildHtml: buildDigestHtml,
        buildSubject: buildDigestSubject,
      };
    }
    case "email_weekly_summary": {
      const { buildWeeklyForAccount } = await import("./weekly-builder.js");
      const { buildWeeklyHtml, buildWeeklySubject } = await import("./weekly-template.js");
      return {
        buildData: (db, accountId, tz) => buildWeeklyForAccount(db, accountId, tz),
        buildHtml: buildWeeklyHtml,
        buildSubject: buildWeeklySubject,
      };
    }
    case "email_ranking_alert": {
      const { buildRankingAlertHtml, buildRankingAlertSubject } = await import("./ranking-alert-template.js");
      return {
        buildData: async (_db, _aid, _tz) => null, // Data comes from job payload
        buildHtml: buildRankingAlertHtml,
        buildSubject: buildRankingAlertSubject,
      };
    }
    case "email_competitor_alert": {
      const { buildCompetitorAlertHtml, buildCompetitorAlertSubject } = await import("./competitor-alert-template.js");
      return {
        buildData: async () => null,
        buildHtml: buildCompetitorAlertHtml,
        buildSubject: buildCompetitorAlertSubject,
      };
    }
    case "email_review_alert": {
      const { buildReviewAlertHtml, buildReviewAlertSubject } = await import("./review-alert-template.js");
      return {
        buildData: async () => null,
        buildHtml: buildReviewAlertHtml,
        buildSubject: buildReviewAlertSubject,
      };
    }
    case "email_win_celebration": {
      const { buildWinCelebrationHtml, buildWinCelebrationSubject } = await import("./win-celebration-template.js");
      return {
        buildData: async () => null,
        buildHtml: buildWinCelebrationHtml,
        buildSubject: buildWinCelebrationSubject,
      };
    }
    case "email_re_engagement": {
      const { buildReEngagementHtml, buildReEngagementSubject } = await import("./re-engagement-template.js");
      return {
        buildData: async () => null,
        buildHtml: buildReEngagementHtml,
        buildSubject: buildReEngagementSubject,
      };
    }
    case "email_onboarding": {
      const { buildWelcomeHtml, buildWelcomeSubject } = await import("./welcome-template.js");
      return {
        buildData: async () => null,
        buildHtml: buildWelcomeHtml,
        buildSubject: buildWelcomeSubject,
      };
    }
    default:
      return null;
  }
}

export async function processBulkEmail(
  job: Job<BulkEmailJobData>,
  db: any
): Promise<void> {
  const { type, to, payload, userId, accountId, name, campaignId } = job.data;
  log.info("processing bulk email", { jobId: job.id, type, to });

  const builder = await getBuilder(type);
  if (!builder) {
    throw new Error(`Unknown bulk email type: ${type}`);
  }

  // For digest/weekly, build data from DB. For alerts, use payload directly.
  let data = payload;
  if (type === "email_daily_digest" || type === "email_weekly_summary") {
    const timezone = (payload.timezone as string) || "UTC";
    const builtData = await builder.buildData(db, accountId, timezone);
    if (!builtData) {
      log.info("no data to send for bulk email", { type, accountId });
      return; // No data = skip, not an error
    }
    data = builtData;
  }

  const html = builder.buildHtml(data);
  const subject = builder.buildSubject(data);

  // Use the full pipeline (eligibility, tracking, unsubscribe, logging)
  const result = await sendEmail({
    db,
    emailType: type,
    userId,
    accountId,
    recipientEmail: to,
    recipientName: name,
    subject,
    htmlBody: html,
    dataSnapshot: payload,
    campaignId,
  });

  if (result.sent) {
    log.info("bulk email sent", { jobId: job.id, type, to, logId: result.logId });
  } else {
    log.info("bulk email skipped", { jobId: job.id, type, to, reason: result.skipReason });
  }
}
