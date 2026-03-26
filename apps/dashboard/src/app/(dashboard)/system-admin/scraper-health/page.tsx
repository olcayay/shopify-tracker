"use client";

import { useEffect, useState, useCallback } from "react";
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
  Copy,
  Check,
} from "lucide-react";
import { SmokeTestPanel } from "./smoke-test-panel";
import { SmokeTestHistory, type SmokeHistoryEntry } from "../scraper/components/smoke-test-history";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS, HEALTH_SCRAPER_TYPES } from "@/lib/platform-display";

interface HealthCell {
  platform: string;
  scraperType: string;
  lastRun: {
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
    error: string;
    durationMs: number | null;
  }[];
  anomalies: {
    platform: string;
    scraperType: string;
    lastDurationMs: number;
    avgDurationMs: number;
    changePercent: number;
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
  gray: "bg-gray-300",
};

const STATUS_RING: Record<CellStatus, string> = {
  green: "ring-green-200",
  red: "ring-red-200",
  yellow: "ring-yellow-200",
  blue: "ring-blue-200 animate-pulse",
  gray: "ring-gray-100",
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
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRetry = async (runId: string) => {
    setRetrying(runId);
    try {
      await fetchWithAuth(`/api/system-admin/scraper/runs/${runId}/retry`, { method: "POST" });
      await fetchHealth();
    } finally {
      setRetrying(null);
    }
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
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="text-3xl font-bold text-yellow-600">{data.summary.stale}</div>
              <div className="text-sm text-muted-foreground mt-1">Stale</div>
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
                                  status === "gray" ? "bg-gray-50" : ""
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
                <div key={f.id} className="border rounded-md p-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[f.platform as PlatformId] || "#888" }}
                      />
                      <span className="font-medium">{PLATFORM_LABELS[f.platform as PlatformId] || f.platform}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {SCRAPER_TYPE_LABELS[f.scraperType] || f.scraperType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {f.completedAt && timeAgo(f.completedAt)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-sm px-3"
                        disabled={retrying === f.id}
                        onClick={() => handleRetry(f.id)}
                      >
                        {retrying === f.id ? "..." : "Retry"}
                      </Button>
                    </div>
                  </div>
                  {f.error && (
                    <ErrorBlock error={f.error} />
                  )}
                </div>
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

function ErrorBlock({ error }: { error: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 font-mono whitespace-pre-wrap break-words max-h-[7.5rem] overflow-y-auto">
        {error}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-red-100 hover:bg-red-200 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy error"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
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
              {cell.lastRun.status}
            </span>
          </div>
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
    </div>
  );
}
