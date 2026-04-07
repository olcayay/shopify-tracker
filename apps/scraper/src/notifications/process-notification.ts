/**
 * Core processing logic for notification jobs.
 * Creates in-app notifications and optionally sends web push.
 */
import type { Job } from "bullmq";
import type { NotificationJobData } from "@appranks/shared";
import {
  emitNotification,
  type NotificationStore,
  type NotificationRecipient,
  type NotificationRecord,
} from "@appranks/shared";
import type { NotificationType } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  notifications,
  notificationTypeConfigs,
  userNotificationPreferences,
  notificationDeliveryLog,
  pushSubscriptions,
  accountTrackedApps,
  accountTrackedKeywords,
  users,
} from "@appranks/db";

const log = createLogger("notification-worker");

/** Create a NotificationStore implementation backed by Drizzle */
export function createNotificationStore(db: any): NotificationStore {
  return {
    async findUsersTrackingApp(appId: number): Promise<NotificationRecipient[]> {
      // Find accounts tracking this app, then all users in those accounts
      const trackedAccounts = await db
        .select({ accountId: accountTrackedApps.accountId })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.appId, appId));

      if (trackedAccounts.length === 0) return [];

      const accountIds = trackedAccounts.map((r: any) => r.accountId);
      const accountUsers = await db
        .select({ userId: users.id, accountId: users.accountId })
        .from(users)
        .where(inArray(users.accountId, accountIds));

      return accountUsers;
    },

    async findUsersTrackingKeyword(keywordId: number): Promise<NotificationRecipient[]> {
      const trackedAccounts = await db
        .select({ accountId: accountTrackedKeywords.accountId })
        .from(accountTrackedKeywords)
        .where(eq(accountTrackedKeywords.keywordId, keywordId));

      if (trackedAccounts.length === 0) return [];

      const accountIds = trackedAccounts.map((r: any) => r.accountId);
      const accountUsers = await db
        .select({ userId: users.id, accountId: users.accountId })
        .from(users)
        .where(inArray(users.accountId, accountIds));

      return accountUsers;
    },

    async isTypeEnabled(type: string): Promise<boolean> {
      const [config] = await db
        .select({ inAppEnabled: notificationTypeConfigs.inAppEnabled })
        .from(notificationTypeConfigs)
        .where(eq(notificationTypeConfigs.notificationType, type));
      // Default to enabled if no config row exists
      return config ? config.inAppEnabled : true;
    },

    async isUserOptedIn(userId: string, type: string): Promise<boolean> {
      const [pref] = await db
        .select({ inAppEnabled: userNotificationPreferences.inAppEnabled })
        .from(userNotificationPreferences)
        .where(
          and(
            eq(userNotificationPreferences.userId, userId),
            eq(userNotificationPreferences.notificationType, type)
          )
        );
      // Default to opted in if no preference row exists
      return pref ? (pref.inAppEnabled ?? true) : true;
    },

    async isDuplicate(userId: string, type: string, dedupKey: string, withinHours: number): Promise<boolean> {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            sql`${notifications.eventData}->>'dedupKey' = ${dedupKey}`,
            sql`${notifications.createdAt} > NOW() - make_interval(hours => ${withinHours})`
          )
        );
      return (row?.count ?? 0) > 0;
    },

    async countRecent(userId: string, withinHours: number): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            sql`${notifications.createdAt} > NOW() - make_interval(hours => ${withinHours})`
          )
        );
      return row?.count ?? 0;
    },

    async save(record: NotificationRecord): Promise<string> {
      const [result] = await db
        .insert(notifications)
        .values({
          userId: record.userId,
          accountId: record.accountId,
          type: record.type,
          category: record.category,
          title: record.title,
          body: record.body,
          url: record.url,
          icon: record.icon,
          priority: record.priority,
          eventData: { ...record.eventData, dedupKey: buildStoredDedupKey(record) },
          batchId: record.batchId,
        })
        .returning({ id: notifications.id });
      return result.id;
    },
  };
}

function buildStoredDedupKey(record: NotificationRecord): string | null {
  const data = record.eventData;
  const parts: string[] = [record.type];
  if (data.appSlug) parts.push(data.appSlug as string);
  if (data.competitorSlug) parts.push(data.competitorSlug as string);
  if (data.keywordSlug) parts.push(data.keywordSlug as string);
  if (data.categorySlug) parts.push(data.categorySlug as string);
  return parts.length > 1 ? parts.join(":") : null;
}

/**
 * Try to send web push for a notification.
 * Returns true if push was sent to at least one subscription.
 */
async function trySendPush(
  db: any,
  notificationId: string,
  userId: string,
  payload: { title: string; body: string; url?: string | null; icon?: string | null }
): Promise<boolean> {
  // Check if web push is configured
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return false;
  }

  // Get active subscriptions
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      )
    );

  if (subs.length === 0) return false;

  let anySent = false;

  try {
    // Dynamic import — web-push is an optional peer dependency
    // @ts-expect-error — optional peer dependency, may not be installed
    const webpush: any = await import("web-push").catch(() => null);
    if (!webpush) return false;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || undefined,
      icon: payload.icon || undefined,
      notificationId,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload,
          { TTL: 86400 }
        );

        await db.update(pushSubscriptions)
          .set({ lastPushAt: new Date(), failureCount: 0 })
          .where(eq(pushSubscriptions.id, sub.id));

        // Log delivery
        await db.insert(notificationDeliveryLog).values({
          notificationId,
          channel: "push",
          pushSubscriptionId: sub.id,
          status: "sent",
        });

        anySent = true;
      } catch (err: any) {
        // Handle expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          const newCount = (sub.failureCount || 0) + 1;
          await db.update(pushSubscriptions)
            .set({ failureCount: newCount, isActive: newCount < 5 })
            .where(eq(pushSubscriptions.id, sub.id));
        }

        // Log failed delivery
        await db.insert(notificationDeliveryLog).values({
          notificationId,
          channel: "push",
          pushSubscriptionId: sub.id,
          status: "failed",
          statusCode: err.statusCode,
          errorMessage: String(err),
        });
      }
    }
  } catch (err) {
    log.error("web-push module error", { error: String(err) });
  }

  return anySent;
}

export async function processNotification(
  job: Job<NotificationJobData>,
  db: any
): Promise<void> {
  const { type, userId, accountId, payload, sendPush } = job.data;
  log.info("processing notification", { jobId: job.id, type, userId });

  const store = createNotificationStore(db);

  // Emit notification via the shared engine
  const result = await emitNotification(
    store,
    type as NotificationType,
    { ...payload } as any,
    [{ userId, accountId }]
  );

  log.info("notification emitted", {
    jobId: job.id,
    type,
    sent: result.sent,
    skipped: result.skipped,
    errors: result.errors,
  });

  // If notification was saved and push is requested, try to send push
  if (result.sent > 0 && sendPush !== false) {
    // Get the most recent notification for this user+type to get its ID
    const [latest] = await db
      .select({ id: notifications.id, title: notifications.title, body: notifications.body, url: notifications.url, icon: notifications.icon })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, type)
        )
      )
      .orderBy(sql`${notifications.createdAt} DESC`)
      .limit(1);

    if (latest) {
      const pushSent = await trySendPush(db, latest.id, userId, {
        title: latest.title,
        body: latest.body,
        url: latest.url,
        icon: latest.icon,
      });

      if (pushSent) {
        await db.update(notifications)
          .set({ pushSent: true, pushSentAt: new Date() })
          .where(eq(notifications.id, latest.id));
      }
    }
  }
}
