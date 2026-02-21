"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface HeatmapSighting {
  slug: string;
  name: string;
  seenDate: string;
  timesSeenInDay: number;
  iconUrl?: string;
}

interface AdHeatmapProps {
  sightings: HeatmapSighting[];
  linkPrefix?: string;
  trackedSlugs?: string[];
  competitorSlugs?: string[];
  /** When set, show at most this many rows initially with a "Show all" toggle */
  initialVisible?: number;
}

function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`;
}

function intensityClass(count: number): string {
  if (count === 0) return "bg-muted/40";
  if (count === 1) return "bg-primary/25";
  if (count === 2) return "bg-primary/50";
  return "bg-primary/80";
}

export function AdHeatmap({
  sightings: adSightings,
  linkPrefix = "/apps/",
  trackedSlugs = [],
  competitorSlugs = [],
  initialVisible,
}: AdHeatmapProps) {
  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(() => new Set(competitorSlugs), [competitorSlugs]);
  const [expanded, setExpanded] = useState(false);

  const { items, dates, matrix } = useMemo(() => {
    const dates = buildDateRange(30);

    // Build lookup: slug -> { date -> timesSeenInDay }
    const itemMap = new Map<
      string,
      { slug: string; name: string; iconUrl?: string; total: number; sightings: Map<string, number> }
    >();

    for (const s of adSightings) {
      let entry = itemMap.get(s.slug);
      if (!entry) {
        entry = {
          slug: s.slug,
          name: s.name,
          iconUrl: s.iconUrl,
          total: 0,
          sightings: new Map(),
        };
        itemMap.set(s.slug, entry);
      }
      entry.total += s.timesSeenInDay;
      const existing = entry.sightings.get(s.seenDate) ?? 0;
      entry.sightings.set(s.seenDate, existing + s.timesSeenInDay);
    }

    // Sort by total activity (most active first)
    const items = [...itemMap.values()].sort((a, b) => b.total - a.total);

    // Build matrix: items × dates → count
    const matrix = items.map((item) =>
      dates.map((date) => item.sightings.get(date) ?? 0)
    );

    return { items, dates, matrix };
  }, [adSightings]);

  if (items.length === 0) return null;

  // Pagination: show limited rows when initialVisible is set and not expanded
  const needsPagination = initialVisible != null && items.length > initialVisible;
  const visibleCount = needsPagination && !expanded ? initialVisible : items.length;
  const visibleItems = items.slice(0, visibleCount);
  const visibleMatrix = matrix.slice(0, visibleCount);

  // Show date labels every ~5 days
  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Date headers */}
        <div className="flex items-end gap-0 mb-1">
          <div className="w-[200px] shrink-0" />
          <div className="flex-1 flex gap-[2px]">
            {dates.map((date, i) => (
              <div
                key={date}
                className="flex-1 min-w-[14px] text-center"
              >
                {i % labelEvery === 0 ? (
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {formatShortDate(date)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {visibleItems.map((item, itemIdx) => {
          const isTracked = trackedSet.has(item.slug);
          const isCompetitor = competitorSet.has(item.slug);
          return (
            <div
              key={item.slug}
              className={`flex items-center gap-0 py-[2px] ${
                isTracked
                  ? "bg-emerald-500/5"
                  : isCompetitor
                    ? "bg-amber-500/5"
                    : ""
              }`}
            >
              {/* Label */}
              <div className="w-[200px] shrink-0 pr-2 flex items-center gap-1.5 min-w-0">
                {item.iconUrl && (
                  <img src={item.iconUrl} alt="" className="h-4 w-4 rounded shrink-0" />
                )}
                <Link
                  href={`${linkPrefix}${item.slug}`}
                  className="text-xs text-primary hover:underline truncate"
                  title={item.name}
                >
                  {item.name}
                </Link>
                {isTracked && (
                  <Badge className="text-[8px] px-1 py-0 h-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50 shrink-0">
                    T
                  </Badge>
                )}
                {isCompetitor && (
                  <Badge className="text-[8px] px-1 py-0 h-3 bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50 shrink-0">
                    C
                  </Badge>
                )}
              </div>

              {/* Heatmap cells */}
              <div className="flex-1 flex gap-[2px]">
                {visibleMatrix[itemIdx].map((count, dateIdx) => (
                  <div
                    key={dates[dateIdx]}
                    className={`flex-1 min-w-[14px] h-[14px] rounded-[2px] ${intensityClass(count)}`}
                    title={
                      count > 0
                        ? `${item.name} — ${formatShortDate(dates[dateIdx])} — seen ${count} time${count !== 1 ? "s" : ""}`
                        : `${formatShortDate(dates[dateIdx])} — no ad`
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Show more/less toggle */}
        {needsPagination && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {expanded
              ? "Show less"
              : `Show all ${items.length} apps`}
          </button>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[2px] bg-muted/40" />
          <div className="w-3 h-3 rounded-[2px] bg-primary/25" />
          <div className="w-3 h-3 rounded-[2px] bg-primary/50" />
          <div className="w-3 h-3 rounded-[2px] bg-primary/80" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
