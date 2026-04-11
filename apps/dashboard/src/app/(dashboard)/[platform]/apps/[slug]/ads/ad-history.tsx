"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildDateRange, formatShortDate, formatDateRangeLabel, intensityClass } from "@/lib/heatmap-utils";

interface Sighting {
  keywordId: number;
  keyword: string;
  keywordSlug: string;
  seenDate: string;
  timesSeenInDay: number;
}

interface AppAdHistoryProps {
  sightings: Sighting[];
}

export function AppAdHistory({ sightings }: AppAdHistoryProps) {
  const { platform } = useParams();
  const [dayOffset, setDayOffset] = useState(0);

  const { keywords, dates, matrix } = useMemo(() => {
    const dates = buildDateRange(30, dayOffset);

    const keywordMap = new Map<
      string,
      {
        slug: string;
        keyword: string;
        total: number;
        sightings: Map<string, number>;
      }
    >();

    for (const s of sightings) {
      let entry = keywordMap.get(s.keywordSlug);
      if (!entry) {
        entry = {
          slug: s.keywordSlug,
          keyword: s.keyword,
          total: 0,
          sightings: new Map(),
        };
        keywordMap.set(s.keywordSlug, entry);
      }
      entry.total += s.timesSeenInDay;
      const existing = entry.sightings.get(s.seenDate) ?? 0;
      entry.sightings.set(s.seenDate, existing + s.timesSeenInDay);
    }

    const keywords = [...keywordMap.values()].sort(
      (a, b) => b.total - a.total
    );

    const matrix = keywords.map((kw) =>
      dates.map((date) => kw.sightings.get(date) ?? 0)
    );

    return { keywords, dates, matrix };
  }, [sightings, dayOffset]);

  if (keywords.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No ad sightings recorded for this app yet.
      </p>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
  const dateRangeLabel = formatDateRangeLabel(dates);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Time navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setDayOffset((o) => o + 30)}
            className="flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted transition-colors"
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

        {/* Rows */}
        {keywords.map((kw, idx) => {
          const daysActive = matrix[idx].filter((c) => c > 0).length;
          return (
            <div key={kw.slug} className="flex items-center gap-0 py-[2px]">
              <div className="w-[200px] shrink-0 pr-2 flex items-center gap-1.5 min-w-0">
                <Link
                  href={`/${platform}/keywords/${kw.slug}`}
                  className="text-sm text-primary hover:underline truncate"
                  title={kw.keyword}
                >
                  {kw.keyword}
                </Link>
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
                        ? `${kw.keyword} — ${formatShortDate(dates[dateIdx])} — seen ${count} time${count !== 1 ? "s" : ""}`
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
