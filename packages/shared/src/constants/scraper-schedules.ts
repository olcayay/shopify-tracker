import type { PlatformId } from "./platforms.js";

export interface ScraperSchedule {
  name: string;
  cron: string;
  type: string;
  platform: PlatformId;
}

export const SCRAPER_SCHEDULES: ScraperSchedule[] = [
  // Schedule grid: max 2 jobs per 15-min window. Browser platforms (GWS, Zendesk,
  // Canva, Zoho) are spread apart to avoid Playwright memory contention.
  //
  // ── Shopify (HTTP only) ──
  { name: "category", cron: "0 3 * * *", type: "category", platform: "shopify" },
  { name: "app_details", cron: "0 1,13 * * *", type: "app_details", platform: "shopify" },
  { name: "keyword_search", cron: "0 0,12 * * *", type: "keyword_search", platform: "shopify" },
  { name: "reviews", cron: "0 6 * * *", type: "reviews", platform: "shopify" },
  { name: "daily_digest", cron: "*/15 * * * *", type: "daily_digest", platform: "shopify" },
  { name: "compute_app_scores", cron: "0 9 * * *", type: "compute_app_scores", platform: "shopify" },
  // ── Salesforce (HTTP only) ──
  { name: "salesforce_category", cron: "0 4 * * *", type: "category", platform: "salesforce" },
  { name: "salesforce_app_details", cron: "0 2,14 * * *", type: "app_details", platform: "salesforce" },
  { name: "salesforce_reviews", cron: "0 7 * * *", type: "reviews", platform: "salesforce" },
  { name: "salesforce_compute_app_scores", cron: "15 10 * * *", type: "compute_app_scores", platform: "salesforce" },
  // ── Canva (browser) ──
  { name: "canva_category", cron: "30 4 * * *", type: "category", platform: "canva" },
  { name: "canva_app_details", cron: "30 2,14 * * *", type: "app_details", platform: "canva" },
  { name: "canva_keyword_search", cron: "15 3,15 * * *", type: "keyword_search", platform: "canva" },
  { name: "canva_compute_app_scores", cron: "45 10 * * *", type: "compute_app_scores", platform: "canva" },
  // ── Wix (HTTP only) ──
  { name: "wix_category", cron: "0 5 * * *", type: "category", platform: "wix" },
  { name: "wix_app_details", cron: "45 2,14 * * *", type: "app_details", platform: "wix" },
  { name: "wix_keyword_search", cron: "30 3,15 * * *", type: "keyword_search", platform: "wix" },
  { name: "wix_reviews", cron: "0 8 * * *", type: "reviews", platform: "wix" },
  { name: "wix_compute_app_scores", cron: "15 11 * * *", type: "compute_app_scores", platform: "wix" },
  // ── WordPress (HTTP only) ──
  { name: "wordpress_category", cron: "30 5 * * *", type: "category", platform: "wordpress" },
  { name: "wordpress_app_details", cron: "0 4,16 * * *", type: "app_details", platform: "wordpress" },
  { name: "wordpress_keyword_search", cron: "30 4,16 * * *", type: "keyword_search", platform: "wordpress" },
  { name: "wordpress_reviews", cron: "30 8 * * *", type: "reviews", platform: "wordpress" },
  { name: "wordpress_compute_app_scores", cron: "45 11 * * *", type: "compute_app_scores", platform: "wordpress" },
  // ── Google Workspace (browser) ──
  { name: "google_workspace_category", cron: "0 6 * * *", type: "category", platform: "google_workspace" },
  { name: "google_workspace_app_details", cron: "30 5,17 * * *", type: "app_details", platform: "google_workspace" },
  { name: "google_workspace_keyword_search", cron: "0 6,18 * * *", type: "keyword_search", platform: "google_workspace" },
  { name: "google_workspace_reviews", cron: "30 9 * * *", type: "reviews", platform: "google_workspace" },
  { name: "google_workspace_compute_app_scores", cron: "15 12 * * *", type: "compute_app_scores", platform: "google_workspace" },
  // ── Atlassian (HTTP only) ──
  { name: "atlassian_category", cron: "30 6 * * *", type: "category", platform: "atlassian" },
  { name: "atlassian_app_details", cron: "0 7,19 * * *", type: "app_details", platform: "atlassian" },
  { name: "atlassian_keyword_search", cron: "30 7,19 * * *", type: "keyword_search", platform: "atlassian" },
  { name: "atlassian_reviews", cron: "45 9 * * *", type: "reviews", platform: "atlassian" },
  { name: "atlassian_compute_app_scores", cron: "45 12 * * *", type: "compute_app_scores", platform: "atlassian" },
  // ── Zoom (HTTP only) ──
  { name: "zoom_category", cron: "15 8 * * *", type: "category", platform: "zoom" },
  { name: "zoom_app_details", cron: "30 8,20 * * *", type: "app_details", platform: "zoom" },
  { name: "zoom_keyword_search", cron: "0 9,21 * * *", type: "keyword_search", platform: "zoom" },
  { name: "zoom_compute_app_scores", cron: "15 13 * * *", type: "compute_app_scores", platform: "zoom" },
  // ── Zoho (browser) ──
  { name: "zoho_category", cron: "15 9 * * *", type: "category", platform: "zoho" },
  { name: "zoho_app_details", cron: "0 10,22 * * *", type: "app_details", platform: "zoho" },
  { name: "zoho_keyword_search", cron: "30 10,22 * * *", type: "keyword_search", platform: "zoho" },
  { name: "zoho_compute_app_scores", cron: "45 13 * * *", type: "compute_app_scores", platform: "zoho" },
  // ── Zendesk (browser) ──
  { name: "zendesk_category", cron: "0 11 * * *", type: "category", platform: "zendesk" },
  { name: "zendesk_app_details", cron: "30 11,23 * * *", type: "app_details", platform: "zendesk" },
  { name: "zendesk_keyword_search", cron: "15 0,12 * * *", type: "keyword_search", platform: "zendesk" },
  { name: "zendesk_reviews", cron: "15 10 * * *", type: "reviews", platform: "zendesk" },
  { name: "zendesk_compute_app_scores", cron: "0 14 * * *", type: "compute_app_scores", platform: "zendesk" },
  // ── HubSpot (HTTP only) ──
  { name: "hubspot_category", cron: "30 11 * * *", type: "category", platform: "hubspot" },
  { name: "hubspot_app_details", cron: "0 13,1 * * *", type: "app_details", platform: "hubspot" },
  { name: "hubspot_keyword_search", cron: "30 13,1 * * *", type: "keyword_search", platform: "hubspot" },
  { name: "hubspot_reviews", cron: "45 10 * * *", type: "reviews", platform: "hubspot" },
  { name: "hubspot_compute_app_scores", cron: "30 14 * * *", type: "compute_app_scores", platform: "hubspot" },
  // ── Cross-platform maintenance ──
  { name: "data_cleanup", cron: "0 2 * * 0", type: "data_cleanup", platform: "shopify" },
];

