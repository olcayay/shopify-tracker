/**
 * Notification content templates.
 * Each type maps to title/body/url builders using event data.
 */
import type { NotificationType } from "../notification-types.js";

export interface NotificationContent {
  title: string;
  body: string;
  url: string | null;
  icon: string | null;
  priority: "low" | "normal" | "high" | "urgent";
}

export interface NotificationEventData {
  appName?: string;
  appSlug?: string;
  platform?: string;
  keyword?: string;
  keywordSlug?: string;
  categoryName?: string;
  categorySlug?: string;
  position?: number;
  previousPosition?: number;
  change?: number;
  rating?: number;
  reviewCount?: number;
  competitorName?: string;
  competitorSlug?: string;
  surfaceName?: string;
  memberName?: string;
  memberEmail?: string;
  limitType?: string;
  current?: number;
  max?: number;
  errorMessage?: string;
  scraperType?: string;
  [key: string]: unknown;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function posChange(change: number | undefined): string {
  if (!change) return "";
  return change > 0 ? `↑${change}` : `↓${Math.abs(change)}`;
}

const TEMPLATES: Record<NotificationType, (e: NotificationEventData) => NotificationContent> = {
  // Ranking
  ranking_top3_entry: (e) => ({
    title: truncate(`${e.appName} entered Top 3 for "${e.keyword}"`, 65),
    body: `Now at position ${e.position} in ${e.categoryName || "category"}.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "high",
  }),
  ranking_top3_exit: (e) => ({
    title: truncate(`${e.appName} dropped out of Top 3 for "${e.keyword}"`, 65),
    body: `Now at position ${e.position}. Was in Top 3.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "high",
  }),
  ranking_significant_change: (e) => ({
    title: truncate(`${e.appName} ${posChange(e.change)} for "${e.keyword}"`, 65),
    body: `Position changed from ${e.previousPosition} to ${e.position} (${posChange(e.change)}).`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  ranking_new_entry: (e) => ({
    title: truncate(`${e.appName} appeared in "${e.categoryName}"`, 65),
    body: `New entry at position ${e.position}.`,
    url: e.platform && e.categorySlug ? `/${e.platform}/categories/${e.categorySlug}` : null,
    icon: null,
    priority: "normal",
  }),
  ranking_dropped_out: (e) => ({
    title: truncate(`${e.appName} dropped out of "${e.categoryName}"`, 65),
    body: `No longer listed in this category. Was at position ${e.previousPosition}.`,
    url: e.platform && e.categorySlug ? `/${e.platform}/categories/${e.categorySlug}` : null,
    icon: null,
    priority: "high",
  }),
  ranking_category_change: (e) => ({
    title: truncate(`${e.appName} ${posChange(e.change)} in "${e.categoryName}"`, 65),
    body: `Category rank changed from ${e.previousPosition} to ${e.position}.`,
    url: e.platform && e.categorySlug ? `/${e.platform}/categories/${e.categorySlug}` : null,
    icon: null,
    priority: "normal",
  }),

  // Competitor
  competitor_overtook: (e) => ({
    title: truncate(`${e.competitorName} overtook ${e.appName}`, 65),
    body: `For "${e.keyword}": ${e.competitorName} is now at ${e.position}.`,
    url: e.platform && e.competitorSlug ? `/${e.platform}/apps/${e.competitorSlug}` : null,
    icon: null,
    priority: "high",
  }),
  competitor_featured: (e) => ({
    title: truncate(`${e.competitorName} got featured`, 65),
    body: `Spotted in ${e.surfaceName || "featured section"}.`,
    url: e.platform && e.competitorSlug ? `/${e.platform}/apps/${e.competitorSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  competitor_review_surge: (e) => ({
    title: truncate(`${e.competitorName} review surge`, 65),
    body: `${e.reviewCount} new reviews detected.`,
    url: e.platform && e.competitorSlug ? `/${e.platform}/apps/${e.competitorSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  competitor_pricing_change: (e) => ({
    title: truncate(`${e.competitorName} changed pricing`, 65),
    body: `Pricing update detected for ${e.competitorName}.`,
    url: e.platform && e.competitorSlug ? `/${e.platform}/apps/${e.competitorSlug}` : null,
    icon: null,
    priority: "high",
  }),

  // Review
  review_new_positive: (e) => ({
    title: truncate(`New ${e.rating}★ review for ${e.appName}`, 65),
    body: `A positive review was posted.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  review_new_negative: (e) => ({
    title: truncate(`New ${e.rating}★ review for ${e.appName}`, 65),
    body: `A negative review needs attention.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "high",
  }),
  review_velocity_spike: (e) => ({
    title: truncate(`Review velocity spike for ${e.appName}`, 65),
    body: `${e.reviewCount} reviews in recent period — unusual activity.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "normal",
  }),

  // Keyword
  keyword_position_gained: (e) => ({
    title: truncate(`${e.appName} gained position for "${e.keyword}"`, 65),
    body: `Moved from ${e.previousPosition} to ${e.position} (${posChange(e.change)}).`,
    url: e.platform && e.keywordSlug ? `/${e.platform}/keywords/${e.keywordSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  keyword_position_lost: (e) => ({
    title: truncate(`${e.appName} lost position for "${e.keyword}"`, 65),
    body: `Dropped from ${e.previousPosition} to ${e.position}.`,
    url: e.platform && e.keywordSlug ? `/${e.platform}/keywords/${e.keywordSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  keyword_new_ranking: (e) => ({
    title: truncate(`${e.appName} ranked for "${e.keyword}"`, 65),
    body: `First appearance at position ${e.position}.`,
    url: e.platform && e.keywordSlug ? `/${e.platform}/keywords/${e.keywordSlug}` : null,
    icon: null,
    priority: "normal",
  }),

  // Featured
  featured_new_placement: (e) => ({
    title: truncate(`${e.appName} got featured`, 65),
    body: `Spotted in ${e.surfaceName || "a featured section"}.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "normal",
  }),
  featured_removed: (e) => ({
    title: truncate(`${e.appName} removed from featured`, 65),
    body: `No longer in ${e.surfaceName || "featured section"}.`,
    url: e.platform && e.appSlug ? `/${e.platform}/apps/${e.appSlug}` : null,
    icon: null,
    priority: "low",
  }),

  // System
  system_scrape_complete: (e) => ({
    title: truncate(`Scrape completed: ${e.scraperType}`, 65),
    body: `${e.platform} ${e.scraperType} run finished successfully.`,
    url: null,
    icon: null,
    priority: "low",
  }),
  system_scrape_failed: (e) => ({
    title: truncate(`Scrape failed: ${e.scraperType}`, 65),
    body: truncate(e.errorMessage || "Unknown error", 200),
    url: null,
    icon: null,
    priority: "urgent",
  }),

  // Account
  account_member_joined: (e) => ({
    title: truncate(`${e.memberName || e.memberEmail} joined your team`, 65),
    body: `A new team member has joined your account.`,
    url: "/settings",
    icon: null,
    priority: "normal",
  }),
  account_limit_warning: (e) => ({
    title: truncate(`Approaching ${e.limitType} limit`, 65),
    body: `Using ${e.current} of ${e.max}. Consider upgrading.`,
    url: "/settings",
    icon: null,
    priority: "high",
  }),
  account_limit_reached: (e) => ({
    title: truncate(`${e.limitType} limit reached`, 65),
    body: `You've reached ${e.max}. Upgrade to add more.`,
    url: "/settings",
    icon: null,
    priority: "urgent",
  }),
};

export function buildNotificationContent(
  type: NotificationType,
  eventData: NotificationEventData
): NotificationContent {
  const builder = TEMPLATES[type];
  return builder(eventData);
}
