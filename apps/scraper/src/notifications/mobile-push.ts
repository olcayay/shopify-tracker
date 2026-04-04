/**
 * Mobile push notification support (PLA-702).
 *
 * Infrastructure for Firebase Cloud Messaging (FCM) and Apple Push
 * Notification Service (APNs). Requires external service credentials.
 *
 * Setup:
 * - Firebase: Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
 * - APNs: Set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("notification:mobile-push");

export interface MobilePushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  imageUrl?: string;
}

export interface MobilePushResult {
  success: boolean;
  provider: "fcm" | "apns";
  token: string;
  error?: string;
}

/**
 * Check if Firebase Cloud Messaging is configured.
 */
export function isFcmConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
}

/**
 * Check if Apple Push Notification Service is configured.
 */
export function isApnsConfigured(): boolean {
  return !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_PRIVATE_KEY &&
    process.env.APNS_BUNDLE_ID
  );
}

/**
 * Send push notification via Firebase Cloud Messaging.
 * Requires firebase-admin package (optional dependency).
 */
export async function sendFcmPush(
  deviceToken: string,
  payload: MobilePushPayload
): Promise<MobilePushResult> {
  if (!isFcmConfigured()) {
    return { success: false, provider: "fcm", token: deviceToken, error: "FCM not configured" };
  }

  try {
    // Dynamic import — firebase-admin is optional
    // @ts-expect-error — optional peer dependency
    const admin = await import("firebase-admin").catch(() => null);
    if (!admin) {
      return { success: false, provider: "fcm", token: deviceToken, error: "firebase-admin not installed" };
    }

    // Initialize if not already done
    if (admin.apps?.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }

    await admin.messaging().send({
      token: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        notification: { sound: payload.sound || "default" },
      },
      apns: {
        payload: {
          aps: {
            badge: payload.badge,
            sound: payload.sound || "default",
          },
        },
      },
    });

    log.info("FCM push sent", { token: deviceToken.slice(0, 20) + "..." });
    return { success: true, provider: "fcm", token: deviceToken };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error("FCM push failed", { error, token: deviceToken.slice(0, 20) + "..." });
    return { success: false, provider: "fcm", token: deviceToken, error };
  }
}

/**
 * Get mobile push configuration status.
 */
export function getMobilePushStatus(): {
  fcm: { configured: boolean; projectId?: string };
  apns: { configured: boolean; bundleId?: string };
} {
  return {
    fcm: {
      configured: isFcmConfigured(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    },
    apns: {
      configured: isApnsConfigured(),
      bundleId: process.env.APNS_BUNDLE_ID,
    },
  };
}
