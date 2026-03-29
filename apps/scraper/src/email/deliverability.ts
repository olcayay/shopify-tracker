/**
 * Email deliverability configuration and helpers (PLA-355).
 *
 * SPF, DKIM, and DMARC are DNS-level configurations:
 *
 * ## Required DNS Records
 *
 * ### SPF Record (TXT on appranks.io):
 * v=spf1 include:_spf.google.com include:{smtp_provider} ~all
 *
 * ### DKIM Record (TXT on selector._domainkey.appranks.io):
 * v=DKIM1; k=rsa; p={public_key}
 * - The SMTP provider generates the DKIM key pair
 * - Add the TXT record they provide to DNS
 *
 * ### DMARC Record (TXT on _dmarc.appranks.io):
 * v=DMARC1; p=quarantine; rua=mailto:dmarc@appranks.io; pct=100; sp=none
 *
 * ## Implementation Notes
 * - All emails should be sent from a verified domain (noreply@appranks.io)
 * - Use SMTP provider's DKIM signing (most providers handle this automatically)
 * - Monitor DMARC reports for alignment issues
 * - Set Return-Path to match From domain for SPF alignment
 */

/**
 * Get recommended email headers for deliverability.
 * These supplement the List-Unsubscribe headers from tracking.ts.
 */
export function getDeliverabilityHeaders(): Record<string, string> {
  return {
    "X-Mailer": "AppRanks Email System",
    "X-Entity-Ref-ID": crypto.randomUUID(),
    // Precedence header tells mail servers this is bulk/transactional
    Precedence: "bulk",
    // Auto-Submitted header for automated emails (RFC 3834)
    "Auto-Submitted": "auto-generated",
  };
}

/**
 * Validate that the SMTP configuration is production-ready.
 */
export function validateSmtpConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host) issues.push("SMTP_HOST not configured");
  if (!user) issues.push("SMTP_USER not configured");
  if (!pass) issues.push("SMTP_PASS not configured");
  if (!from) issues.push("SMTP_FROM not configured — using SMTP_USER as fallback");

  // Check if From address uses our domain
  const fromAddr = from || user || "";
  if (fromAddr && !fromAddr.includes("appranks.io")) {
    issues.push(`SMTP_FROM "${fromAddr}" doesn't use appranks.io domain — may fail SPF/DKIM alignment`);
  }

  return { valid: issues.filter((i) => !i.includes("fallback")).length === 0, issues };
}

/**
 * DNS records that need to be configured for full deliverability.
 * Use this as a checklist for production setup.
 */
export const REQUIRED_DNS_RECORDS = [
  {
    type: "TXT",
    name: "appranks.io",
    purpose: "SPF",
    value: "v=spf1 include:_spf.google.com ~all",
    note: "Add your SMTP provider's SPF include directive",
  },
  {
    type: "TXT",
    name: "_dmarc.appranks.io",
    purpose: "DMARC",
    value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@appranks.io; pct=100",
    note: "Start with p=none for monitoring, then move to quarantine",
  },
  {
    type: "TXT",
    name: "selector._domainkey.appranks.io",
    purpose: "DKIM",
    value: "v=DKIM1; k=rsa; p={public_key_from_smtp_provider}",
    note: "Get the DKIM record from your SMTP provider's dashboard",
  },
];
