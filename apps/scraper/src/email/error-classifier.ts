/**
 * Classifies email sending errors to determine retry strategy.
 *
 * - transient: temporary issue, normal retry (network hiccup, rate limit)
 * - permanent: will never succeed, skip to DLQ immediately (invalid address, auth failure)
 * - provider_down: SMTP server is unreachable, use extended retry + pause queue
 */

export type EmailErrorClass = "transient" | "permanent" | "provider_down";

/** Well-known SMTP reply codes and their classification */
const PERMANENT_SMTP_CODES = new Set([
  "550", // Mailbox unavailable / does not exist
  "551", // User not local
  "552", // Exceeded storage allocation
  "553", // Mailbox name not allowed
  "554", // Transaction failed (permanent)
  "556", // Domain does not accept mail
]);

const TRANSIENT_SMTP_CODES = new Set([
  "421", // Service not available (try later)
  "450", // Mailbox temporarily unavailable
  "451", // Local error in processing
  "452", // Insufficient system storage
]);

/** Patterns that indicate provider-level connectivity failure */
const PROVIDER_DOWN_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
  /connection\s*timeout/i,
  /socket\s*hang\s*up/i,
  /getaddrinfo\s+ENOTFOUND/i,
  /All SMTP providers are unavailable/i,
  /ALL_PROVIDERS_DOWN/i,
];

/** Patterns that indicate permanent recipient/auth issues */
const PERMANENT_PATTERNS = [
  /invalid.*email/i,
  /mailbox.*not\s*found/i,
  /user.*unknown/i,
  /address\s*rejected/i,
  /authentication\s*failed/i,
  /invalid\s*credentials/i,
  /relay\s*access\s*denied/i,
  /domain.*not\s*found/i,
  /no\s*such\s*user/i,
];

/** Patterns that indicate transient issues */
const TRANSIENT_PATTERNS = [
  /rate\s*limit/i,
  /too\s*many\s*(connections|requests)/i,
  /try\s*again\s*later/i,
  /temporarily\s*(rejected|unavailable)/i,
  /greylisted/i,
  /service\s*unavailable/i,
];

/**
 * Extract SMTP response code from error message if present.
 * SMTP errors often look like "550 5.1.1 User unknown" or "Error: 421 ..."
 */
function extractSmtpCode(message: string): string | undefined {
  const match = message.match(/\b([45]\d{2})\b/);
  return match?.[1];
}

export function classifyEmailError(error: unknown): EmailErrorClass {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code as string | undefined;

  // 1. Check error code first (Node.js system errors)
  if (code === "ALL_PROVIDERS_DOWN") return "provider_down";
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return "provider_down";
  }

  // 2. Check SMTP reply codes
  const smtpCode = extractSmtpCode(message);
  if (smtpCode) {
    if (PERMANENT_SMTP_CODES.has(smtpCode)) return "permanent";
    if (TRANSIENT_SMTP_CODES.has(smtpCode)) return "transient";
  }

  // 3. Pattern matching on error message
  for (const pattern of PROVIDER_DOWN_PATTERNS) {
    if (pattern.test(message)) return "provider_down";
  }
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) return "permanent";
  }
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) return "transient";
  }

  // 4. Default: treat unknown errors as transient (safe — will be retried)
  return "transient";
}
