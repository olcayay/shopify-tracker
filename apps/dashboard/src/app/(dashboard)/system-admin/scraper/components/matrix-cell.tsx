"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Play, FileText, Copy, Check, X, Loader2 } from "lucide-react";
import { formatDuration, timeAgo } from "@/lib/format-utils";
import { useFormatDate } from "@/lib/format-date";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_LABELS, SCRAPER_TYPE_LABELS } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

export interface HealthCell {
  platform: string;
  scraperType: string;
  lastRun: {
    runId?: string;
    status: string;
    completedAt: string | null;
    startedAt: string | null;
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

export type CellStatus = "green" | "red" | "yellow" | "blue" | "gray" | "amber";

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
  if (cell.lastRun?.status === "completed" && (cell.lastRun.itemsFailed ?? 0) > 0) return "amber";
  return "green";
}

export const STATUS_COLORS: Record<CellStatus, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  blue: "bg-blue-500",
  gray: "bg-gray-300",
  amber: "bg-orange-500",
};

export const STATUS_RING: Record<CellStatus, string> = {
  green: "ring-green-200",
  red: "ring-red-200",
  yellow: "ring-yellow-200",
  blue: "ring-blue-200 animate-pulse",
  gray: "ring-gray-100",
  amber: "ring-orange-200",
};

export const STATUS_LABELS: Record<CellStatus, string> = {
  green: "Healthy",
  red: "Failed",
  yellow: "Stale",
  blue: "Running",
  gray: "Not Scheduled",
  amber: "Partial",
};

const SCRAPER_TYPE_FILE_MAP: Record<string, string> = {
  app_details: "app-details-scraper.ts",
  keyword_search: "keyword-scraper.ts",
  reviews: "review-scraper.ts",
  category: "category-scraper.ts",
};

