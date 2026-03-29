/**
 * Web Push notification infrastructure (PLA-349).
 *
 * Setup:
 * 1. Generate VAPID keys: npx web-push generate-vapid-keys
 * 2. Set env vars:
 *    VAPID_PUBLIC_KEY=BJ...
 *    VAPID_PRIVATE_KEY=nP...
 *    VAPID_SUBJECT=mailto:push@appranks.io
 */
import { eq, and } from "drizzle-orm";
import { pushSubscriptions, notifications } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("web-push");

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  notificationId?: string;
}

/**
 * Check if Web Push is configured.
 */
export function isWebPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

/**
 * Get VAPID public key for client-side subscription.
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Send push notification to a user's subscriptions.
 */
export async function sendPushToUser(
  db: any,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!isWebPushConfigured()) {
    log.warn("Web Push not configured");
    return { sent: 0, failed: 0 };
  }

  // Get active subscriptions for user
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      )
    );

  if (subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  try {
    // Dynamic import — web-push is an optional dependency
    // @ts-expect-error — optional peer dependency, may not be installed
    const webpush: any = await import("web-push").catch(() => null);
    if (!webpush) {
      log.warn("web-push package not installed");
      return { sent: 0, failed: 0 };
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 86400 } // 24 hours
        );

        // Update last push timestamp
        await db
          .update(pushSubscriptions)
          .set({ lastPushAt: new Date(), failureCount: 0 })
          .where(eq(pushSubscriptions.id, sub.id));

        sent++;
      } catch (err: any) {
        failed++;

        // Handle expired/invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, sub.id));
          log.info("subscription expired, deactivated", { subId: sub.id });
        } else {
          // Increment failure count
          const newCount = (sub.failureCount || 0) + 1;
          await db
            .update(pushSubscriptions)
            .set({ failureCount: newCount, isActive: newCount < 5 })
            .where(eq(pushSubscriptions.id, sub.id));

          log.warn("push failed", { subId: sub.id, statusCode: err.statusCode, error: String(err) });
        }
      }
    }
  } catch (err) {
    log.error("web-push module error", { error: String(err) });
  }

  return { sent, failed };
}

/**
 * Register a push subscription for a user.
 */
export async function registerSubscription(
  db: any,
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<string> {
  const [result] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
      isActive: true,
    })
    .returning({ id: pushSubscriptions.id });

  return result.id;
}

/**
 * Unregister a push subscription.
 */
export async function unregisterSubscription(
  db: any,
  userId: string,
  endpoint: string
): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ isActive: false })
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}
