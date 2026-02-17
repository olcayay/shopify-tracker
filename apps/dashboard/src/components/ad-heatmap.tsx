"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface AdSighting {
  appSlug: string;
  appName: string;
  seenDate: string;
  timesSeenInDay: number;
}

interface AdHeatmapProps {
  adSightings: AdSighting[];
  trackedSlugs: string[];
  competitorSlugs: string[];
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
  adSightings,
  trackedSlugs,
  competitorSlugs,
}: AdHeatmapProps) {
  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(() => new Set(competitorSlugs), [competitorSlugs]);

  const { apps, dates, matrix } = useMemo(() => {
    const dates = buildDateRange(30);

    // Build lookup: appSlug -> { date -> timesSeenInDay }
    const appMap = new Map<
      string,
      { slug: string; name: string; total: number; sightings: Map<string, number> }
    >();

    for (const s of adSightings) {
      let entry = appMap.get(s.appSlug);
      if (!entry) {
        entry = {
          slug: s.appSlug,
          name: s.appName,
          total: 0,
          sightings: new Map(),
        };
        appMap.set(s.appSlug, entry);
      }
      entry.total += s.timesSeenInDay;
      const existing = entry.sightings.get(s.seenDate) ?? 0;
      entry.sightings.set(s.seenDate, existing + s.timesSeenInDay);
    }

    // Sort by total activity (most active first)
    const apps = [...appMap.values()].sort((a, b) => b.total - a.total);

    // Build matrix: apps × dates → count
    const matrix = apps.map((app) =>
      dates.map((date) => app.sightings.get(date) ?? 0)
    );

    return { apps, dates, matrix };
  }, [adSightings]);

  if (apps.length === 0) return null;

  // Show date labels every ~5 days
  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Date headers */}
        <div className="flex items-end gap-0 mb-1">
          <div className="w-[180px] shrink-0" />
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

        {/* App rows */}
        {apps.map((app, appIdx) => {
          const isTracked = trackedSet.has(app.slug);
          const isCompetitor = competitorSet.has(app.slug);
          return (
            <div
              key={app.slug}
              className={`flex items-center gap-0 py-[2px] ${
                isTracked
                  ? "bg-emerald-500/5"
                  : isCompetitor
                    ? "bg-amber-500/5"
                    : ""
              }`}
            >
              {/* App label */}
              <div className="w-[180px] shrink-0 pr-2 flex items-center gap-1 min-w-0">
                <Link
                  href={`/apps/${app.slug}`}
                  className="text-xs text-primary hover:underline truncate"
                  title={app.name}
                >
                  {app.name}
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
                {matrix[appIdx].map((count, dateIdx) => (
                  <div
                    key={dates[dateIdx]}
                    className={`flex-1 min-w-[14px] h-[14px] rounded-[2px] ${intensityClass(count)}`}
                    title={
                      count > 0
                        ? `${app.name} — ${formatShortDate(dates[dateIdx])} — seen ${count} time${count !== 1 ? "s" : ""}`
                        : `${formatShortDate(dates[dateIdx])} — no ad`
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}

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
