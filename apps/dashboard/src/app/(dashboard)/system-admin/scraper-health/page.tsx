"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePolling } from "@/hooks/use-polling";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Skull,
  Trash2,
} from "lucide-react";
import { useFormatDate } from "@/lib/format-date";
import { CopyButton } from "@/components/ui/copy-button";
import { SmokeTestPanel } from "./smoke-test-panel";
import { SmokeTestHistory, type SmokeHistoryEntry } from "../scraper/components/smoke-test-history";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS, HEALTH_SCRAPER_TYPES } from "@/lib/platform-display";
import { buildRunReport, buildHealthCellReport, type RunInfo } from "@/lib/scraper-report";
import { CopyReportButton } from "@/components/copy-report-button";

interface HealthCell {
  platform: string;
  scraperType: string;
  lastRun: {
    runId?: string;
    jobId?: string | null;
    status: string;
    completedAt: string | null;
    durationMs: number | null;
    itemsScraped: number | null;
    itemsFailed: number | null;
    error: string | null;
  } | null;
  avgDurationMs: number | null;
  prevDurationMs: number | null;
  currentlyRunning: boolean;
  runningStartedAt: string | null;
  schedule: { cron: string; nextRunAt: string } | null;
}

interface HealthData {
  matrix: HealthCell[];
  summary: {
    healthy: number;
    failed: number;
    stale: number;
    running: number;
    totalScheduled: number;
  };
  recentFailures: {
    id: string;
    platform: string;
    scraperType: string;
    completedAt: string;
    startedAt: string | null;
    error: string;
    durationMs: number | null;
    itemsScraped: number | null;
    itemsFailed: number | null;
    triggeredBy: string | null;
    queue: string | null;
    jobId: string | null;
  }[];
  anomalies: {
    platform: string;
    scraperType: string;
    lastDurationMs: number;
    avgDurationMs: number;
    changePercent: number;
  }[];
  staleRuns?: {
    id: string;
    platform: string;
    scraperType: string;
    startedAt: string | null;
    runningSecs: number;
    triggeredBy: string | null;
    jobId: string | null;
  }[];
}

import { formatDuration, timeAgo } from "@/lib/format-utils";

type CellStatus = "green" | "red" | "yellow" | "blue" | "gray";

function getCellStatus(cell: HealthCell): CellStatus {
  if (!cell.schedule) return "gray";
  if (cell.currentlyRunning) return "blue";
  if (cell.lastRun?.status === "failed") return "red";
  if (!cell.lastRun?.completedAt) return "yellow";
  const age = Date.now() - new Date(cell.lastRun.completedAt).getTime();
  // Parse cron to determine interval
  const parts = cell.schedule.cron.split(" ");
  const hourPart = parts[1];
  const cronHours = hourPart.split(",").length;
  const intervalMs = cronHours === 1 ? 24 * 60 * 60 * 1000 : (24 / cronHours) * 60 * 60 * 1000;
  if (age > intervalMs * 2) return "yellow";
  return "green";
}

const STATUS_COLORS: Record<CellStatus, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  blue: "bg-blue-500",
  gray: "bg-gray-300 dark:bg-gray-600/30",
};

const STATUS_RING: Record<CellStatus, string> = {
  green: "ring-green-200",
  red: "ring-red-200",
  yellow: "ring-yellow-200",
  blue: "ring-blue-200 animate-pulse",
  gray: "ring-gray-100 dark:ring-gray-800",
};

const STATUS_LABEL_MAP: Record<CellStatus, string> = {
  green: "Healthy",
  red: "Failed",
  yellow: "Stale",
  blue: "Running",
  gray: "Not Scheduled",
};

function getDurationTrend(cell: HealthCell): { direction: "up" | "down" | null; text: string } {
  if (!cell.lastRun?.durationMs || !cell.avgDurationMs) return { direction: null, text: "" };
  const pct = ((cell.lastRun.durationMs - cell.avgDurationMs) / cell.avgDurationMs) * 100;
  if (Math.abs(pct) < 10) return { direction: null, text: formatDuration(cell.lastRun.durationMs) };
  return {
    direction: pct > 0 ? "up" : "down",
    text: formatDuration(cell.lastRun.durationMs),
  };
}

