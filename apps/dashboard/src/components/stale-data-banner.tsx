"use client";

import { AlertTriangle } from "lucide-react";
import { timeAgo } from "@/lib/format-utils";

/**
 * Warning banner shown on app detail pages when data is older than 3 days.
 * Critical alert when data is older than 7 days.
 */
export function StaleDataBanner({ lastScrapedAt }: { lastScrapedAt: string | null | undefined }) {
  if (!lastScrapedAt) return null;

  const hours = (Date.now() - new Date(lastScrapedAt).getTime()) / (1000 * 60 * 60);

  if (hours < 72) return null; // Less than 3 days — don't show

  const isCritical = hours > 168; // > 7 days

  return (
    <div className={`rounded-lg border px-4 py-2.5 text-sm flex items-center gap-2 mb-4 ${
      isCritical
        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
    }`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {isCritical
          ? `Data is stale — last updated ${timeAgo(lastScrapedAt)}. This app may need a manual refresh.`
          : `Data may be outdated — last updated ${timeAgo(lastScrapedAt)}.`}
      </span>
    </div>
  );
}
