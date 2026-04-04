/**
 * Job data types for the email-instant and email-bulk queues.
 */

// ── Instant (transactional) email job types ─────────────────────────

export type InstantEmailJobType =
  | "email_password_reset"
  | "email_verification"
  | "email_welcome"
  | "email_invitation"
  | "email_login_alert"
  | "email_2fa_code";

export interface InstantEmailJobData {
  type: InstantEmailJobType;
  /** Recipient email address */
  to: string;
  /** Recipient display name */
  name?: string;
  /** User ID (if the recipient is a registered user) */
  userId?: string;
  /** Account ID (if scoped to an account) */
  accountId?: string;
  /** Template-specific payload */
  payload: Record<string, unknown>;
  /** ISO timestamp when the job was created */
  createdAt: string;
}

// ── Bulk (marketing/digest) email job types ─────────────────────────

export type BulkEmailJobType =
  | "email_daily_digest"
  | "email_weekly_summary"
  | "email_ranking_alert"
  | "email_competitor_alert"
  | "email_review_alert"
  | "email_win_celebration"
  | "email_re_engagement"
  | "email_onboarding"
  | "email_campaign";

export interface BulkEmailJobData {
  type: BulkEmailJobType;
  /** Recipient email address */
  to: string;
  /** Recipient display name */
  name?: string;
  /** User ID */
  userId: string;
  /** Account ID */
  accountId: string;
  /** Template-specific payload */
  payload: Record<string, unknown>;
  /** ISO timestamp when the job was created */
  createdAt: string;
  /** Optional campaign ID for tracking */
  campaignId?: string;
}
