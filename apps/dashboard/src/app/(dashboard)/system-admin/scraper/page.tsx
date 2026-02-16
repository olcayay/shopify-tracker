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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const SCRAPER_TYPES = [
  {
    type: "category",
    label: "Categories",
    description: "Scrape Shopify app categories tree",
  },
  {
    type: "app_details",
    label: "App Details",
    description: "Scrape tracked app details and snapshots",
  },
  {
    type: "keyword_search",
    label: "Keywords",
    description: "Search tracked keywords and record rankings",
  },
  {
    type: "reviews",
    label: "Reviews",
    description: "Scrape reviews for tracked apps",
  },
];

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ScraperPage() {
  const { fetchWithAuth } = useAuth();
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

  // Build freshness map
  const freshnessMap = new Map<string, any>();
  if (stats?.freshness) {
    for (const f of stats.freshness) {
      freshnessMap.set(f.scraperType, f);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
      {queueStatus &&
        (queueStatus.counts.waiting > 0 ||
          queueStatus.counts.active > 0) && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Queue Status</CardTitle>
            </CardHeader>
            <CardContent>
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
              {queueStatus.jobs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Queued At</TableHead>
                      <TableHead>Details</TableHead>
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
                            ? formatDate(job.createdAt)
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
                {freshness?.lastCompletedAt ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Last run:</span>
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
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Never run
                  </span>
                )}
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
                      {run.createdAt ? formatDate(run.createdAt) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.startedAt ? formatDate(run.startedAt) : "\u2014"}
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
                          ? run.assets.join(", ")
                          : `${run.assets.slice(0, 2).join(", ")} +${run.assets.length - 2}`
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
                                (asset: string, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {asset}
                                  </Badge>
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
    </div>
  );
}
