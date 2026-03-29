/**
 * Core processing logic for instant (transactional) email jobs.
 * Extracted from the worker for testability.
 */
import type { Job } from "bullmq";
import type { InstantEmailJobData, InstantEmailJobType } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { sendMail } from "./mailer.js";
import { logEmailAttempt, updateEmailStatus } from "./email-logger.js";
import {
  passwordResetTemplate,
  emailVerificationTemplate,
  invitationTemplate,
  loginAlertTemplate,
  twoFactorCodeTemplate,
} from "./templates/transactional/index.js";
import { emailLayout, header, ctaButton } from "./components/index.js";

const log = createLogger("email-instant");

type TemplateResult = { subject: string; html: string };

export const templateRenderers: Record<InstantEmailJobType, (payload: Record<string, unknown>) => TemplateResult> = {
  email_password_reset: (p) => passwordResetTemplate({
    name: p.name as string,
    resetUrl: p.resetUrl as string,
    expiryHours: p.expiryHours as number | undefined,
  }),
  email_verification: (p) => emailVerificationTemplate({
    name: p.name as string,
    verificationUrl: p.verificationUrl as string,
  }),
  email_welcome: (p) => {
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
    const body = `
      ${header("Welcome to AppRanks")}
      <div style="padding:24px;">
        <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${p.name as string},</p>
        <p style="font-size:16px;line-height:1.6;color:#374151;">Welcome to AppRanks! Your account is ready.</p>
        ${ctaButton("Go to Dashboard", dashboardUrl)}
      </div>
    `;
    return { subject: "Welcome to AppRanks!", html: emailLayout(body, "Welcome to AppRanks!") };
  },
  email_invitation: (p) => invitationTemplate({
    inviterName: p.inviterName as string,
    accountName: p.accountName as string,
    acceptUrl: p.acceptUrl as string,
    role: p.role as string | undefined,
  }),
  email_login_alert: (p) => loginAlertTemplate({
    name: p.name as string,
    device: p.device as string,
    location: p.location as string | undefined,
    ip: p.ip as string | undefined,
    loginTime: p.loginTime as string,
    secureAccountUrl: p.secureAccountUrl as string,
  }),
  email_2fa_code: (p) => twoFactorCodeTemplate({
    name: p.name as string,
    code: p.code as string,
    expiryMinutes: p.expiryMinutes as number | undefined,
  }),
};

export async function processInstantEmail(
  job: Job<InstantEmailJobData>,
  db: any
): Promise<void> {
  const { type, to, payload, userId, accountId } = job.data;
  log.info("processing instant email", { jobId: job.id, type, to });

  const renderer = templateRenderers[type];
  if (!renderer) {
    throw new Error(`Unknown instant email type: ${type}`);
  }

  const { subject, html } = renderer(payload);

  const logId = await logEmailAttempt(db, {
    emailType: type,
    userId,
    accountId,
    recipientEmail: to,
    recipientName: job.data.name,
    subject,
    htmlBody: html,
    dataSnapshot: payload,
  });

  try {
    const { messageId } = await sendMail(to, subject, html);
    await updateEmailStatus(db, logId, "sent", { messageId });
    log.info("instant email sent", { jobId: job.id, type, to, messageId });
  } catch (err) {
    await updateEmailStatus(db, logId, "failed", { errorMessage: String(err) });
    throw err; // BullMQ will retry
  }
}
