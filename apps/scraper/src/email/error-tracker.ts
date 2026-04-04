/**
 * Structured email error tracking and categorization (PLA-682).
 * Adds rich context to email errors for debugging and monitoring.
 */
import { createLogger } from "@appranks/shared";
import { classifyEmailError, type EmailErrorClass } from "./error-classifier.js";

const log = createLogger("email:error-tracker");

export type EmailErrorCategory =
  | "smtp_connection"
  | "smtp_auth"
  | "smtp_rejected"
  | "template_render"
  | "eligibility_blocked"
  | "rate_limited"
  | "suppressed"
  | "provider_down"
  | "unknown";

export interface EmailErrorContext {
  category: EmailErrorCategory;
  errorClass: EmailErrorClass;
  emailType: string;
  recipient?: string;
  userId?: string;
  jobId?: string;
  queueName?: string;
  attempt?: number;
  maxAttempts?: number;
  durationMs?: number;
  smtpResponse?: string;
  errorMessage: string;
  errorStack?: string;
  timestamp: string;
}

/**
 * Categorize an email error into a specific category for tracking.
 */
export function categorizeEmailError(error: unknown): EmailErrorCategory {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code as string | undefined;

  // SMTP auth errors
  if (/authentication\s*failed/i.test(message) || /invalid\s*credentials/i.test(message)) {
    return "smtp_auth";
  }

  // SMTP connection errors
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET" ||
      /connection\s*(refused|timeout|reset)/i.test(message) ||
      /EHOSTUNREACH|ENETUNREACH/i.test(message)) {
    return "smtp_connection";
  }

  // Provider down (all providers exhausted)
  if (code === "ALL_PROVIDERS_DOWN" || /all smtp providers/i.test(message)) {
    return "provider_down";
  }

  // SMTP rejected (recipient issues)
  if (/5[0-5]\d/.test(message) || /rejected|denied|unknown.*user|mailbox.*not/i.test(message)) {
    return "smtp_rejected";
  }

  // Template render errors
  if (/template|render|undefined.*property|cannot read/i.test(message)) {
    return "template_render";
  }

  // Rate limiting
  if (/rate\s*limit|too\s*many/i.test(message)) {
    return "rate_limited";
  }

  return "unknown";
}

/**
 * Build a structured error context from an email error event.
 */
export function buildErrorContext(
  error: unknown,
  meta: {
    emailType: string;
    recipient?: string;
    userId?: string;
    jobId?: string;
    queueName?: string;
    attempt?: number;
    maxAttempts?: number;
    durationMs?: number;
  }
): EmailErrorContext {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const category = categorizeEmailError(error);
  const errorClass = classifyEmailError(error);

  // Extract SMTP response if present
  const smtpMatch = errorObj.message.match(/\b([45]\d{2}\s+[^\n]+)/);

  return {
    category,
    errorClass,
    emailType: meta.emailType,
    recipient: meta.recipient,
    userId: meta.userId,
    jobId: meta.jobId,
    queueName: meta.queueName,
    attempt: meta.attempt,
    maxAttempts: meta.maxAttempts,
    durationMs: meta.durationMs,
    smtpResponse: smtpMatch?.[1],
    errorMessage: errorObj.message,
    errorStack: errorObj.stack,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log a structured email error with full context.
 * Call this from workers/pipeline on error.
 */
export function trackEmailError(
  error: unknown,
  meta: {
    emailType: string;
    recipient?: string;
    userId?: string;
    jobId?: string;
    queueName?: string;
    attempt?: number;
    maxAttempts?: number;
    durationMs?: number;
  }
): EmailErrorContext {
  const ctx = buildErrorContext(error, meta);

  log.error("email error tracked", {
    ...ctx,
    errorStack: undefined, // Don't log full stack in structured log
  });

  return ctx;
}
