"use client";

import { useMemo, useState } from "react";
import { SCRAPER_SCHEDULES, getNextRunFromCron, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
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
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronLeft, Clock } from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS } from "@/lib/platform-display";
import { formatDuration } from "@/lib/format-utils";
import type { HealthCell } from "./matrix-cell";

interface ScheduleTimelineProps {
  healthData: { matrix: HealthCell[] } | null;
}

const VISIBLE_HOURS = 24;

const TYPE_COLORS: Record<string, string> = {
  category: "#22c55e",
  app_details: "#3b82f6",
  keyword_search: "#a855f7",
  reviews: "#f59e0b",
  compute_app_scores: "#ec4899",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  completed: "#22c55e",
  failed: "#ef4444",
  running: "#3b82f6",
};

const TYPE_SHORT: Record<string, string> = {
  category: "Cat",
  app_details: "App",
  keyword_search: "Kw",
  reviews: "Rev",
  compute_app_scores: "Score",
};

const ALL_TYPES = Object.keys(TYPE_COLORS);

interface TimelineBlock {
  platform: PlatformId;
  scraperType: string;
  scheduledHour: number;
  scheduledMinute: number;
  nextRunAt: Date;
  avgDurationMs: number | null;
  lastDurationMs: number | null;
  lastStatus: string | null;
  itemsFailed: number | null;
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
  // Wrap to 0-23
  const wrapped = ((h % 24) + 24) % 24;
  return `${String(wrapped).padStart(2, "0")}:00`;
}

function getEffectiveStatus(block: TimelineBlock): string {
  if (block.currentlyRunning) return "running";
  if (block.lastStatus === "failed") return "failed";
  if (block.lastStatus === "completed" && (block.itemsFailed ?? 0) > 0) return "partial";
  if (block.lastStatus === "completed") return "completed";
  return "unknown";
}

