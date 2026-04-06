/**
 * Dry run system for email preview and bulk testing (PLA-353).
 *
 * Generates email previews without actually sending them.
 * Supports single preview and bulk preview (eligible count + sample subjects).
 */
import type { Database } from "@appranks/db";
import { buildDigestForAccount, getDigestRecipients } from "./digest-builder.js";
import { buildDigestHtml, buildDigestSubject } from "./digest-template.js";
import { buildWeeklyForAccount, getWeeklyRecipients } from "./weekly-builder.js";
import { buildWeeklyHtml, buildWeeklySubject } from "./weekly-template.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("email:dry-run");

export interface DryRunResult {
  emailType: string;
  subject: string;
  html: string;
  recipientCount: number;
  dataSnapshot: Record<string, unknown>;
}

export interface BulkDryRunResult {
  emailType: string;
  eligibleCount: number;
  sampleSubjects: string[];
  accountNames: string[];
}

/**
 * Generate a single email preview for an account.
 */
export async function dryRunPreview(
  db: Database,
  emailType: string,
  accountId: string,
  timezone?: string
): Promise<DryRunResult | null> {
  switch (emailType) {
    case "daily_digest": {
      const data = await buildDigestForAccount(db, accountId, timezone);
      if (!data) return null;
      return {
        emailType,
        subject: buildDigestSubject(data),
        html: buildDigestHtml(data),
        recipientCount: 1,
        dataSnapshot: { summary: data.summary, rankingCount: data.trackedApps.reduce((n, a) => n + a.keywordChanges.length, 0) },
      };
    }
    case "weekly_summary": {
      const data = await buildWeeklyForAccount(db, accountId, timezone);
      if (!data) return null;
      return {
        emailType,
        subject: buildWeeklySubject(data),
        html: buildWeeklyHtml(data),
        recipientCount: 1,
        dataSnapshot: { summary: data.summary, rankingCount: data.rankings.length },
      };
    }
    default:
      return null;
  }
}

/**
 * Bulk preview: count eligible recipients and generate sample subjects.
 */
export async function bulkDryRun(
  db: Database,
  emailType: string
): Promise<BulkDryRunResult> {
  let recipients: { email: string; accountId: string }[] = [];

  switch (emailType) {
    case "daily_digest":
      recipients = await getDigestRecipients(db);
      break;
    case "weekly_summary":
      recipients = await getWeeklyRecipients(db);
      break;
  }

  // Group by account and generate sample subjects for first 5 accounts
  const byAccount = new Map<string, number>();
  for (const r of recipients) {
    byAccount.set(r.accountId, (byAccount.get(r.accountId) || 0) + 1);
  }

  const sampleSubjects: string[] = [];
  const accountNames: string[] = [];
  let samplesCollected = 0;

  for (const [accountId] of byAccount) {
    if (samplesCollected >= 5) break;
    try {
      const result = await dryRunPreview(db, emailType, accountId);
      if (result) {
        sampleSubjects.push(result.subject);
        accountNames.push((result.dataSnapshot as any)?.accountName || accountId);
        samplesCollected++;
      }
    } catch (err) {
      log.warn("dry run preview failed", { accountId, error: String(err) });
    }
  }

  return {
    emailType,
    eligibleCount: recipients.length,
    sampleSubjects,
    accountNames,
  };
}
