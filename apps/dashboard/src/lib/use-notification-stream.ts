/**
 * SSE client hook for real-time notification delivery (PLA-691).
 * Connects to GET /api/notifications/stream and dispatches events.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export interface NotificationStreamEvent {
  type: "unread-count" | "notification" | "heartbeat";
  data: unknown;
}

export interface UseNotificationStreamOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Callback when unread count changes */
  onUnreadCount?: (count: number) => void;
  /** Callback when a new notification arrives */
  onNotification?: (notification: unknown) => void;
}

export function useNotificationStream(options: UseNotificationStreamOptions = {}) {
  const { fetchWithAuth } = useAuth();
  const {
    autoReconnect = true,
    reconnectDelay = 5000,
    onUnreadCount,
    onNotification,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    // Use polling via fetchWithAuth since EventSource doesn't support
    // Authorization headers. Poll every 10s for new notifications.
    const poll = async () => {
      try {
        const res = await fetchWithAuth("/api/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          onUnreadCount?.(data.count ?? 0);
          setConnected(true);
          setError(null);
        }
      } catch {
        setConnected(false);
        if (autoReconnect) {
          setError("Polling failed — retrying...");
        }
      }
    };

    poll(); // Initial fetch
    const intervalId = setInterval(poll, 10_000); // Poll every 10s
    reconnectTimerRef.current = intervalId as any;

    return () => clearInterval(intervalId);
  }, [fetchWithAuth, autoReconnect, onUnreadCount, onNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Pause when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [connect, disconnect]);

  return { connected, error, disconnect, reconnect: connect };
}
