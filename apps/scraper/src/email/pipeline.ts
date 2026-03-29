import { createLogger } from "@appranks/shared";
import { checkEligibility } from "./eligibility.js";
import { logEmailAttempt, updateEmailStatus } from "./email-logger.js";

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
  /** Custom send function — defaults to existing mailer */
  sendFn?: (params: { to: string; subject: string; html: string }) => Promise<{ messageId?: string }>;
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

  // Step 2: Log attempt
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
    },
    campaignId: params.campaignId,
  });

  // Step 3: Send
  try {
    if (params.sendFn) {
      const result = await params.sendFn({ to: recipientEmail, subject, html: htmlBody });
      await updateEmailStatus(db, logId, "sent", { messageId: result.messageId });
    } else {
      // Use existing mailer
      const { sendMail } = await import("./mailer.js");
      await sendMail(recipientEmail, subject, htmlBody);
      await updateEmailStatus(db, logId, "sent");
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
