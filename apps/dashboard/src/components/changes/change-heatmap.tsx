"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildDateRange, formatShortDate, formatDateRangeLabel, intensityClass } from "@/lib/heatmap-utils";
import type { ChangeEntry } from "./unified-change-log";
import { getFieldLabels } from "@appranks/shared";

interface ChangeHeatmapProps {
  entries: ChangeEntry[];
  platform?: string;
}

interface AppRow {
  slug: string;
  name: string;
  isSelf: boolean;
  total: number;
  /** date -> { count, fields[] } */
  days: Map<string, { count: number; fields: string[] }>;
}

export function ChangeHeatmap({ entries, platform }: ChangeHeatmapProps) {
  const pathname = usePathname();
  const appLinkPrefix = pathname.includes("/v2/")
    ? `/${platform || "shopify"}/apps/v2`
    : `/${platform || "shopify"}/apps`;
  const [dayOffset, setDayOffset] = useState(0);

  const fieldLabels = useMemo(
    () => getFieldLabels(platform || "shopify"),
    [platform]
  );

  function getFieldLabel(field: string): string {
    if (field in fieldLabels) {
      return fieldLabels[field as keyof typeof fieldLabels];
    }
    return field;
  }

  const { rows, dates } = useMemo(() => {
    const dates = buildDateRange(30, dayOffset);
    const dateSet = new Set(dates);

    const appMap = new Map<string, AppRow>();

    for (const e of entries) {
      const date = e.detectedAt.slice(0, 10);
      if (!dateSet.has(date)) continue;

      let row = appMap.get(e.appSlug);
      if (!row) {
        row = { slug: e.appSlug, name: e.appName, isSelf: e.isSelf, total: 0, days: new Map() };
        appMap.set(e.appSlug, row);
      }
      row.total++;
      let day = row.days.get(date);
      if (!day) {
        day = { count: 0, fields: [] };
        row.days.set(date, day);
      }
      day.count++;
      const label = getFieldLabel(e.field);
      if (!day.fields.includes(label)) day.fields.push(label);
    }

    const rows = [...appMap.values()].sort((a, b) => b.total - a.total);
    return { rows, dates };
  }, [entries, dayOffset, fieldLabels]);

  // Compute earliest entry date to bound the "Older" button
  const earliestDate = useMemo(() => {
    if (entries.length === 0) return null;
    let min = entries[0].detectedAt.slice(0, 10);
    for (const e of entries) {
      const d = e.detectedAt.slice(0, 10);
      if (d < min) min = d;
    }
    return min;
  }, [entries]);

  // Disable "Older" when the current window already starts before the earliest data
  const canGoOlder = earliestDate !== null && dates[0] > earliestDate;

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
  const dateRangeLabel = formatDateRangeLabel(dates);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Time navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setDayOffset((o) => o + 30)}
            disabled={!canGoOlder}
            className="flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-3 w-3" /> Older
          </button>
          <span className="text-xs text-muted-foreground">{dateRangeLabel}</span>
          <button
            onClick={() => setDayOffset((o) => Math.max(0, o - 30))}
            disabled={dayOffset === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Next period"
          >
            Newer <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Date headers */}
        <div className="flex items-end gap-0 mb-1">
          <div className="w-[200px] shrink-0" />
          <div className="flex-1 flex gap-[2px]">
            {dates.map((date, i) => (
              <div key={date} className="flex-1 min-w-[14px] text-center">
                {i % labelEvery === 0 ? (
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {formatShortDate(date)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No changes detected in this period.</p>
        )}

        {/* Rows */}
        {rows.map((row) => (
          <div
            key={row.slug}
            className={`flex items-center gap-0 py-[2px] ${row.isSelf ? "bg-emerald-500/5" : ""}`}
          >
            <div className="w-[200px] shrink-0 pr-2 flex items-center gap-1.5 min-w-0">
              <Link
                href={`${appLinkPrefix}/${row.slug}`}
                className="text-xs text-primary hover:underline truncate"
                title={row.name}
              >
                {row.name}
              </Link>
              {row.isSelf && (
                <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 shrink-0">
                  You
                </span>
              )}
            </div>

            <div className="flex-1 flex gap-[2px]">
              {dates.map((date) => {
                const day = row.days.get(date);
                const count = day?.count ?? 0;
                const tooltip = count > 0
                  ? `${row.name} — ${formatShortDate(date)} — ${count} change${count !== 1 ? "s" : ""}: ${day!.fields.join(", ")}`
                  : `${formatShortDate(date)} — no changes`;
                return (
                  <div
                    key={date}
                    className={`flex-1 min-w-[14px] h-[14px] rounded-[2px] ${intensityClass(count)}`}
                    title={tooltip}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>No changes</span>
          <div className="w-3 h-3 rounded-[2px] bg-muted/40" />
          <div className="w-3 h-3 rounded-[2px] bg-primary/60" />
          <span>Changes</span>
        </div>
      </div>
    </div>
  );
}
