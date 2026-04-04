"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { timeAgo } from "@/lib/format-utils";

interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  url?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationGroupProps {
  category: string;
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
  onNavigate?: (url: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ranking: "Ranking Changes",
  competitor: "Competitor Updates",
  review: "New Reviews",
  keyword: "Keyword Changes",
  featured: "Featured Updates",
  system: "System",
  account: "Account",
};

const CATEGORY_COLORS: Record<string, string> = {
  ranking: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  competitor: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  keyword: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  featured: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  system: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  account: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

/**
 * Grouped notification display (PLA-692).
 * Collapses multiple notifications of the same category into a summary
 * with expandable details.
 */
export function NotificationGroup({
  category,
  notifications,
  onMarkRead,
  onNavigate,
}: NotificationGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const label = CATEGORY_LABELS[category] || category;
  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.system;

  if (notifications.length === 0) return null;

  // Single notification — show inline
  if (notifications.length === 1) {
    const n = notifications[0];
    return (
      <div
        className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
        onClick={() => {
          onMarkRead?.(n.id);
          if (n.url) onNavigate?.(n.url);
        }}
      >
        <div className="flex items-start gap-2">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
            {label}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${!n.isRead ? "font-medium" : ""}`}>{n.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.createdAt)}</span>
        </div>
      </div>
    );
  }

  // Multiple notifications — grouped with expand/collapse
  return (
    <div className="border-b">
      <button
        className={`w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left ${unreadCount > 0 ? "bg-primary/5" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
          {label}
        </span>
        <span className="text-sm font-medium">
          {notifications.length} {label.toLowerCase()}
        </span>
        {unreadCount > 0 && (
          <span className="ml-auto text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
            {unreadCount} new
          </span>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">
          {timeAgo(notifications[0].createdAt)}
        </span>
      </button>

      {expanded && (
        <div className="pl-6 border-l-2 border-muted ml-4">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-2 hover:bg-muted/30 cursor-pointer ${!n.isRead ? "font-medium" : ""}`}
              onClick={() => {
                onMarkRead?.(n.id);
                if (n.url) onNavigate?.(n.url);
              }}
            >
              <p className="text-xs">{n.title}</p>
              <p className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Group a flat notification list by category.
 */
export function groupNotificationsByCategory(
  notifications: Notification[]
): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();
  for (const n of notifications) {
    const cat = n.category || "system";
    const list = groups.get(cat) || [];
    list.push(n);
    groups.set(cat, list);
  }
  return groups;
}
