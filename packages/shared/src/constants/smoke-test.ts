import type { PlatformId } from "./platforms.js";

export type SmokeCheckName = "categories" | "app" | "keyword" | "reviews" | "featured";

export interface SmokeCheck {
  check: SmokeCheckName;
  /** CLI argument (e.g. "trendsi", "email marketing"). undefined = no arg needed. */
  arg?: string;
}

export interface SmokePlatform {
  platform: PlatformId;
  clientType: "http" | "browser";
  /** Timeout in seconds: 60 for http, 120 for browser */
  timeoutSec: number;
  checks: SmokeCheck[];
}

export const SMOKE_CHECKS: SmokeCheckName[] = [
  "categories",
  "app",
  "keyword",
  "reviews",
  "featured",
];

/**
 * Platform check matrix mirroring scripts/smoke-test.sh lines 93-110.
 * Each platform lists which checks to run and with which arguments.
 */
export const SMOKE_PLATFORMS: SmokePlatform[] = [
  {
    platform: "shopify",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "finding-products --pages first" },
      { check: "app", arg: "trendsi" },
      { check: "keyword", arg: "email marketing --pages first" },
      { check: "reviews", arg: "formful" },
      { check: "featured" },
    ],
  },
  {
    platform: "salesforce",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "sales --pages first" },
      { check: "app", arg: "a0N4V00000JTeWyUAL" },
      { check: "keyword", arg: "document generation --pages first" },
      { check: "reviews", arg: "a0N4V00000JTeWyUAL" },
    ],
  },
  {
    platform: "canva",
    clientType: "browser",
    timeoutSec: 120,
    checks: [
      { check: "categories", arg: "ai-images --pages first" },
      { check: "app", arg: "AAE0b3zmS48--blur" },
      { check: "keyword", arg: "image generator --pages first" },
      { check: "featured" },
    ],
  },
  {
    platform: "wix",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "marketing --pages first" },
      { check: "app", arg: "wix-forms" },
      { check: "keyword", arg: "form builder --pages first" },
      { check: "reviews", arg: "wix-forms" },
    ],
  },
  {
    platform: "wordpress",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "contact-form --pages first" },
      { check: "app", arg: "contact-form-7" },
      { check: "keyword", arg: "contact form --pages first" },
      { check: "reviews", arg: "contact-form-7" },
    ],
  },
  {
    platform: "google_workspace",
    clientType: "browser",
    timeoutSec: 120,
    checks: [
      { check: "categories", arg: "business-tools --pages first" },
      { check: "app", arg: "able_poll--921058472860" },
      { check: "keyword", arg: "project management --pages first" },
      { check: "reviews", arg: "able_poll--921058472860" },
    ],
  },
  {
    platform: "atlassian",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "project-management --pages first" },
      { check: "app", arg: "com.onresolve.jira.groovy.groovyrunner" },
      { check: "keyword", arg: "time tracking --pages first" },
      { check: "reviews", arg: "com.onresolve.jira.groovy.groovyrunner" },
      { check: "featured" },
    ],
  },
  {
    platform: "zoom",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "crm --pages first" },
      { check: "app", arg: "VG_p3Bb_TwWe_bgZmPUaXw" },
      { check: "keyword", arg: "calendar --pages first" },
      { check: "featured" },
    ],
  },
  {
    platform: "zoho",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "desk --pages first" },
      { check: "app", arg: "crm--360-sms-for-zoho-crm" },
      { check: "keyword", arg: "inventory --pages first" },
    ],
  },
  {
    platform: "zendesk",
    clientType: "browser",
    timeoutSec: 120,
    checks: [
      { check: "categories", arg: "ai-and-bots --pages first" },
      { check: "app", arg: "972305--slack" },
      { check: "keyword", arg: "automation --pages first" },
      { check: "reviews", arg: "972305--slack" },
      { check: "featured" },
    ],
  },
  {
    platform: "hubspot",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "sales --pages first" },
      { check: "app", arg: "gmail" },
      { check: "keyword", arg: "email marketing --pages first" },
      { check: "reviews", arg: "gmail" },
      { check: "featured" },
    ],
  },
  {
    platform: "woocommerce",
    clientType: "http",
    timeoutSec: 60,
    checks: [
      { check: "categories", arg: "merchandising --pages first" },
      { check: "app", arg: "woocommerce-subscriptions" },
      { check: "keyword", arg: "payment --pages first" },
      { check: "featured" },
    ],
  },
];

/** Browser-dependent platforms (need Playwright) */
export const BROWSER_PLATFORMS = SMOKE_PLATFORMS
  .filter((p) => p.clientType === "browser")
  .map((p) => p.platform);

/**
 * Get the check config for a specific platform+check combination.
 * Returns undefined if the platform doesn't have that check (N/A).
 */
export function getSmokeCheck(
  platform: PlatformId,
  check: SmokeCheckName,
): SmokeCheck | undefined {
  const p = SMOKE_PLATFORMS.find((sp) => sp.platform === platform);
  if (!p) return undefined;
  return p.checks.find((c) => c.check === check);
}

/**
 * Get the platform config for a specific platform.
 */
export function getSmokePlatform(platform: PlatformId): SmokePlatform | undefined {
  return SMOKE_PLATFORMS.find((sp) => sp.platform === platform);
}

/**
 * Count total checks across all platforms (including N/A cells).
 * Used for progress tracking.
 */
export function countTotalSmokeChecks(): number {
  return SMOKE_PLATFORMS.reduce((sum, p) => sum + p.checks.length, 0);
}
