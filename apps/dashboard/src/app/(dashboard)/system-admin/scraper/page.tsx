"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { useFormatDate } from "@/lib/format-date";

function utcToLocal(utcHour: number): string {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSchedule(cronHours: number[] | null, prefix?: string): string {
  if (!cronHours) return prefix ?? "";
  const localTimes = cronHours.map(utcToLocal);
  if (cronHours.length === 1) return `Daily at ${localTimes[0]}`;
  return `Every ${Math.round(24 / cronHours.length)}h (${localTimes.join(", ")})`;
}

const SCRAPER_TYPES = [
  {
    type: "category",
    label: "Categories",
    description: "Scrape Shopify app categories tree",
    cronHours: [3],
  },
  {
    type: "app_details",
    label: "App Details",
    description: "Scrape tracked app details and snapshots",
    cronHours: [1, 13],
  },
  {
    type: "keyword_search",
    label: "Keywords",
    description: "Search tracked keywords and record rankings",
    cronHours: [0, 12],
  },
  {
    type: "reviews",
    label: "Reviews",
    description: "Scrape reviews for tracked apps (+ computes review metrics)",
    cronHours: [6],
  },
  {
    type: "daily_digest",
    label: "Daily Digest",
    description: "Send ranking report emails to users",
    cronHours: [5],
  },
  {
    type: "compute_review_metrics",
    label: "Review Metrics",
    description: "Compute review velocity & acceleration for tracked apps",
    cronHours: null,
    scheduleLabel: "Auto (after reviews scraper)",
  },
];

function getNextRun(cronHours: number[] | null): string | null {
  if (!cronHours) return null;
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();

  // Find next matching hour today
  for (const ch of cronHours) {
    if (ch > h || (ch === h && m === 0)) {
      const next = new Date(now);
      next.setUTCHours(ch, 0, 0, 0);
      return formatRelativeTime(next.getTime() - now.getTime());
    }
  }

  // Tomorrow at first hour
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(cronHours[0], 0, 0, 0);
  return formatRelativeTime(next.getTime() - now.getTime());
}

function formatRelativeTime(ms: number): string {
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 1) return "now";
  if (totalMins < 60) return `in ${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `in ${hours}h`;
  return `in ${hours}h ${mins}m`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

const PAGE_SIZE = 20;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ScraperPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [stats, setStats] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterTrigger, setFilterTrigger] = useState<string>("");
  const [page, setPage] = useState(0);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [drainConfirm, setDrainConfirm] = useState(false);
  const [clearFailedConfirm, setClearFailedConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterType, filterTrigger, page]);

  async function loadData() {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterTrigger) params.set("triggeredBy", filterTrigger);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    const [statsRes, runsRes, queueRes] = await Promise.all([
      fetchWithAuth("/api/system-admin/stats"),
      fetchWithAuth(`/api/system-admin/scraper/runs?${params.toString()}`),
      fetchWithAuth("/api/system-admin/scraper/queue"),
    ]);

    if (statsRes.ok) setStats(await statsRes.json());
    if (runsRes.ok) {
      const data = await runsRes.json();
      setRuns(data.runs);
      setTotal(data.total);
    }
    if (queueRes.ok) setQueueStatus(await queueRes.json());
  }

  async function triggerScraper(type: string) {
    setTriggering(type);
    setMessage("");
    const res = await fetchWithAuth("/api/system-admin/scraper/trigger", {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      setMessage(`Scraper "${type}" triggered`);
      setTimeout(loadData, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to trigger scraper");
    }
    setTriggering(null);
  }

  async function togglePause() {
    const endpoint = queueStatus?.isPaused
      ? "/api/system-admin/scraper/queue/resume"
      : "/api/system-admin/scraper/queue/pause";
    const res = await fetchWithAuth(endpoint, { method: "POST" });
    if (res.ok) {
      setMessage(queueStatus?.isPaused ? "Queue resumed" : "Queue paused");
      loadData();
    }
  }

  async function removeJob(jobId: string) {
    const res = await fetchWithAuth(
      `/api/system-admin/scraper/queue/jobs/${jobId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`Job ${jobId} removed`);
      loadData();
    }
  }

  async function drainQueue() {
    const res = await fetchWithAuth(
      "/api/system-admin/scraper/queue/jobs",
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage("All waiting jobs removed");
      setDrainConfirm(false);
      loadData();
    }
  }

  async function clearFailedJobs() {
    const res = await fetchWithAuth(
      "/api/system-admin/scraper/queue/failed",
      { method: "DELETE" }
    );
    if (res.ok) {
      const data = await res.json();
      setMessage(`${data.removed} failed job(s) removed`);
      setClearFailedConfirm(false);
      loadData();
    }
  }

  // Build freshness map
  const freshnessMap = new Map<string, any>();
  if (stats?.freshness) {
    for (const f of stats.freshness) {
      freshnessMap.set(f.scraperType, f);
    }
  }

  // Build worker stats map (avg duration & items from last 3 scheduler runs)
  const workerStatsMap = new Map<string, { avg_duration_ms: number; avg_items: number }>();
  if (stats?.workerStats) {
    for (const w of stats.workerStats) {
      workerStatsMap.set(w.scraper_type, w);
    }
  }

  // Asset count per scraper type (what it will process next)
  const assetCountMap: Record<string, { count: number; label: string }> = stats
    ? {
        category: { count: stats.totalCategories ?? 0, label: "categories" },
        app_details: { count: stats.trackedApps ?? 0, label: "apps" },
        keyword_search: { count: stats.trackedKeywords ?? 0, label: "keywords" },
        reviews: { count: stats.trackedApps ?? 0, label: "apps" },
        daily_digest: { count: stats.users ?? 0, label: "users" },
        compute_review_metrics: { count: stats.trackedApps ?? 0, label: "apps" },
      }
    : {};

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasQueueJobs =
    queueStatus &&
    (queueStatus.counts.waiting > 0 ||
      queueStatus.counts.active > 0 ||
      queueStatus.counts.delayed > 0 ||
      queueStatus.counts.failed > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Scraper"}
        </p>
        <h1 className="text-2xl font-bold">Scraper Management</h1>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* Queue Status */}
      {queueStatus && (
        <Card className={queueStatus.isPaused ? "border-yellow-300 bg-yellow-50/50" : hasQueueJobs ? "border-blue-200 bg-blue-50/50" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Queue Status
                {queueStatus.isPaused && (
                  <Badge variant="secondary" className="ml-2">Paused</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={togglePause}
                >
                  {queueStatus.isPaused ? (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </>
                  )}
                </Button>
                {queueStatus.counts.waiting > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setDrainConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear Waiting
                  </Button>
                )}
                {queueStatus.counts.failed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setClearFailedConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear Failed
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasQueueJobs ? (
            <div className="flex gap-4 mb-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Active:</span>{" "}
                <Badge variant="secondary">
                  {queueStatus.counts.active}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Waiting:</span>{" "}
                <Badge variant="outline">
                  {queueStatus.counts.waiting}
                </Badge>
              </div>
              {queueStatus.counts.delayed > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Delayed:</span>{" "}
                  <Badge variant="outline">
                    {queueStatus.counts.delayed}
                  </Badge>
                </div>
              )}
              {queueStatus.counts.failed > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Failed:</span>{" "}
                  <Badge variant="destructive">
                    {queueStatus.counts.failed}
                  </Badge>
                </div>
              )}
            </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">Queue is empty — no jobs waiting or running.</p>
            )}
            {queueStatus.jobs.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Queued At</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueStatus.jobs.map((job: any) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">
                        {job.id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {job.type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            job.status === "active"
                              ? "secondary"
                              : job.status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.createdAt
                          ? formatDateTime(job.createdAt)
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.data?.slug && (
                          <span className="text-muted-foreground">
                            app: {job.data.slug}
                          </span>
                        )}
                        {job.data?.keyword && (
                          <span className="text-muted-foreground">
                            keyword: {job.data.keyword}
                          </span>
                        )}
                        {job.failedReason && (
                          <span className="text-destructive text-xs">
                            {job.failedReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.status !== "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeJob(job.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scraper Types with Trigger + Freshness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCRAPER_TYPES.map((s) => {
          const freshness = freshnessMap.get(s.type);
          const wStats = workerStatsMap.get(s.type);
          const asset = assetCountMap[s.type];
          return (
            <Card key={s.type}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerScraper(s.type)}
                    disabled={triggering !== null}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {triggering === s.type ? "Triggering..." : "Run"}
                  </Button>
                </div>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Schedule:</span>
                    <span>{formatSchedule(s.cronHours, (s as any).scheduleLabel)}</span>
                  </div>
                  {s.cronHours && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Next run:</span>
                      <span>{getNextRun(s.cronHours)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Last run:</span>
                    {freshness?.lastCompletedAt ? (
                      <Badge
                        variant={
                          Date.now() -
                            new Date(freshness.lastCompletedAt).getTime() <
                          24 * 60 * 60 * 1000
                            ? "default"
                            : Date.now() -
                                  new Date(
                                    freshness.lastCompletedAt
                                  ).getTime() <
                                72 * 60 * 60 * 1000
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {timeAgo(freshness.lastCompletedAt)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </div>
                  {asset && asset.count > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Assets:</span>
                      <span>{asset.count} {asset.label}</span>
                    </div>
                  )}
                  {wStats?.avg_duration_ms != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Avg duration:</span>
                      <span>{formatDuration(wStats.avg_duration_ms)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Run History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Run History</CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(0);
                }}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              >
                <option value="">All types</option>
                {SCRAPER_TYPES.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={filterTrigger}
                onChange={(e) => {
                  setFilterTrigger(e.target.value);
                  setPage(0);
                }}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              >
                <option value="">All triggers</option>
                <option value="scheduler">Scheduler</option>
                <option value="manual">Manual</option>
              </select>
              <Button variant="ghost" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Queued</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Assets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run: any) => (
                <>
                  <TableRow
                    key={run.id}
                    className={
                      run.error || (run.assets && run.assets.length > 0)
                        ? "cursor-pointer"
                        : ""
                    }
                    onClick={() => {
                      if (
                        run.error ||
                        (run.assets && run.assets.length > 0)
                      ) {
                        setExpandedRunId(
                          expandedRunId === run.id ? null : run.id
                        );
                      }
                    }}
                  >
                    <TableCell className="w-8 pr-0">
                      {(run.error ||
                        (run.assets && run.assets.length > 0)) &&
                        (expandedRunId === run.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ))}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {run.scraperType}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "running"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.triggeredBy ? (
                        run.triggeredBy === "scheduler" ? (
                          <Badge variant="outline" className="text-xs">
                            scheduler
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {run.triggeredBy}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.createdAt ? formatDateTime(run.createdAt) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.startedAt ? formatDateTime(run.startedAt) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.metadata?.duration_ms
                        ? `${(run.metadata.duration_ms / 1000).toFixed(1)}s`
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.metadata?.items_scraped != null ? (
                        <span>
                          {run.metadata.items_scraped} scraped
                          {run.metadata.items_failed > 0 && (
                            <span className="text-destructive ml-1">
                              ({run.metadata.items_failed} failed)
                            </span>
                          )}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.assets && run.assets.length > 0
                        ? run.assets.length <= 3
                          ? run.assets.map((a: any, i: number) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                <Link href={a.href} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {a.name}
                                </Link>
                              </span>
                            ))
                          : <>
                              {run.assets.slice(0, 2).map((a: any, i: number) => (
                                <span key={i}>
                                  {i > 0 && ", "}
                                  <Link href={a.href} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                    {a.name}
                                  </Link>
                                </span>
                              ))}
                              {` +${run.assets.length - 2}`}
                            </>
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                  {expandedRunId === run.id && (
                    <TableRow key={`${run.id}-details`}>
                      <TableCell colSpan={9} className="bg-muted/30 p-4">
                        {run.error && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-destructive mb-1">
                              Error
                            </div>
                            <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                              {run.error}
                            </pre>
                          </div>
                        )}
                        {run.assets && run.assets.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-1">
                              Scraped Assets ({run.assets.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {run.assets.map(
                                (asset: any, i: number) => (
                                  <Link key={i} href={asset.href}>
                                    <Badge
                                      variant="outline"
                                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                    >
                                      {asset.name}
                                    </Badge>
                                  </Link>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {!run.error &&
                          (!run.assets || run.assets.length === 0) && (
                            <p className="text-sm text-muted-foreground">
                              No additional details
                            </p>
                          )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No scraper runs yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {total} total runs
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={drainConfirm}
        title="Clear Waiting Jobs"
        description={`All ${queueStatus?.counts.waiting ?? 0} waiting jobs will be removed from the queue. Active jobs will not be affected. This action cannot be undone.`}
        confirmLabel="Clear All"
        onConfirm={drainQueue}
        onCancel={() => setDrainConfirm(false)}
      />

      <ConfirmModal
        open={clearFailedConfirm}
        title="Clear Failed Jobs"
        description={`All ${queueStatus?.counts.failed ?? 0} failed jobs will be removed from the queue. This action cannot be undone.`}
        confirmLabel="Clear All"
        onConfirm={clearFailedJobs}
        onCancel={() => setClearFailedConfirm(false)}
      />
    </div>
  );
}
