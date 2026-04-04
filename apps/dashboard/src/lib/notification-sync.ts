/**
 * Cross-tab notification sync via BroadcastChannel (PLA-697).
 *
 * When a notification is read/archived in one tab, all other tabs
 * are notified to update their UI without re-fetching from the server.
 */

const CHANNEL_NAME = "appranks-notifications";

export interface NotificationSyncMessage {
  type: "read" | "read-all" | "archive" | "dismiss" | "new" | "unread-count";
  notificationId?: string;
  count?: number;
  timestamp: number;
}

let channel: BroadcastChannel | null = null;
const listeners = new Set<(msg: NotificationSyncMessage) => void>();

/**
 * Initialize the sync channel.
 */
export function initNotificationSync(): void {
  if (typeof window === "undefined") return;
  if (!("BroadcastChannel" in window)) return;
  if (channel) return;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<NotificationSyncMessage>) => {
    for (const listener of listeners) {
      listener(event.data);
    }
  };
}

/**
 * Broadcast a notification state change to other tabs.
 */
export function broadcastNotificationChange(msg: Omit<NotificationSyncMessage, "timestamp">): void {
  if (!channel) initNotificationSync();
  channel?.postMessage({ ...msg, timestamp: Date.now() });
}

/**
 * Subscribe to notification changes from other tabs.
 * Returns an unsubscribe function.
 */
export function onNotificationChange(
  callback: (msg: NotificationSyncMessage) => void
): () => void {
  if (!channel) initNotificationSync();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Cleanup the sync channel.
 */
export function closeNotificationSync(): void {
  channel?.close();
  channel = null;
  listeners.clear();
}
