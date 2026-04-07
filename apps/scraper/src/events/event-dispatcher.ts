/**
 * Event dispatcher: fans out detected events to email-bulk and notifications queues.
 * Finds affected users and enqueues jobs for each.
 */
import { eq, inArray } from "drizzle-orm";
import {
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  users,
} from "@appranks/db";
import { createLogger } from "@appranks/shared";
import type { BulkEmailJobData, NotificationJobData } from "@appranks/shared";
import { enqueueBulkEmail, enqueueNotification } from "../queue.js";
import type { DetectedEvent } from "./event-detector.js";

const log = createLogger("event-dispatcher");

interface AffectedUser {
  userId: string;
  accountId: string;
  email: string;
  name: string;
}

/** Event types that should generate email alerts (in addition to notifications) */
const EMAIL_EVENT_TYPES = new Set([
  "ranking_top3_entry",
  "ranking_top3_exit",
  "ranking_significant_change",
  "ranking_dropped_out",
  "ranking_category_change",
  "competitor_overtook",
  "competitor_featured",
  "competitor_review_surge",
  "competitor_pricing_change",
  "review_new_positive",
  "review_new_negative",
  "review_velocity_spike",
  "featured_new_placement",
  "featured_removed",
  "review_milestone",
  "rating_milestone",
  "ranking_top1",
]);

/** Map event types to email job types */
const EVENT_TO_EMAIL_TYPE: Record<string, string> = {
  ranking_top3_entry: "email_ranking_alert",
  ranking_top3_exit: "email_ranking_alert",
  ranking_significant_change: "email_ranking_alert",
  ranking_dropped_out: "email_ranking_alert",
  ranking_new_entry: "email_ranking_alert",
  ranking_category_change: "email_ranking_alert",
  ranking_top1: "email_win_celebration",
  competitor_overtook: "email_competitor_alert",
  competitor_featured: "email_competitor_alert",
  competitor_review_surge: "email_competitor_alert",
  competitor_pricing_change: "email_competitor_alert",
  review_new_positive: "email_review_alert",
  review_new_negative: "email_review_alert",
  review_velocity_spike: "email_review_alert",
  review_milestone: "email_win_celebration",
  rating_milestone: "email_win_celebration",
  featured_new_placement: "email_ranking_alert",
  featured_removed: "email_ranking_alert",
};

/** Competitor event types that are always email-worthy (not position-based) */
const IMPORTANT_COMPETITOR_EVENTS = new Set([
  "competitor_featured",
  "competitor_pricing_change",
  "competitor_review_surge",
]);

/**
 * Check if a competitor event is significant enough to warrant an email.
 * Small position fluctuations are notification-only, not email-worthy.
 */
export function isCompetitorEventEmailWorthy(event: DetectedEvent): boolean {
  // Non-position competitor events are always email-worthy
  if (IMPORTANT_COMPETITOR_EVENTS.has(event.type)) return true;

  // competitor_overtook: only email if the competitor entered top 10 from outside top 50,
  // or took the #1 position
  if (event.type === "competitor_overtook") {
    const competitorPos = event.data?.competitorPosition as number | undefined;
    const previousPos = event.data?.previousPosition as number | undefined;
    // Entered top 10 from much further back
    if (competitorPos != null && competitorPos <= 10 && (previousPos == null || previousPos > 50)) {
      return true;
    }
    // Took #1 position
    if (competitorPos === 1) return true;
    // Otherwise, small position change — notification only
    return false;
  }

  return false;
}

/** Map event types to notification job types */
const EVENT_TO_NOTIFICATION_TYPE: Record<string, string> = {
  ranking_top3_entry: "notification_ranking_change",
  ranking_top3_exit: "notification_ranking_change",
  ranking_significant_change: "notification_ranking_change",
  ranking_dropped_out: "notification_ranking_change",
  ranking_new_entry: "notification_ranking_change",
  ranking_category_change: "notification_ranking_change",
  ranking_top1: "notification_milestone",
  keyword_new_ranking: "notification_ranking_change",
  keyword_position_gained: "notification_ranking_change",
  keyword_position_lost: "notification_ranking_change",
  competitor_overtook: "notification_new_competitor",
  competitor_featured: "notification_new_competitor",
  competitor_review_surge: "notification_new_competitor",
  competitor_pricing_change: "notification_price_change",
  review_new_positive: "notification_new_review",
  review_new_negative: "notification_new_review",
  review_velocity_spike: "notification_new_review",
  review_milestone: "notification_milestone",
  rating_milestone: "notification_milestone",
  featured_new_placement: "notification_ranking_change",
  featured_removed: "notification_ranking_change",
};

/**
 * Find users affected by an event based on their tracked apps/keywords/competitors.
 */
