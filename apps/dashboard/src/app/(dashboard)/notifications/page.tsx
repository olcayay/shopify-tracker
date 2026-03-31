"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatShortDate } from "@/lib/format-utils";
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  icon: string | null;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "ranking", label: "Ranking" },
  { value: "competitor", label: "Competitor" },
  { value: "review", label: "Review" },
  { value: "keyword", label: "Keyword" },
  { value: "featured", label: "Featured" },
  { value: "system", label: "System" },
  { value: "account", label: "Account" },
];

export default function NotificationsPage() {
  const { fetchWithAuth } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: "30" });
      if (category) params.set("category", category);
      if (unreadOnly) params.set("unreadOnly", "true");
      if (append && cursor) params.set("cursor", cursor);

      const res = await fetchWithAuth(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setNotifications((prev) => [...prev, ...(data.notifications || [])]);
        } else {
          setNotifications(data.notifications || []);
        }
        setHasMore(data.hasMore || false);
        setCursor(data.nextCursor || null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchWithAuth, category, unreadOnly, cursor]);

  useEffect(() => {
    setCursor(null);
    fetchNotifications(false);
  }, [category, unreadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = async (id: string) => {
    await fetchWithAuth(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = async () => {
    await fetchWithAuth("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const archiveNotification = async (id: string) => {
    await fetchWithAuth(`/api/notifications/${id}/archive`, { method: "POST" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    normal: "bg-blue-500",
    low: "bg-gray-400 dark:bg-gray-500",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatShortDate(date.toISOString());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on ranking changes, competitor activity, and more.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === cat.value
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            }`}
          >
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ml-2 ${
            unreadOnly ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
          }`}
        >
          Unread only
        </button>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications to show</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                !n.isRead ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
              }`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${priorityColor[n.priority] || priorityColor.normal}`} />
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id);
                  if (n.url) window.location.href = n.url;
                }}
              >
                <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{n.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="p-1.5 rounded hover:bg-muted"
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => archiveNotification(n.id)}
                  className="p-1.5 rounded hover:bg-muted"
                  title="Archive"
                >
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(true)}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
