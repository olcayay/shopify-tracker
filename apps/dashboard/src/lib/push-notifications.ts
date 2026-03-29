/**
 * Push notification subscription manager.
 * Handles service worker registration, push subscription, and permission state.
 */

const SW_PATH = "/sw.js";

/** Check if push notifications are supported in this browser */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Get current notification permission state */
export function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** Register the service worker (idempotent) */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

/** Subscribe to push notifications */
export async function subscribeToPush(
  vapidPublicKey: string,
  apiUrl: string,
  accessToken: string
): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // Register SW if not already
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Send subscription to backend
    const response = await fetch(`${apiUrl}/api/notifications/push-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey("p256dh")!),
          auth: arrayBufferToBase64(subscription.getKey("auth")!),
        },
        userAgent: navigator.userAgent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

/** Unsubscribe from push notifications */
export async function unsubscribeFromPush(
  apiUrl: string,
  accessToken: string
): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) return true;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Remove from backend
    await fetch(`${apiUrl}/api/notifications/push-subscription`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    return true;
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
    return false;
  }
}

/** Check if user is currently subscribed to push */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