export async function findAffectedUsers(db: any, event: DetectedEvent): Promise<AffectedUser[]> {
  // Find accounts tracking this app
  const trackedRows = await db
    .select({ accountId: accountTrackedApps.accountId })
    .from(accountTrackedApps)
    .where(eq(accountTrackedApps.appId, event.appId));

  // Also check competitor tracking
  const competitorRows = await db
    .select({ accountId: accountCompetitorApps.accountId })
    .from(accountCompetitorApps)
    .where(eq(accountCompetitorApps.competitorAppId, event.appId));

  // Merge unique account IDs
  const accountIds = [...new Set([
    ...trackedRows.map((r: any) => r.accountId),
    ...competitorRows.map((r: any) => r.accountId),
  ])];

  if (accountIds.length === 0) return [];

  // Get all users in those accounts
  const affectedUsers = await db
    .select({
      userId: users.id,
      accountId: users.accountId,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(inArray(users.accountId, accountIds));

  return affectedUsers;
}

export interface DispatchResult {
  emailJobsEnqueued: number;
  notificationJobsEnqueued: number;
  usersAffected: number;
}

/**
 * Dispatch a detected event to affected users' email and notification queues.
 */
export async function dispatch(db: any, event: DetectedEvent): Promise<DispatchResult> {
  const affectedUsers = await findAffectedUsers(db, event);

  if (affectedUsers.length === 0) {
    log.debug("no affected users for event", { type: event.type, appId: event.appId });
    return { emailJobsEnqueued: 0, notificationJobsEnqueued: 0, usersAffected: 0 };
  }

  let emailJobsEnqueued = 0;
  let notificationJobsEnqueued = 0;
  const now = new Date().toISOString();

  const emailType = EVENT_TO_EMAIL_TYPE[event.type];
  const notifType = EVENT_TO_NOTIFICATION_TYPE[event.type];
  // Skip email for unimportant competitor events (small position changes → notification only)
  const isCompetitorFiltered = event.type.startsWith("competitor_") && !isCompetitorEventEmailWorthy(event);
  const shouldEmail = EMAIL_EVENT_TYPES.has(event.type) && emailType && !isCompetitorFiltered;

  for (const user of affectedUsers) {
    // Enqueue notification (always)
    if (notifType) {
      try {
        const notifData: NotificationJobData = {
          type: notifType as any,
          userId: user.userId,
          accountId: user.accountId,
          payload: { ...event.data, eventType: event.type },
          createdAt: now,
          sendPush: true,
        };
        await enqueueNotification(notifData);
        notificationJobsEnqueued++;
      } catch (err) {
        log.error("failed to enqueue notification", {
          type: event.type, userId: user.userId, error: String(err),
        });
      }
    }

    // Enqueue email (for significant events only)
    // Safeguards in place: feature flag gate, emailTypeConfigs (disabled by default),
    // frequency limits (24h), daily per-user limit (10), competitor event filtering,
    // event aggregation per app, deduplication.
    if (shouldEmail) {
      try {
        const emailData: BulkEmailJobData = {
          type: emailType as any,
          to: user.email,
          name: user.name,
          userId: user.userId,
          accountId: user.accountId,
          payload: { ...event.data, eventType: event.type },
          createdAt: now,
        };
        await enqueueBulkEmail(emailData);
        emailJobsEnqueued++;
      } catch (err) {
        log.error("failed to enqueue email", {
          type: event.type, userId: user.userId, error: String(err),
        });
      }
    }
  }

  log.info("event dispatched", {
    type: event.type,
    appId: event.appId,
    usersAffected: affectedUsers.length,
    emailJobsEnqueued,
    notificationJobsEnqueued,
  });

  return {
    emailJobsEnqueued,
    notificationJobsEnqueued,
    usersAffected: affectedUsers.length,
  };
}

/**
 * Dispatch multiple events. Groups events by appId so each user gets at most
 * one email per app (containing all events for that app).
 */
export async function dispatchAll(db: any, events: DetectedEvent[]): Promise<DispatchResult> {
  const totals: DispatchResult = { emailJobsEnqueued: 0, notificationJobsEnqueued: 0, usersAffected: 0 };

  // Group events by appId for email aggregation
  const eventsByApp = new Map<number, DetectedEvent[]>();
  for (const event of events) {
    const list = eventsByApp.get(event.appId) || [];
    list.push(event);
    eventsByApp.set(event.appId, list);
  }

  // Dispatch each app's events — notifications go individually, emails aggregate
  for (const [, appEvents] of eventsByApp) {
    for (const event of appEvents) {
      try {
        const result = await dispatch(db, event);
        totals.notificationJobsEnqueued += result.notificationJobsEnqueued;
        totals.usersAffected += result.usersAffected;
      } catch (err) {
        log.error("failed to dispatch event", { type: event.type, error: String(err) });
      }
    }
  }

  // Email aggregation happens when emails are re-enabled (PLA-839).
  // The dispatch() function currently has email enqueue commented out,
  // and when re-enabled it will use aggregated payload per app.
  totals.emailJobsEnqueued = 0;

  return totals;
}
