"use client";

import { useMemo } from "react";

interface Sighting {
  surface: string;
  surfaceDetail: string;
  sectionHandle: string;
  sectionTitle: string;
  position: number | null;
  seenDate: string;
  timesSeenInDay: number;
}

interface FeaturedHistoryProps {
  sightings: Sighting[];
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

export function FeaturedHistory({ sightings }: FeaturedHistoryProps) {
  const { sections, dates, matrix } = useMemo(() => {
    const dates = buildDateRange(30);

    const sectionMap = new Map<
      string,
      {
        key: string;
        surface: string;
        surfaceDetail: string;
        sectionTitle: string;
        total: number;
        sightings: Map<string, number>;
      }
    >();

    for (const s of sightings) {
      const key = `${s.surface}:${s.surfaceDetail}:${s.sectionHandle}`;
      let entry = sectionMap.get(key);
      if (!entry) {
        entry = {
          key,
          surface: s.surface,
          surfaceDetail: s.surfaceDetail,
          sectionTitle: s.sectionTitle || s.sectionHandle,
          total: 0,
          sightings: new Map(),
        };
        sectionMap.set(key, entry);
      }
      entry.total += s.timesSeenInDay;
      const existing = entry.sightings.get(s.seenDate) ?? 0;
      entry.sightings.set(s.seenDate, existing + s.timesSeenInDay);
    }

    const sections = [...sectionMap.values()].sort(
      (a, b) => b.total - a.total
    );

    const matrix = sections.map((section) =>
      dates.map((date) => section.sightings.get(date) ?? 0)
    );

    return { sections, dates, matrix };
  }, [sightings]);

  if (sections.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        This app has not been observed in any featured sections yet.
      </p>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Date headers */}
        <div className="flex items-end gap-0 mb-1">
          <div className="w-[300px] shrink-0" />
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

        {/* Rows */}
        {sections.map((section, idx) => {
          const shopifyUrl =
            section.surface === "category"
              ? `https://apps.shopify.com/categories/${section.surfaceDetail}`
              : "https://apps.shopify.com";

          const daysActive = matrix[idx].filter((c) => c > 0).length;

          return (
            <div key={section.key} className="flex items-center gap-0 py-[2px]">
              <div className="w-[300px] shrink-0 pr-2 flex items-center gap-1.5 min-w-0">
                <a
                  href={shopifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate"
                  title={section.sectionTitle}
                >
                  {section.sectionTitle}
                </a>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {daysActive}d
                </span>
              </div>

              <div className="flex-1 flex gap-[2px]">
                {matrix[idx].map((count, dateIdx) => (
                  <div
                    key={dates[dateIdx]}
                    className={`flex-1 min-w-[14px] h-[14px] rounded-[2px] ${intensityClass(count)}`}
                    title={
                      count > 0
                        ? `${section.sectionTitle} — ${formatShortDate(dates[dateIdx])} — seen ${count} time${count !== 1 ? "s" : ""}`
                        : `${formatShortDate(dates[dateIdx])} — not featured`
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
