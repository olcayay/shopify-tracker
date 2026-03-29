/**
 * Notification engine: emit events, check eligibility, build content, save.
 *
 * This is a pure logic module — the database operations are injected via
 * a `NotificationStore` interface so it can be used from both scraper and API.
 */
import type { NotificationType, NotificationCategory } from "../notification-types.js";
import { NOTIFICATION_TYPES } from "../notification-types.js";
import { buildNotificationContent, type NotificationEventData } from "./templates.js";

export interface NotificationRecipient {
  userId: string;
  accountId: string;
}

export interface NotificationRecord {
  userId: string;
  accountId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  url: string | null;
  icon: string | null;
  priority: string;
  eventData: NotificationEventData;
  batchId?: string;
}

/** Abstraction for DB operations — implemented by caller */
export interface NotificationStore {
  /** Find users who track the given app (by appId) */
  findUsersTrackingApp(appId: number): Promise<NotificationRecipient[]>;
  /** Find users who track the given keyword (by keywordId) */
  findUsersTrackingKeyword(keywordId: number): Promise<NotificationRecipient[]>;
  /** Check if notification type is globally enabled */
  isTypeEnabled(type: NotificationType): Promise<boolean>;
  /** Check if user has opted in for this notification type (in-app) */
  isUserOptedIn(userId: string, type: NotificationType): Promise<boolean>;
  /** Check if duplicate notification exists (same user+type+dedup key within hours) */
  isDuplicate(userId: string, type: NotificationType, dedupKey: string, withinHours: number): Promise<boolean>;
  /** Count recent notifications for rate limiting */
  countRecent(userId: string, withinHours: number): Promise<number>;
  /** Save a notification record */
  save(record: NotificationRecord): Promise<string>;
}

const DEDUP_HOURS = 6;
const MAX_IN_APP_PER_HOUR = 50;

export interface EmitResult {
  sent: number;
  skipped: number;
  errors: number;
}

/**
 * Emit a notification event.
 * Finds affected users, checks eligibility, builds content, and saves.
 */
export async function emitNotification(
  store: NotificationStore,
  type: NotificationType,
  eventData: NotificationEventData,
  recipients?: NotificationRecipient[]
): Promise<EmitResult> {
  const typeMeta = NOTIFICATION_TYPES[type];
  if (!typeMeta) return { sent: 0, skipped: 0, errors: 0 };

  // Check if type is globally enabled
  const enabled = await store.isTypeEnabled(type);
  if (!enabled) return { sent: 0, skipped: 0, errors: 0 };

  // Find recipients if not provided
  let users = recipients || [];
  if (users.length === 0 && eventData.appId) {
    users = await store.findUsersTrackingApp(eventData.appId as number);
  }
  if (users.length === 0 && eventData.keywordId) {
    users = await store.findUsersTrackingKeyword(eventData.keywordId as number);
  }

  if (users.length === 0) return { sent: 0, skipped: 0, errors: 0 };

  // Build content once (same for all recipients)
  const content = buildNotificationContent(type, eventData);
  const dedupKey = buildDedupKey(type, eventData);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      // Check user preference
      const optedIn = await store.isUserOptedIn(user.userId, type);
      if (!optedIn) { skipped++; continue; }

      // Dedup check
      if (dedupKey) {
        const dup = await store.isDuplicate(user.userId, type, dedupKey, DEDUP_HOURS);
        if (dup) { skipped++; continue; }
      }

      // Rate limit check
      const recentCount = await store.countRecent(user.userId, 1);
      if (recentCount >= MAX_IN_APP_PER_HOUR) { skipped++; continue; }

      // Save notification
      await store.save({
        userId: user.userId,
        accountId: user.accountId,
        type,
        category: typeMeta.category,
        title: content.title,
        body: content.body,
        url: content.url,
        icon: content.icon,
        priority: content.priority,
        eventData,
      });

      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, skipped, errors };
}

function buildDedupKey(type: NotificationType, data: NotificationEventData): string | null {
  const parts: string[] = [type];
  if (data.appSlug) parts.push(data.appSlug);
  if (data.competitorSlug) parts.push(data.competitorSlug);
  if (data.keywordSlug) parts.push(data.keywordSlug);
  if (data.categorySlug) parts.push(data.categorySlug);
  return parts.length > 1 ? parts.join(":") : null;
}
