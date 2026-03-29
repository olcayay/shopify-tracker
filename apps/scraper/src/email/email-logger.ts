import { eq } from "drizzle-orm";
import { emailLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("email:logger");

interface LogEmailParams {
  emailType: string;
  userId?: string;
  accountId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody?: string;
  dataSnapshot?: Record<string, unknown>;
  campaignId?: string;
}

/** Log an email attempt to the database and return the log ID */
export async function logEmailAttempt(db: any, params: LogEmailParams): Promise<string> {
  const [row] = await db
    .insert(emailLogs)
    .values({
      emailType: params.emailType,
      userId: params.userId,
      accountId: params.accountId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject: params.subject,
      htmlBody: params.htmlBody,
      dataSnapshot: params.dataSnapshot,
      status: "queued",
      campaignId: params.campaignId,
    })
    .returning({ id: emailLogs.id });

  return row.id;
}

/** Update email log status after send attempt */
export async function updateEmailStatus(
  db: any,
  logId: string,
  status: "sent" | "failed" | "bounced",
  extra?: { messageId?: string; errorMessage?: string }
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (status === "sent") {
    updates.sentAt = new Date();
    if (extra?.messageId) updates.messageId = extra.messageId;
  }

  if (status === "failed" && extra?.errorMessage) {
    updates.errorMessage = extra.errorMessage;
  }

  await db
    .update(emailLogs)
    .set(updates)
    .where(eq(emailLogs.id, logId));
}
