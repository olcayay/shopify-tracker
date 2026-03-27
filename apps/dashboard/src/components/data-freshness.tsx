"use client";

import { timeAgo } from "@/lib/format-utils";
import { Clock } from "lucide-react";

/**
 * Displays a "Data from Xh ago" indicator with color-coded freshness.
 * Green: <24h, Orange: 24-72h, Red: >72h.
 */
export function DataFreshness({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return null;

  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  const colorClass =
    hours < 24
      ? "text-muted-foreground"
      : hours < 72
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
      <Clock className="h-3 w-3" />
      Data from {timeAgo(dateStr)}
    </span>
  );
}
