"use client";

import { useMemo, useState } from "react";
import { SCRAPER_SCHEDULES, getNextRunFromCron, type PlatformId } from "@appranks/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS } from "@/lib/platform-display";
import { formatDuration } from "@/lib/format-utils";
import type { HealthCell } from "./matrix-cell";

interface ScheduleTimelineProps {
  healthData: { matrix: HealthCell[] } | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TYPE_COLORS: Record<string, string> = {
  category: "#22c55e",
  app_details: "#3b82f6",
  keyword_search: "#a855f7",
  reviews: "#f59e0b",
  compute_app_scores: "#ec4899",
};

const TYPE_SHORT: Record<string, string> = {
  category: "Cat",
  app_details: "App",
  keyword_search: "Kw",
  reviews: "Rev",
  compute_app_scores: "Score",
};

interface TimelineBlock {
  platform: PlatformId;
  scraperType: string;
  scheduledHour: number;
  scheduledMinute: number;
  nextRunAt: Date;
  avgDurationMs: number | null;
  lastDurationMs: number | null;
  lastStatus: string | null;
  currentlyRunning: boolean;
  runningStartedAt: string | null;
  completedAt: string | null;
}

function formatTimeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function ScheduleTimeline({ healthData }: ScheduleTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const blocks = useMemo(() => {
    const result: TimelineBlock[] = [];
    const cellMap = new Map<string, HealthCell>();
    if (healthData) {
      for (const cell of healthData.matrix) {
        cellMap.set(`${cell.platform}:${cell.scraperType}`, cell);
      }
    }

    for (const sched of SCRAPER_SCHEDULES) {
      if (sched.type === "daily_digest") continue; // skip non-scraper jobs

      const parts = sched.cron.split(" ");
      const minute = parseInt(parts[0], 10);
      const hours = parts[1].split(",").map(Number);
      const cell = cellMap.get(`${sched.platform}:${sched.type}`);

      for (const hour of hours) {
        const nextRun = getNextRunFromCron(sched.cron);
        result.push({
          platform: sched.platform as PlatformId,
          scraperType: sched.type,
          scheduledHour: hour,
          scheduledMinute: minute,
          nextRunAt: nextRun,
          avgDurationMs: cell?.avgDurationMs ?? null,
          lastDurationMs: cell?.lastRun?.durationMs ?? null,
          lastStatus: cell?.lastRun?.status ?? null,
          currentlyRunning: cell?.currentlyRunning ?? false,
          runningStartedAt: cell?.runningStartedAt ?? null,
          completedAt: cell?.lastRun?.completedAt ?? null,
        });
      }
    }

    return result;
  }, [healthData]);

  // Current hour indicator
  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  const currentMinuteUTC = now.getUTCMinutes();
  const currentPosition = (currentHourUTC + currentMinuteUTC / 60) / 24;

  // Group blocks by platform
  const platforms = [...new Set(blocks.map((b) => b.platform))];

  if (!healthData) return null;

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <Clock className="h-5 w-5" />
            <CardTitle className="text-lg">Schedule Timeline</CardTitle>
            <span className="text-xs text-muted-foreground ml-2">UTC</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                {SCRAPER_TYPE_LABELS[type] || type}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-0 pb-4">
          <div className="overflow-x-auto">
            <div className="min-w-[900px] px-4">
              {/* Hour labels */}
              <div className="flex ml-[120px]">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 text-[10px] text-muted-foreground text-center border-l border-border/30"
                    style={{ minWidth: 0 }}
                  >
                    {h % 2 === 0 ? formatHour(h) : ""}
                  </div>
                ))}
              </div>

              {/* Platform rows */}
              {platforms.map((platformId) => {
                const platformBlocks = blocks.filter((b) => b.platform === platformId);
                return (
                  <div key={platformId} className="flex items-center h-8 border-t border-border/20">
                    {/* Platform label */}
                    <div className="w-[120px] shrink-0 flex items-center gap-1.5 px-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[platformId] }}
                      />
                      <span className="text-xs font-medium truncate">
                        {PLATFORM_LABELS[platformId]}
                      </span>
                    </div>

                    {/* Timeline track */}
                    <div className="flex-1 relative h-full">
                      {/* Hour grid lines */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-border/20"
                          style={{ left: `${(h / 24) * 100}%` }}
                        />
                      ))}

                      {/* Now indicator */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
                        style={{ left: `${currentPosition * 100}%` }}
                      >
                        <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" />
                      </div>

                      {/* Schedule blocks */}
                      {platformBlocks.map((block, i) => {
                        const startFrac = (block.scheduledHour + block.scheduledMinute / 60) / 24;
                        const durationMs = block.avgDurationMs || block.lastDurationMs || 600_000; // fallback 10min
                        const durationHours = durationMs / 3_600_000;
                        const widthFrac = Math.max(durationHours / 24, 0.006); // min visible width
                        const color = TYPE_COLORS[block.scraperType] || "#888";

                        const isRunning = block.currentlyRunning;
                        const timeUntil = formatTimeUntil(block.nextRunAt);

                        return (
                          <Tooltip key={`${block.scraperType}-${block.scheduledHour}-${i}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={`absolute top-1 bottom-1 rounded-sm cursor-default transition-opacity hover:opacity-90 flex items-center justify-center overflow-hidden ${
                                  isRunning ? "animate-pulse ring-1 ring-blue-400" : ""
                                }`}
                                style={{
                                  left: `${startFrac * 100}%`,
                                  width: `${widthFrac * 100}%`,
                                  backgroundColor: color,
                                  opacity: block.lastStatus === "failed" ? 0.5 : 0.8,
                                  minWidth: "18px",
                                }}
                              >
                                <span className="text-[9px] text-white font-medium leading-none">
                                  {TYPE_SHORT[block.scraperType] || ""}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <div className="font-medium">
                                  {PLATFORM_LABELS[block.platform]} — {SCRAPER_TYPE_LABELS[block.scraperType] || block.scraperType}
                                </div>
                                <div>
                                  Scheduled: {formatHour(block.scheduledHour)}
                                  {block.scheduledMinute > 0 ? `:${String(block.scheduledMinute).padStart(2, "0")}` : ""} UTC
                                </div>
                                <div>
                                  Next run: <span className="font-medium">{timeUntil}</span>
                                </div>
                                {block.avgDurationMs && (
                                  <div>Avg duration: {formatDuration(block.avgDurationMs)}</div>
                                )}
                                {block.lastDurationMs && (
                                  <div>Last duration: {formatDuration(block.lastDurationMs)}</div>
                                )}
                                {block.lastStatus && (
                                  <div>
                                    Last status:{" "}
                                    <span className={block.lastStatus === "failed" ? "text-red-500" : "text-green-500"}>
                                      {block.lastStatus}
                                    </span>
                                  </div>
                                )}
                                {isRunning && (
                                  <div className="text-blue-500 font-medium">Currently running</div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
