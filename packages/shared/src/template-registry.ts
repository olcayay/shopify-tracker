/**
 * Template variable registry (PLA-444).
 *
 * Maps each notification/email type to its available template variables.
 * Used by the API for validation/preview and by the frontend for variable picker UI.
 */

import type { NotificationType } from "./notification-types.js";

// ---------------------------------------------------------------------------
// Variable metadata
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

// ---------------------------------------------------------------------------
// Notification template variables
// ---------------------------------------------------------------------------

const RANKING_VARS: TemplateVariable[] = [
  { name: "appName", description: "Tracked app name", example: "OrderFlow Pro" },
  { name: "appSlug", description: "App URL slug", example: "orderflow-pro" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
  { name: "position", description: "Current ranking position", example: "3" },
  { name: "previousPosition", description: "Previous ranking position", example: "7" },
  { name: "change", description: "Position change (+/-)", example: "4" },
  { name: "keyword", description: "Tracked keyword", example: "order tracking" },
  { name: "keywordSlug", description: "Keyword URL slug", example: "order-tracking" },
  { name: "categoryName", description: "Category name", example: "Orders & Shipping" },
  { name: "categorySlug", description: "Category URL slug", example: "orders-and-shipping" },
];

const COMPETITOR_VARS: TemplateVariable[] = [
  { name: "competitorName", description: "Competitor app name", example: "ShipTracker" },
  { name: "competitorSlug", description: "Competitor URL slug", example: "shiptracker" },
  { name: "appName", description: "Your tracked app name", example: "OrderFlow Pro" },
  { name: "keyword", description: "Related keyword", example: "shipping" },
  { name: "position", description: "Competitor position", example: "2" },
  { name: "surfaceName", description: "Featured section name", example: "Staff Picks" },
  { name: "reviewCount", description: "Number of reviews", example: "15" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
];

const REVIEW_VARS: TemplateVariable[] = [
  { name: "appName", description: "App name", example: "OrderFlow Pro" },
  { name: "appSlug", description: "App URL slug", example: "orderflow-pro" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
  { name: "rating", description: "Review rating (stars)", example: "5" },
  { name: "reviewCount", description: "Number of reviews", example: "12" },
];

const KEYWORD_VARS: TemplateVariable[] = [
  { name: "appName", description: "App name", example: "OrderFlow Pro" },
  { name: "appSlug", description: "App URL slug", example: "orderflow-pro" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
  { name: "keyword", description: "Keyword", example: "order tracking" },
  { name: "keywordSlug", description: "Keyword URL slug", example: "order-tracking" },
  { name: "position", description: "Current position", example: "5" },
  { name: "previousPosition", description: "Previous position", example: "12" },
  { name: "change", description: "Position change", example: "7" },
];

const FEATURED_VARS: TemplateVariable[] = [
  { name: "appName", description: "App name", example: "OrderFlow Pro" },
  { name: "appSlug", description: "App URL slug", example: "orderflow-pro" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
  { name: "surfaceName", description: "Featured section name", example: "Staff Picks" },
];

const SYSTEM_VARS: TemplateVariable[] = [
  { name: "scraperType", description: "Type of scraper", example: "category" },
  { name: "platform", description: "Marketplace platform", example: "shopify" },
  { name: "errorMessage", description: "Error message", example: "Connection timeout" },
];

const ACCOUNT_VARS: TemplateVariable[] = [
  { name: "memberName", description: "New member name", example: "Jane Doe" },
  { name: "memberEmail", description: "New member email", example: "jane@example.com" },
  { name: "limitType", description: "Type of limit", example: "tracked apps" },
  { name: "current", description: "Current usage", example: "48" },
  { name: "max", description: "Maximum allowed", example: "50" },
];

export const NOTIFICATION_TEMPLATE_VARIABLES: Record<NotificationType, TemplateVariable[]> = {
  ranking_top3_entry: RANKING_VARS,
  ranking_top3_exit: RANKING_VARS,
  ranking_significant_change: RANKING_VARS,
  ranking_new_entry: RANKING_VARS,
  ranking_dropped_out: RANKING_VARS,
  ranking_category_change: RANKING_VARS,
  competitor_overtook: COMPETITOR_VARS,
  competitor_featured: COMPETITOR_VARS,
  competitor_review_surge: COMPETITOR_VARS,
  competitor_pricing_change: COMPETITOR_VARS,
  review_new_positive: REVIEW_VARS,
  review_new_negative: REVIEW_VARS,
  review_velocity_spike: REVIEW_VARS,
  keyword_position_gained: KEYWORD_VARS,
  keyword_position_lost: KEYWORD_VARS,
  keyword_new_ranking: KEYWORD_VARS,
  featured_new_placement: FEATURED_VARS,
  featured_removed: FEATURED_VARS,
  system_scrape_complete: SYSTEM_VARS,
  system_scrape_failed: SYSTEM_VARS,
  account_member_joined: ACCOUNT_VARS,
  account_limit_warning: ACCOUNT_VARS,
  account_limit_reached: ACCOUNT_VARS,
};

// ---------------------------------------------------------------------------
// Email template variables
// ---------------------------------------------------------------------------

export type EmailType =
  | "email_password_reset"
  | "email_verification"
  | "email_welcome"
  | "email_invitation"
  | "email_login_alert"
  | "email_2fa_code"
  | "email_daily_digest"
  | "email_weekly_summary"
  | "email_ranking_alert"
  | "email_competitor_alert"
  | "email_review_alert"
  | "email_win_celebration"
  | "email_re_engagement"
  | "email_onboarding";

export const EMAIL_TEMPLATE_VARIABLES: Record<EmailType, TemplateVariable[]> = {
  email_password_reset: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "resetUrl", description: "Password reset URL", example: "https://appranks.io/reset?token=..." },
    { name: "expiryMinutes", description: "Link expiry time in minutes", example: "30" },
  ],
  email_verification: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "verifyUrl", description: "Verification URL", example: "https://appranks.io/verify?token=..." },
  ],
  email_welcome: [
    { name: "name", description: "User name", example: "Jane Doe" },
  ],
  email_invitation: [
    { name: "inviterName", description: "Person who sent the invite", example: "John Smith" },
    { name: "accountName", description: "Account name", example: "Acme Corp" },
    { name: "role", description: "Assigned role", example: "member" },
    { name: "inviteUrl", description: "Invitation URL", example: "https://appranks.io/invite?token=..." },
  ],
  email_login_alert: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "ipAddress", description: "Login IP address", example: "203.0.113.42" },
    { name: "userAgent", description: "Browser/device info", example: "Chrome on macOS" },
    { name: "loginTime", description: "Login timestamp", example: "2026-03-30 10:15 UTC" },
  ],
  email_2fa_code: [
    { name: "code", description: "Verification code", example: "483921" },
    { name: "expiryMinutes", description: "Code expiry time in minutes", example: "10" },
  ],
  email_daily_digest: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "date", description: "Digest date", example: "March 30, 2026" },
  ],
  email_weekly_summary: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "dateRange", description: "Week date range", example: "Mar 24-30, 2026" },
  ],
  email_ranking_alert: [
    { name: "appName", description: "App name", example: "OrderFlow Pro" },
    { name: "categoryName", description: "Category name", example: "Orders & Shipping" },
    { name: "position", description: "New position", example: "3" },
    { name: "previousPosition", description: "Previous position", example: "8" },
  ],
  email_competitor_alert: [
    { name: "competitorName", description: "Competitor name", example: "ShipTracker" },
    { name: "appName", description: "Your app name", example: "OrderFlow Pro" },
    { name: "changeType", description: "Type of change", example: "pricing update" },
  ],
  email_review_alert: [
    { name: "appName", description: "App name", example: "OrderFlow Pro" },
    { name: "rating", description: "Review rating", example: "5" },
    { name: "reviewCount", description: "Total new reviews", example: "3" },
  ],
  email_win_celebration: [
    { name: "appName", description: "App name", example: "OrderFlow Pro" },
    { name: "position", description: "Achieved position", example: "1" },
    { name: "categoryName", description: "Category name", example: "Orders & Shipping" },
  ],
  email_re_engagement: [
    { name: "name", description: "User name", example: "Jane Doe" },
    { name: "daysSinceLastVisit", description: "Days since last login", example: "14" },
  ],
  email_onboarding: [
    { name: "name", description: "User name", example: "Jane Doe" },
  ],
};

// ---------------------------------------------------------------------------
// Template rendering utility
// ---------------------------------------------------------------------------

/**
 * Substitute {{variable}} placeholders in a template string.
 * Unknown variables are left as-is.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value != null ? String(value) : match;
  });
}

/**
 * Build sample data for previewing a notification template.
 */
export function buildNotificationSampleData(type: NotificationType): Record<string, string> {
  const vars = NOTIFICATION_TEMPLATE_VARIABLES[type] || [];
  const data: Record<string, string> = {};
  for (const v of vars) {
    data[v.name] = v.example;
  }
  return data;
}

/**
 * Build sample data for previewing an email template.
 */
export function buildEmailSampleData(type: EmailType): Record<string, string> {
  const vars = EMAIL_TEMPLATE_VARIABLES[type] || [];
  const data: Record<string, string> = {};
  for (const v of vars) {
    data[v.name] = v.example;
  }
  return data;
}
