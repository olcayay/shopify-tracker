import { createLogger } from "@appranks/shared";
import { checkEligibility } from "./eligibility.js";
import { logEmailAttempt, updateEmailStatus } from "./email-logger.js";
import {
  generateUnsubscribeToken,
  injectTracking,
  rewriteLinks,
  buildUnsubscribeHeaders,
  buildUnsubscribeUrl,
} from "./tracking.js";

const log = createLogger("email:pipeline");

export interface SendEmailParams {
  db: any;
  emailType: string;
  userId: string;
  accountId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody: string;
  dataSnapshot?: Record<string, unknown>;
  deduplicationKey?: string;
  campaignId?: string;
  /** Disable tracking pixel and link rewriting (e.g., for test emails) */
  skipTracking?: boolean;
  /** Custom send function — defaults to existing mailer */
  sendFn?: (params: { to: string; subject: string; html: string; headers?: Record<string, string> }) => Promise<{ messageId?: string }>;
}

export interface SendEmailResult {
  sent: boolean;
  skipReason?: string;
  logId?: string;
}

/**
 * Central email send pipeline:
 * 1. Check eligibility
 * 2. Log attempt to DB
 * 3. Send via SMTP
 * 4. Update status
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { db, emailType, userId, accountId, recipientEmail, subject, htmlBody } = params;

  // Step 1: Eligibility check
  const eligibility = await checkEligibility(db, {
    emailType,
    userId,
    accountId,
    recipientEmail,
    deduplicationKey: params.deduplicationKey,
  });

  if (!eligibility.eligible) {
    log.info("email skipped", { emailType, userId, reason: eligibility.skipReason });
    return { sent: false, skipReason: eligibility.skipReason };
  }

  // Step 2: Generate unsubscribe token
  let unsubscribeToken: string | undefined;
  try {
    const { emailUnsubscribeTokens } = await import("@appranks/db");
    unsubscribeToken = generateUnsubscribeToken();
    await db.insert(emailUnsubscribeTokens).values({
      token: unsubscribeToken,
      userId,
      emailType,
    });
  } catch (err) {
    log.warn("failed to create unsubscribe token", { error: String(err) });
  }

  // Step 3: Log attempt
  const logId = await logEmailAttempt(db, {
    emailType,
    userId,
    accountId,
    recipientEmail,
    recipientName: params.recipientName,
    subject,
    htmlBody,
    dataSnapshot: {
      ...params.dataSnapshot,
      deduplicationKey: params.deduplicationKey,
      unsubscribeToken,
    },
    campaignId: params.campaignId,
  });

  // Step 4: Inject tracking (pixel + link rewriting) unless skipped
  let finalHtml = htmlBody;
  let linkMap: Record<number, string> = {};
  if (!params.skipTracking) {
    const linkResult = rewriteLinks(finalHtml, logId);
    finalHtml = linkResult.html;
    linkMap = linkResult.linkMap;
    finalHtml = injectTracking(finalHtml, logId, unsubscribeToken);
  }

  // Store link map in data snapshot for click redirect lookup
  if (Object.keys(linkMap).length > 0) {
    try {
      const { emailLogs: emailLogsTable } = await import("@appranks/db");
      const { eq: eqOp } = await import("drizzle-orm");
      await db.update(emailLogsTable)
        .set({ dataSnapshot: { ...params.dataSnapshot, deduplicationKey: params.deduplicationKey, unsubscribeToken, linkMap } })
        .where(eqOp(emailLogsTable.id, logId));
    } catch {
      // Non-critical — click tracking will fail gracefully
    }
  }

  // Step 5: Build headers
  const headers: Record<string, string> = {};
  if (unsubscribeToken) {
    Object.assign(headers, buildUnsubscribeHeaders(unsubscribeToken));
  }

  // Step 6: Send
  try {
    if (params.sendFn) {
      const result = await params.sendFn({ to: recipientEmail, subject, html: finalHtml, headers });
      await updateEmailStatus(db, logId, "sent", { messageId: result.messageId });
    } else {
      const { sendMail } = await import("./mailer.js");
      const result = await sendMail(recipientEmail, subject, finalHtml, headers);
      await updateEmailStatus(db, logId, "sent", { messageId: result.messageId });
    }

    log.info("email sent", { emailType, userId, logId });
    return { sent: true, logId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateEmailStatus(db, logId, "failed", { errorMessage });
    log.error("email send failed", { emailType, userId, logId, error: errorMessage });
    return { sent: false, skipReason: `send failed: ${errorMessage}`, logId };
  }
}
