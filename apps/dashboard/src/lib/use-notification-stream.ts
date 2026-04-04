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
  const { accessToken } = useAuth();
  const {
    autoReconnect = true,
    reconnectDelay = 5000,
    onUnreadCount,
    onNotification,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!accessToken) return;
    if (typeof window === "undefined") return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const url = `${apiUrl}/api/notifications/stream?token=${encodeURIComponent(accessToken)}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError(null);
      };

      es.addEventListener("unread-count", (event) => {
        try {
          const data = JSON.parse(event.data);
          onUnreadCount?.(data.count ?? 0);
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("notification", (event) => {
        try {
          const data = JSON.parse(event.data);
          onNotification?.(data);
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        if (autoReconnect) {
          setError("Disconnected — reconnecting...");
          reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
        } else {
          setError("Connection lost");
        }
      };
    } catch (err) {
      setError(String(err));
    }
  }, [accessToken, autoReconnect, reconnectDelay, onUnreadCount, onNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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