function buildCellDebugReport(cell: HealthCell, itemErrors?: any[]): string {
  const lines = [
    "=== SCRAPER ERROR REPORT ===",
    "",
    "--- Run ---",
    `Run ID:       ${cell.lastRun?.runId || "N/A"}`,
    `Platform:     ${cell.platform}`,
    `Scraper Type: ${cell.scraperType}`,
    `Status:       ${cell.lastRun?.status || "unknown"}`,
    `Started:      ${cell.lastRun?.startedAt || "N/A"}`,
    `Completed:    ${cell.lastRun?.completedAt || "N/A"}`,
    `Duration:     ${cell.lastRun?.durationMs ? `${cell.lastRun.durationMs}ms` : "N/A"}`,
    `Items:        ${cell.lastRun?.itemsScraped ?? 0} scraped, ${cell.lastRun?.itemsFailed ?? 0} failed`,
    `Schedule:     ${cell.schedule?.cron || "N/A"}`,
  ];
  if (cell.lastRun?.fallbackUsed) {
    lines.push("Fallback:     Yes");
  }
  const file = SCRAPER_TYPE_FILE_MAP[cell.scraperType];
  if (file) {
    lines.push(`Scraper File: apps/scraper/src/scrapers/${file}`);
  }
  if (cell.lastRun?.error) {
    lines.push("", "--- Run Error ---", cell.lastRun.error);
  }
  if (itemErrors && itemErrors.length > 0) {
    lines.push("");
    for (let i = 0; i < itemErrors.length; i++) {
      const err = itemErrors[i];
      lines.push(
        `--- Failed Item ${i + 1}/${itemErrors.length} ---`,
        `Identifier:   ${err.itemIdentifier}`,
        `Type:         ${err.itemType}`,
        `URL:          ${err.url || "N/A"}`,
        `Error:        ${err.errorMessage}`,
      );
      if (err.stackTrace) {
        lines.push("Stack Trace:", err.stackTrace);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

interface MatrixCellProps {
  cell: HealthCell;
  onTrigger: (platform: string, type: string) => void;
  triggering: string | null;
}

export function MatrixCell({ cell, onTrigger, triggering }: MatrixCellProps) {
  const status = getCellStatus(cell);
  const triggerKey = `${cell.platform}:${cell.scraperType}`;
  const isTriggering = triggering === triggerKey;
  const hasError = !!(cell.lastRun?.error) || (cell.lastRun?.itemsFailed ?? 0) > 0;
  const [showErrorDetail, setShowErrorDetail] = useState(false);

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
          {/* Error detail button */}
          {hasError && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowErrorDetail(true);
              }}
              title="View error details"
            >
              <FileText className="h-3 w-3 text-destructive" />
            </Button>
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
            Status: <span className="capitalize">{STATUS_LABELS[status]}</span>
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
          {hasError && (
            <div className="text-muted-foreground italic">
              Click <FileText className="inline h-3 w-3" /> for full error details
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
      {/* Error detail modal */}
      {showErrorDetail && (
        <ErrorDetailModal cell={cell} onClose={() => setShowErrorDetail(false)} />
      )}
    </Tooltip>
  );
}

function ErrorDetailModal({ cell, onClose }: { cell: HealthCell; onClose: () => void }) {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [itemErrors, setItemErrors] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasItemErrors = (cell.lastRun?.itemsFailed ?? 0) > 0 && cell.lastRun?.runId;

  const loadItemErrors = async () => {
    if (!cell.lastRun?.runId || itemErrors) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/scraper/runs/${cell.lastRun.runId}/item-errors`);
      if (res.ok) {
        const data = await res.json();
        setItemErrors(data.errors);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  // Auto-load item errors
  if (hasItemErrors && itemErrors === null && !loading) {
    loadItemErrors();
  }

  const handleCopy = async () => {
    const report = buildCellDebugReport(cell, itemErrors || undefined);
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg shadow-lg max-w-xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {PLATFORM_LABELS[cell.platform as PlatformId] || cell.platform} &mdash; {SCRAPER_TYPE_LABELS[cell.scraperType] || cell.scraperType}
            </span>
            <Badge
              variant={cell.lastRun?.status === "failed" ? "destructive" : "outline"}
              className={cell.lastRun?.status === "completed" && (cell.lastRun?.itemsFailed ?? 0) > 0 ? "bg-orange-50 text-orange-600 border-orange-200" : ""}
            >
              {cell.lastRun?.status === "completed" && (cell.lastRun?.itemsFailed ?? 0) > 0 ? "partial" : cell.lastRun?.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Copied!" : "Copy Report"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 space-y-3 text-xs">
          {/* Run info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="text-muted-foreground">Run ID</div>
            <div className="font-mono">{cell.lastRun?.runId || "N/A"}</div>
            <div className="text-muted-foreground">Completed</div>
            <div>{cell.lastRun?.completedAt ? formatDateTime(cell.lastRun.completedAt) : "N/A"}</div>
            <div className="text-muted-foreground">Duration</div>
            <div>{cell.lastRun?.durationMs != null ? formatDuration(cell.lastRun.durationMs) : "N/A"}</div>
            <div className="text-muted-foreground">Items</div>
            <div>
              {cell.lastRun?.itemsScraped ?? 0} scraped
              {(cell.lastRun?.itemsFailed ?? 0) > 0 && (
                <span className="text-destructive ml-1">({cell.lastRun?.itemsFailed} failed)</span>
              )}
            </div>
            <div className="text-muted-foreground">Schedule</div>
            <div className="font-mono">{cell.schedule?.cron || "N/A"}</div>
          </div>

          {/* Run-level error */}
          {cell.lastRun?.error && (
            <div>
              <div className="text-sm font-medium text-destructive mb-1">Error</div>
              <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-md whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {cell.lastRun.error}
              </pre>
            </div>
          )}

          {/* Item errors */}
          {hasItemErrors && (
            <div>
              <div className="text-sm font-medium text-orange-600 mb-1">
                Failed Items ({cell.lastRun?.itemsFailed})
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </div>
              ) : itemErrors && itemErrors.length > 0 ? (
                <div className="space-y-2">
                  {itemErrors.map((err: any) => (
                    <div key={err.id} className="border border-orange-200 bg-orange-50/50 rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-orange-700">{err.itemIdentifier}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{err.itemType}</Badge>
                      </div>
                      {err.url && (
                        <div className="text-muted-foreground truncate mb-1" title={err.url}>{err.url}</div>
                      )}
                      <div className="text-destructive">{err.errorMessage}</div>
                    </div>
                  ))}
                </div>
              ) : itemErrors && itemErrors.length === 0 ? (
                <div className="text-muted-foreground py-1">No detailed error records available</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
