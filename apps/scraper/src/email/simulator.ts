/**
 * Universal email simulation engine (PLA-677).
 * Simulates what would happen when sending an email without actually sending it.
 * Runs eligibility checks, renders templates, and reports what would/wouldn't be sent.
 */
import { createLogger } from "@appranks/shared";
import type { InstantEmailJobType } from "@appranks/shared";
import { checkEligibility } from "./eligibility.js";
import { templateRenderers } from "./process-instant-email.js";

const log = createLogger("email:simulator");

export interface SimulationResult {
  wouldSend: boolean;
  emailType: string;
  recipient?: string;
  subject?: string;
  htmlPreview?: string;
  eligibility: {
    eligible: boolean;
    skipReason?: string;
  };
  metadata: {
    templateFound: boolean;
    estimatedSizeBytes?: number;
    hasTrackingPixel: boolean;
    hasUnsubscribeHeader: boolean;
  };
}

export interface BulkSimulationResult {
  emailType: string;
  totalUsers: number;
  eligibleCount: number;
  ineligibleCount: number;
  ineligibleBreakdown: Record<string, number>;
  samplePreviews: SimulationResult[];
}

/**
 * Simulate sending an email to a single user.
 * Does NOT actually send — only checks eligibility and renders the template.
 */
export async function simulateEmail(
  db: any,
  params: {
    emailType: string;
    userId: string;
    accountId: string;
    recipientEmail: string;
    payload?: Record<string, unknown>;
  }
): Promise<SimulationResult> {
  const { emailType, userId, accountId, recipientEmail, payload } = params;

  // 1. Check eligibility
  const eligibility = await checkEligibility(db, {
    emailType,
    userId,
    accountId,
    recipientEmail,
  });

  // 2. Try to render the template
  const renderer = templateRenderers[emailType as InstantEmailJobType] ?? undefined;
  let subject: string | undefined;
  let htmlPreview: string | undefined;
  let templateFound = !!renderer;

  if (renderer && payload) {
    try {
      const rendered = renderer(payload);
      subject = rendered.subject;
      htmlPreview = rendered.html;
    } catch (err) {
      log.warn("template render failed during simulation", {
        emailType,
        error: String(err),
      });
    }
  }

  const estimatedSizeBytes = htmlPreview
    ? new TextEncoder().encode(htmlPreview).length
    : undefined;

  return {
    wouldSend: eligibility.eligible,
    emailType,
    recipient: recipientEmail,
    subject,
    htmlPreview,
    eligibility,
    metadata: {
      templateFound,
      estimatedSizeBytes,
      hasTrackingPixel: true, // Pipeline always adds tracking unless skipped
      hasUnsubscribeHeader: !["email_password_reset", "email_verification", "email_2fa_code"].includes(emailType),
    },
  };
}

/**
 * Simulate bulk email send — counts how many users would receive it.
 * Checks eligibility for each user in the provided list.
 */
export async function simulateBulkEmail(
  db: any,
  params: {
    emailType: string;
    users: { userId: string; accountId: string; email: string; name?: string }[];
    payload?: Record<string, unknown>;
    sampleCount?: number;
  }
): Promise<BulkSimulationResult> {
  const { emailType, users, payload, sampleCount = 3 } = params;

  let eligibleCount = 0;
  let ineligibleCount = 0;
  const ineligibleBreakdown: Record<string, number> = {};
  const samplePreviews: SimulationResult[] = [];

  for (const user of users) {
    const result = await simulateEmail(db, {
      emailType,
      userId: user.userId,
      accountId: user.accountId,
      recipientEmail: user.email,
      payload: payload
        ? { ...payload, name: user.name || "User" }
        : undefined,
    });

    if (result.wouldSend) {
      eligibleCount++;
      if (samplePreviews.length < sampleCount) {
        samplePreviews.push(result);
      }
    } else {
      ineligibleCount++;
      const reason = result.eligibility.skipReason || "unknown";
      ineligibleBreakdown[reason] = (ineligibleBreakdown[reason] || 0) + 1;
    }
  }

  return {
    emailType,
    totalUsers: users.length,
    eligibleCount,
    ineligibleCount,
    ineligibleBreakdown,
    samplePreviews,
  };
}