export function ScheduleTimeline({ healthData }: ScheduleTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hourOffset, setHourOffset] = useState(0); // 0 = starts at 00:00
  const [hiddenPlatforms, setHiddenPlatforms] = useState<Set<string>>(new Set());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const blocks = useMemo(() => {
    const result: TimelineBlock[] = [];
    const cellMap = new Map<string, HealthCell>();
    if (healthData) {
      for (const cell of healthData.matrix) {
        cellMap.set(`${cell.platform}:${cell.scraperType}`, cell);
      }
    }

    for (const sched of SCRAPER_SCHEDULES) {
      if (sched.type === "daily_digest") continue;

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
          itemsFailed: cell?.lastRun?.itemsFailed ?? null,
          currentlyRunning: cell?.currentlyRunning ?? false,
          runningStartedAt: cell?.runningStartedAt ?? null,
          completedAt: cell?.lastRun?.completedAt ?? null,
        });
      }
    }

    return result;
  }, [healthData]);

  // Current time position
  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  const currentMinuteUTC = now.getUTCMinutes();
  const currentAbsolute = currentHourUTC + currentMinuteUTC / 60;

  const startHour = hourOffset;
  const endHour = hourOffset + VISIBLE_HOURS;
  const hoursRange = Array.from({ length: VISIBLE_HOURS }, (_, i) => startHour + i);

  // "Now" position within visible range
  const nowInRange = currentAbsolute - startHour;
  const nowPosition = nowInRange >= 0 && nowInRange <= VISIBLE_HOURS ? nowInRange / VISIBLE_HOURS : null;

  // Visible platforms
  const visiblePlatforms = PLATFORM_IDS.filter(
    (p) => !hiddenPlatforms.has(p) && blocks.some((b) => b.platform === p)
  );

  const togglePlatform = (p: string) => {
    setHiddenPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleType = (t: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

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
            <span className="text-xs text-muted-foreground ml-1">UTC</span>
          </div>
          {/* Type toggles */}
          <div className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
            {ALL_TYPES.map((type) => {
              const hidden = hiddenTypes.has(type);
              return (
                <button
                  key={type}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                    hidden ? "opacity-30 hover:opacity-60" : "hover:bg-muted"
                  }`}
                  onClick={() => toggleType(type)}
                  title={hidden ? `Show ${SCRAPER_TYPE_LABELS[type]}` : `Hide ${SCRAPER_TYPE_LABELS[type]}`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: TYPE_COLORS[type] }}
                  />
                  <span className="text-muted-foreground">
                    {SCRAPER_TYPE_LABELS[type] || type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-0 pb-4">
          {/* Navigation */}
          <div className="flex items-center justify-between px-4 mb-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setHourOffset((h) => h - 6)}
                title="Back 6 hours"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setHourOffset(0)}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setHourOffset((h) => h + 6)}
                title="Forward 6 hours"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatHour(startHour)} &mdash; {formatHour(endHour)} UTC
              {hourOffset !== 0 && (
                <span className="ml-1">({hourOffset > 0 ? "+" : ""}{hourOffset}h)</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px] px-4">
              {/* Hour labels */}
              <div className="flex ml-[120px]">
                {hoursRange.map((h) => (
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
              {PLATFORM_IDS.map((platformId) => {
                const hasBocks = blocks.some((b) => b.platform === platformId);
                if (!hasBocks) return null;

                const hidden = hiddenPlatforms.has(platformId);
                const platformBlocks = hidden
                  ? []
                  : blocks.filter(
                      (b) =>
                        b.platform === platformId && !hiddenTypes.has(b.scraperType)
                    );

                return (
                  <div
                    key={platformId}
                    className={`flex items-center border-t border-border/20 ${hidden ? "h-6 opacity-40" : "h-9"}`}
                  >
                    {/* Platform label — clickable to toggle */}
                    <button
                      className="w-[120px] shrink-0 flex items-center gap-1.5 px-2 hover:bg-muted/50 rounded transition-colors h-full"
                      onClick={() => togglePlatform(platformId)}
                      title={hidden ? `Show ${PLATFORM_LABELS[platformId]}` : `Hide ${PLATFORM_LABELS[platformId]}`}
                    >
                      <div
                        className={`rounded-full shrink-0 ${hidden ? "w-2 h-2" : "w-2.5 h-2.5"}`}
                        style={{ backgroundColor: PLATFORM_COLORS[platformId] }}
                      />
                      <span className={`font-medium truncate ${hidden ? "text-[10px]" : "text-xs"}`}>
                        {PLATFORM_LABELS[platformId]}
                      </span>
                    </button>

                    {/* Timeline track */}
                    {!hidden && (
                      <div className="flex-1 relative h-full">
                        {/* Hour grid lines */}
                        {hoursRange.map((h) => (
                          <div
                            key={h}
                            className="absolute top-0 bottom-0 border-l border-border/20"
                            style={{ left: `${((h - startHour) / VISIBLE_HOURS) * 100}%` }}
                          />
                        ))}

                        {/* Now indicator */}
                        {nowPosition !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
                            style={{ left: `${nowPosition * 100}%` }}
                          >
                            <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" />
                          </div>
                        )}

                        {/* Schedule blocks */}
                        {platformBlocks.map((block, i) => {
                          const blockHour = block.scheduledHour + block.scheduledMinute / 60;
                          const startFrac = (blockHour - startHour) / VISIBLE_HOURS;

                          // Skip blocks outside visible range
                          if (startFrac < -0.1 || startFrac > 1.05) return null;

                          const durationMs = block.avgDurationMs || block.lastDurationMs || 600_000;
                          const durationHours = durationMs / 3_600_000;
                          const widthFrac = Math.max(durationHours / VISIBLE_HOURS, 0.008);
                          const color = TYPE_COLORS[block.scraperType] || "#888";
                          const status = getEffectiveStatus(block);
                          const statusDotColor =
                            status === "running" ? STATUS_DOT_COLORS.running :
                            status === "failed" ? STATUS_DOT_COLORS.failed :
                            status === "partial" ? "#f97316" :
                            status === "completed" ? STATUS_DOT_COLORS.completed :
                            "#9ca3af";

                          const isRunning = block.currentlyRunning;
                          const timeUntil = formatTimeUntil(block.nextRunAt);

                          return (
                            <Tooltip key={`${block.scraperType}-${block.scheduledHour}-${i}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`absolute top-1 bottom-1 rounded-sm cursor-default transition-all hover:brightness-110 flex items-center justify-center overflow-visible ${
                                    isRunning ? "animate-pulse ring-1 ring-blue-400" : ""
                                  }`}
                                  style={{
                                    left: `${Math.max(startFrac * 100, 0)}%`,
                                    width: `${widthFrac * 100}%`,
                                    backgroundColor: color,
                                    opacity: status === "failed" ? 0.5 : 0.85,
                                    minWidth: "20px",
                                  }}
                                >
                                  <span className="text-[9px] text-white font-medium leading-none">
                                    {TYPE_SHORT[block.scraperType] || ""}
                                  </span>
                                  {/* Status dot */}
                                  <div
                                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white z-10"
                                    style={{ backgroundColor: statusDotColor }}
                                  />
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
                                  {block.avgDurationMs != null && (
                                    <div>Avg duration: {formatDuration(block.avgDurationMs)}</div>
                                  )}
                                  {block.lastDurationMs != null && (
                                    <div>Last duration: {formatDuration(block.lastDurationMs)}</div>
                                  )}
                                  {block.lastStatus && (
                                    <div>
                                      Last status:{" "}
                                      <span
                                        className={
                                          status === "failed" ? "text-red-500" :
                                          status === "partial" ? "text-orange-500" :
                                          status === "running" ? "text-blue-500" :
                                          "text-green-500"
                                        }
                                      >
                                        {status === "partial" ? "partial" : block.lastStatus}
                                      </span>
                                      {(block.itemsFailed ?? 0) > 0 && (
                                        <span className="text-orange-500 ml-1">({block.itemsFailed} failed)</span>
                                      )}
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
                    )}
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
