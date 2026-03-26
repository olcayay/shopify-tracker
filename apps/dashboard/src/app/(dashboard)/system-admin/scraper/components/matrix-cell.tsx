"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Play } from "lucide-react";
import { formatDuration, timeAgo } from "@/lib/format-utils";
import { PLATFORM_LABELS, SCRAPER_TYPE_LABELS } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

export interface HealthCell {
  platform: string;
  scraperType: string;
  lastRun: {
    status: string;
    completedAt: string | null;
    durationMs: number | null;
    itemsScraped: number | null;
    itemsFailed: number | null;
    error: string | null;
    fallbackUsed?: boolean;
  } | null;
  avgDurationMs: number | null;
  prevDurationMs: number | null;
  currentlyRunning: boolean;
  runningStartedAt: string | null;
  schedule: { cron: string; nextRunAt: string } | null;
}

export type CellStatus = "green" | "red" | "yellow" | "blue" | "gray";

export function getCellStatus(cell: HealthCell): CellStatus {
  if (!cell.schedule) return "gray";
  if (cell.currentlyRunning) return "blue";
  if (cell.lastRun?.status === "failed") return "red";
  if (!cell.lastRun?.completedAt) return "yellow";
  const age = Date.now() - new Date(cell.lastRun.completedAt).getTime();
  const parts = cell.schedule.cron.split(" ");
  const hourPart = parts[1];
  const cronHours = hourPart.split(",").length;
  const intervalMs = cronHours === 1 ? 24 * 60 * 60 * 1000 : (24 / cronHours) * 60 * 60 * 1000;
  if (age > intervalMs * 2) return "yellow";
  return "green";
}

export const STATUS_COLORS: Record<CellStatus, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  blue: "bg-blue-500",
  gray: "bg-gray-300",
};

export const STATUS_RING: Record<CellStatus, string> = {
  green: "ring-green-200",
  red: "ring-red-200",
  yellow: "ring-yellow-200",
  blue: "ring-blue-200 animate-pulse",
  gray: "ring-gray-100",
};

interface MatrixCellProps {
  cell: HealthCell;
  onTrigger: (platform: string, type: string) => void;
  triggering: string | null;
}

export function MatrixCell({ cell, onTrigger, triggering }: MatrixCellProps) {
  const status = getCellStatus(cell);
  const triggerKey = `${cell.platform}:${cell.scraperType}`;
  const isTriggering = triggering === triggerKey;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/50 transition-colors group min-w-0">
          {/* Status dot */}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ring-2 shrink-0 ${STATUS_COLORS[status]} ${STATUS_RING[status]}`}
          />
          {/* Time ago */}
          <span className="text-xs text-muted-foreground truncate">
            {cell.currentlyRunning
              ? "running"
              : cell.lastRun?.completedAt
                ? timeAgo(cell.lastRun.completedAt)
                : "\u2014"}
          </span>
          {/* Fallback badge */}
          {cell.lastRun?.fallbackUsed && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200 shrink-0"
            >
              F
            </Badge>
          )}
          {/* Trigger button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            disabled={isTriggering || triggering !== null}
            onClick={(e) => {
              e.stopPropagation();
              onTrigger(cell.platform, cell.scraperType);
            }}
            title={`Trigger ${SCRAPER_TYPE_LABELS[cell.scraperType] || cell.scraperType} for ${PLATFORM_LABELS[cell.platform as PlatformId] || cell.platform}`}
          >
            <Play className={`h-3 w-3 ${isTriggering ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div className="font-medium">
            {PLATFORM_LABELS[cell.platform as PlatformId] || cell.platform} &mdash; {SCRAPER_TYPE_LABELS[cell.scraperType] || cell.scraperType}
          </div>
          <div>
            Status: <span className="capitalize">{status}</span>
            {cell.currentlyRunning && cell.runningStartedAt && (
              <span className="text-muted-foreground"> (started {timeAgo(cell.runningStartedAt)})</span>
            )}
          </div>
          {cell.lastRun?.completedAt && (
            <div>Completed: {timeAgo(cell.lastRun.completedAt)}</div>
          )}
          {cell.lastRun?.durationMs != null && (
            <div>Duration: {formatDuration(cell.lastRun.durationMs)}</div>
          )}
          {cell.lastRun?.itemsScraped != null && (
            <div>
              Items: {cell.lastRun.itemsScraped} scraped
              {(cell.lastRun.itemsFailed ?? 0) > 0 && (
                <span className="text-destructive"> ({cell.lastRun.itemsFailed} failed)</span>
              )}
            </div>
          )}
          {cell.lastRun?.fallbackUsed && (
            <div className="text-orange-600">Fallback scraping was used</div>
          )}
          {cell.lastRun?.error && (
            <div className="text-destructive truncate max-w-[250px]">
              Error: {cell.lastRun.error.slice(0, 80)}
              {cell.lastRun.error.length > 80 ? "..." : ""}
            </div>
          )}
          {cell.schedule && (
            <>
              <div>Schedule: {cell.schedule.cron}</div>
              <div>Next: {timeAgo(cell.schedule.nextRunAt).replace(" ago", "").replace("just now", "now")}</div>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