export default function ScraperHealthPage() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [smokeHistory, setSmokeHistory] = useState<SmokeHistoryEntry[] | null>(null);
  const [killingRun, setKillingRun] = useState<string | null>(null);
  const staleRunsRef = useRef<HTMLDivElement>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const [res, smokeRes] = await Promise.all([
        fetchWithAuth("/api/system-admin/scraper/health"),
        fetchWithAuth("/api/system-admin/scraper/smoke-test/history"),
      ]);
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date());
      }
      if (smokeRes.ok) {
        setSmokeHistory(await smokeRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const refreshSmokeHistory = useCallback(async () => {
    const res = await fetchWithAuth("/api/system-admin/scraper/smoke-test/history");
    if (res.ok) setSmokeHistory(await res.json());
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  usePolling({
    hasPending: true,
    fetchFn: fetchHealth,
    interval: 60_000,
  });

  const handleRetry = async (runId: string) => {
    setRetrying(runId);
    try {
      await fetchWithAuth(`/api/system-admin/scraper/runs/${runId}/retry`, { method: "POST" });
      await fetchHealth();
    } finally {
      setRetrying(null);
    }
  };

  const handleKillRun = async (runId: string) => {
    setKillingRun(runId);
    try {
      await fetchWithAuth(`/api/system-admin/scraper/runs/${runId}/kill`, { method: "POST" });
      await fetchHealth();
    } finally {
      setKillingRun(null);
    }
  };

  const handleKillAllStale = async () => {
    if (!data?.staleRuns?.length) return;
    for (const run of data.staleRuns) {
      await fetchWithAuth(`/api/system-admin/scraper/runs/${run.id}/kill`, { method: "POST" }).catch(() => {});
    }
    await fetchHealth();
  };

  // Build matrix lookup: platform -> scraperType -> cell
  const cellMap = new Map<string, HealthCell>();
  if (data) {
    for (const cell of data.matrix) {
      cellMap.set(`${cell.platform}:${cell.scraperType}`, cell);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scraper Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-platform scraper status at a glance
            {lastRefresh && <span> &middot; Updated {timeAgo(lastRefresh.toISOString())}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/system-admin/scraper">
            <Button variant="outline" size="sm">
              Manage Scrapers <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchHealth(); }} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold text-green-600">{data.summary.healthy}</div>
              <div className="text-sm text-muted-foreground mt-1">Healthy</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold text-red-600">{data.summary.failed}</div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </CardContent>
          </Card>
          <Card
            className={data.summary.stale > 0 || (data.staleRuns?.length ?? 0) > 0 ? "cursor-pointer hover:ring-2 hover:ring-yellow-300 transition-all" : ""}
            onClick={() => {
              if (data.summary.stale > 0 || (data.staleRuns?.length ?? 0) > 0) {
                staleRunsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          >
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold text-yellow-600">{Math.max(data.summary.stale, data.staleRuns?.length ?? 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Stale / Stuck</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold text-blue-600">{data.summary.running}</div>
              <div className="text-sm text-muted-foreground mt-1">Running</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold">{data.summary.totalScheduled}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Scheduled</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Matrix */}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Health Matrix</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] sticky left-0 bg-background z-10 text-sm">Platform</TableHead>
                    {HEALTH_SCRAPER_TYPES.map((type) => (
                      <TableHead key={type} className="text-center min-w-[130px] text-sm">
                        {SCRAPER_TYPE_LABELS[type]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PLATFORM_IDS.map((platformId) => (
                    <TableRow key={platformId}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PLATFORM_COLORS[platformId] }}
                          />
                          <span className="text-sm font-medium">{PLATFORM_LABELS[platformId]}</span>
                        </div>
                      </TableCell>
                      {HEALTH_SCRAPER_TYPES.map((scraperType) => {
                        const cell = cellMap.get(`${platformId}:${scraperType}`);
                        if (!cell) return <TableCell key={scraperType} />;
                        const status = getCellStatus(cell);
                        const trend = getDurationTrend(cell);

                        return (
                          <TableCell key={scraperType} className="text-center p-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`rounded-md px-2 py-2 cursor-default transition-colors ${
                                  status === "red" ? "bg-red-50" :
                                  status === "yellow" ? "bg-yellow-50" :
                                  status === "blue" ? "bg-blue-50" :
                                  status === "gray" ? "bg-gray-50 dark:bg-gray-900/30" : ""
                                }`}>
                                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]} ring-2 ${STATUS_RING[status]}`} />
                                    {cell.lastRun?.completedAt && status !== "gray" && (
                                      <span className="text-xs text-muted-foreground">
                                        {timeAgo(cell.lastRun.completedAt)}
                                      </span>
                                    )}
                                    {cell.currentlyRunning && cell.runningStartedAt && (
                                      <span className="text-xs text-blue-600">
                                        {timeAgo(cell.runningStartedAt)}
                                      </span>
                                    )}
                                    {status === "gray" && (
                                      <span className="text-xs text-muted-foreground">N/A</span>
                                    )}
                                  </div>
                                  {status !== "gray" && (
                                    <div className="flex items-center justify-center gap-1">
                                      {trend.text && (
                                        <span className="text-xs text-muted-foreground">{trend.text}</span>
                                      )}
                                      {trend.direction === "up" && <TrendingUp className="w-3 h-3 text-red-400" />}
                                      {trend.direction === "down" && <TrendingDown className="w-3 h-3 text-green-400" />}
                                      {cell.lastRun?.itemsScraped != null && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          {cell.lastRun.itemsScraped}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <CellTooltip cell={cell} status={status} />
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smoke Test Panel */}
      <SmokeTestPanel onComplete={refreshSmokeHistory} history={smokeHistory} />

      {/* Smoke Test History — last 10 runs success ratio */}
      <SmokeTestHistory history={smokeHistory} />

      {/* Stale / Stuck Runs */}
      {data && (data.staleRuns?.length ?? 0) > 0 && (
        <div ref={staleRunsRef}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-yellow-600 flex items-center gap-2">
                  <Skull className="h-4 w-4" /> Stale / Stuck Runs ({data.staleRuns!.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleKillAllStale}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Kill All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm">Platform</TableHead>
                    <TableHead className="text-sm">Type</TableHead>
                    <TableHead className="text-sm">Running For</TableHead>
                    <TableHead className="text-sm">Started</TableHead>
                    <TableHead className="text-sm">Triggered By</TableHead>
                    <TableHead className="text-sm">Job ID</TableHead>
                    <TableHead className="text-sm text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.staleRuns!.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[run.platform as PlatformId] || "#888" }} />
                          <span className="text-sm font-medium">{PLATFORM_LABELS[run.platform as PlatformId] || run.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{SCRAPER_TYPE_LABELS[run.scraperType] || run.scraperType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-mono ${run.runningSecs > 3600 ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                          {run.runningSecs > 3600
                            ? `${Math.floor(run.runningSecs / 3600)}h ${Math.floor((run.runningSecs % 3600) / 60)}m`
                            : `${Math.floor(run.runningSecs / 60)}m ${run.runningSecs % 60}s`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.startedAt ? timeAgo(run.startedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{run.triggeredBy || "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{run.jobId || run.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleKillRun(run.id)}
                          disabled={killingRun === run.id}
                        >
                          {killingRun === run.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" /> Kill</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom panels: Recent Failures, Duration Anomalies, Active Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Failures */}
        {data && data.recentFailures.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Recent Failures (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentFailures.map((f) => (
                <RecentFailureCard
                  key={f.id}
                  failure={f}
                  retrying={retrying === f.id}
                  onRetry={() => handleRetry(f.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Duration Anomalies */}
        {data && data.anomalies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-yellow-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Duration Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.anomalies.map((a) => (
                <div key={`${a.platform}:${a.scraperType}`} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PLATFORM_COLORS[a.platform as PlatformId] || "#888" }}
                    />
                    <span className="font-medium">{PLATFORM_LABELS[a.platform as PlatformId] || a.platform}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {SCRAPER_TYPE_LABELS[a.scraperType] || a.scraperType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatDuration(a.lastDurationMs)} vs avg {formatDuration(a.avgDurationMs)}
                    </span>
                    <span className={`font-medium ${a.changePercent > 0 ? "text-red-600" : "text-green-600"}`}>
                      {a.changePercent > 0 ? "+" : ""}{a.changePercent}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active Jobs */}
        {data && data.matrix.some((c) => c.currentlyRunning) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-blue-600">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.matrix
                .filter((c) => c.currentlyRunning)
                .map((c) => (
                  <div key={`${c.platform}:${c.scraperType}`} className="flex items-center justify-between border rounded-md p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="font-medium">{PLATFORM_LABELS[c.platform as PlatformId] || c.platform}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {SCRAPER_TYPE_LABELS[c.scraperType] || c.scraperType}
                      </Badge>
                    </div>
                    {c.runningStartedAt && (
                      <span className="text-sm text-muted-foreground">
                        Started {timeAgo(c.runningStartedAt)}
                      </span>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="text-center py-12 text-muted-foreground">Loading health data...</div>
      )}
    </div>
  );
}

function failureToRunInfo(f: HealthData["recentFailures"][0]): RunInfo {
  return {
    id: f.id,
    platform: f.platform,
    scraperType: f.scraperType,
    status: "failed",
    triggeredBy: f.triggeredBy ?? undefined,
    queue: f.queue ?? undefined,
    jobId: f.jobId ?? undefined,
    startedAt: f.startedAt,
    completedAt: f.completedAt,
    error: f.error,
    metadata: {
      duration_ms: f.durationMs ?? undefined,
      items_scraped: f.itemsScraped ?? undefined,
      items_failed: f.itemsFailed ?? undefined,
    },
  };
}

function RecentFailureCard({
  failure: f,
  retrying,
  onRetry,
}: {
  failure: HealthData["recentFailures"][0];
  retrying: boolean;
  onRetry: () => void;
}) {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [expanded, setExpanded] = useState(false);
  const [itemErrors, setItemErrors] = useState<any[] | null>(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const hasItemErrors = (f.itemsFailed ?? 0) > 0;

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && hasItemErrors && itemErrors === null && !loadingErrors) {
      setLoadingErrors(true);
      try {
        const res = await fetchWithAuth(`/api/system-admin/scraper/runs/${f.id}/item-errors`);
        if (res.ok) {
          const data = await res.json();
          setItemErrors(data.errors);
        }
      } catch { /* ignore */ }
      setLoadingErrors(false);
    }
  };

  return (
    <div className="border rounded-md text-sm">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: PLATFORM_COLORS[f.platform as PlatformId] || "#888" }}
          />
          <span className="font-medium">{PLATFORM_LABELS[f.platform as PlatformId] || f.platform}</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {SCRAPER_TYPE_LABELS[f.scraperType] || f.scraperType}
          </Badge>
          {hasItemErrors && (
            <span className="text-xs text-orange-600">
              ({f.itemsFailed} items failed)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {f.completedAt && timeAgo(f.completedAt)}
          </span>
          <CopyReportButton
            getReport={() => buildRunReport(failureToRunInfo(f), itemErrors || undefined)}
            className="flex items-center h-7 px-2 border rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy debug report"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-sm px-3"
            disabled={retrying}
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
          >
            {retrying ? "..." : "Retry"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Run info grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs px-5">
            <span className="text-muted-foreground">Run ID</span>
            <span className="font-mono">{f.id}</span>
            {f.jobId && (
              <>
                <span className="text-muted-foreground">Job ID</span>
                <span className="font-mono">{f.jobId}</span>
              </>
            )}
            <span className="text-muted-foreground">Completed</span>
            <span>{f.completedAt ? formatDateTime(f.completedAt) : "N/A"}</span>
            <span className="text-muted-foreground">Duration</span>
            <span>{f.durationMs ? formatDuration(f.durationMs) : "N/A"}</span>
            {f.itemsScraped != null && (
              <>
                <span className="text-muted-foreground">Items</span>
                <span>
                  {f.itemsScraped} scraped
                  {(f.itemsFailed ?? 0) > 0 && <span className="text-destructive ml-1">({f.itemsFailed} failed)</span>}
                </span>
              </>
            )}
          </div>

          {/* Run error */}
          {f.error && <ErrorBlock error={f.error} />}

          {/* Item errors */}
          {hasItemErrors && (
            <div className="px-5">
              <div className="text-xs font-medium text-orange-600 mb-1">Failed Items</div>
              {loadingErrors ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </div>
              ) : itemErrors && itemErrors.length > 0 ? (
                <div className="space-y-1.5">
                  {itemErrors.map((err: any) => (
                    <div key={err.id} className="border border-orange-200 bg-orange-50/50 rounded p-2 text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-medium text-orange-700">{err.itemIdentifier}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{err.itemType}</Badge>
                      </div>
                      {err.url && <div className="text-muted-foreground truncate" title={err.url}>{err.url}</div>}
                      <div className="text-destructive mt-0.5">{err.errorMessage}</div>
                    </div>
                  ))}
                </div>
              ) : itemErrors && itemErrors.length === 0 ? (
                <div className="text-xs text-muted-foreground">No detailed error records</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="relative group">
      <pre className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 font-mono whitespace-pre-wrap break-words max-h-[7.5rem] overflow-y-auto">
        {error}
      </pre>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={error} variant="icon" size="xs" />
      </div>
    </div>
  );
}

function CellTooltip({ cell, status }: { cell: HealthCell; status: CellStatus }) {
  if (status === "gray") {
    return <div className="text-sm">Not scheduled for this platform</div>;
  }

  return (
    <div className="space-y-1.5 text-sm">
      <div className="font-medium">
        {PLATFORM_LABELS[cell.platform as PlatformId]} &middot; {SCRAPER_TYPE_LABELS[cell.scraperType]}
      </div>

      {cell.lastRun && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <span className={cell.lastRun.status === "failed" ? "text-red-600" : "text-green-600"}>
              {STATUS_LABEL_MAP[status] || cell.lastRun.status}
            </span>
          </div>
          {cell.lastRun.jobId && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Job ID</span>
              <span className="font-mono">{cell.lastRun.jobId}</span>
            </div>
          )}
          {cell.lastRun.completedAt && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Completed</span>
              <span>{new Date(cell.lastRun.completedAt).toLocaleString()}</span>
            </div>
          )}
          {cell.lastRun.durationMs != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Duration</span>
              <span>{formatDuration(cell.lastRun.durationMs)}</span>
            </div>
          )}
          {cell.lastRun.itemsScraped != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Items</span>
              <span>
                {cell.lastRun.itemsScraped} scraped
                {cell.lastRun.itemsFailed ? `, ${cell.lastRun.itemsFailed} failed` : ""}
              </span>
            </div>
          )}
          {cell.lastRun.error && (
            <div className="text-red-600 break-words max-w-[250px]">
              {cell.lastRun.error.length > 150
                ? cell.lastRun.error.slice(0, 150) + "..."
                : cell.lastRun.error}
            </div>
          )}
        </>
      )}

      {cell.avgDurationMs != null && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Avg Duration (5 runs)</span>
          <span>{formatDuration(cell.avgDurationMs)}</span>
        </div>
      )}

      {cell.currentlyRunning && cell.runningStartedAt && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Running since</span>
          <span>{new Date(cell.runningStartedAt).toLocaleString()}</span>
        </div>
      )}

      {cell.schedule && (
        <>
          <div className="border-t pt-1 mt-1" />
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Schedule</span>
            <span className="font-mono">{cell.schedule.cron}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Next run</span>
            <span>{new Date(cell.schedule.nextRunAt).toLocaleString()}</span>
          </div>
        </>
      )}

      {cell.lastRun && (
        <div className="border-t pt-1.5 mt-1.5">
          <CopyReportButton
            getReport={() => buildHealthCellReport({
              platform: cell.platform,
              scraperType: cell.scraperType,
              status: cell.lastRun?.status,
              error: cell.lastRun?.error,
              durationMs: cell.lastRun?.durationMs,
              completedAt: cell.lastRun?.completedAt,
              runId: cell.lastRun?.runId,
              jobId: cell.lastRun?.jobId,
              itemsScraped: cell.lastRun?.itemsScraped,
              itemsFailed: cell.lastRun?.itemsFailed,
            })}
            label="Copy Report"
          />
        </div>
      )}
    </div>
  );
}