/** Parse cron expression and compute next run time */
export function getNextRunFromCron(cronExpr: string): Date {
  // Parse cron: "M H * * *" format
  const parts = cronExpr.split(" ");
  const cronMinute = parseInt(parts[0], 10);
  const hourPart = parts[1];
  const cronHours = hourPart.split(",").map((h) => parseInt(h, 10));

  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();

  // Find next matching hour today
  for (const ch of cronHours) {
    if (ch > h || (ch === h && m < cronMinute)) {
      const next = new Date(now);
      next.setUTCHours(ch, cronMinute, 0, 0);
      return next;
    }
  }

  // Tomorrow at first hour
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(cronHours[0], cronMinute, 0, 0);
  return next;
}

/** Get schedule interval in milliseconds (time between runs) */
export function getScheduleIntervalMs(cronExpr: string): number {
  const parts = cronExpr.split(" ");
  const hourPart = parts[1];
  const cronHours = hourPart.split(",").map((h) => parseInt(h, 10));

  if (cronHours.length === 1) return 24 * 60 * 60 * 1000; // daily
  // Compute interval from first two hours
  const interval = cronHours[1] - cronHours[0];
  return interval * 60 * 60 * 1000;
}

/** Find schedule for a given platform + scraper type */
export function findSchedule(platform: string, scraperType: string): ScraperSchedule | undefined {
  return SCRAPER_SCHEDULES.find((s) => s.platform === platform && s.type === scraperType);
}
