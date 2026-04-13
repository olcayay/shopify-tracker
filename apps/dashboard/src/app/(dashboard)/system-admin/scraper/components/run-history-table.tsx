"use client";

import { useState } from "react";
import Link from "next/link";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
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
  RefreshCw,
  RotateCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useFormatDate } from "@/lib/format-date";
import { formatDuration } from "@/lib/format-utils";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { buildItemReport, buildRunReport, buildFallbackReport, type RunInfo } from "@/lib/scraper-report";
import { CopyButton } from "@/components/ui/copy-button";
import { CopyReportButton } from "@/components/copy-report-button";

const PAGE_SIZE = 20;

const SCRAPER_TYPES = [
  { type: "category", label: "Categories" },
  { type: "app_details", label: "App Details" },
  { type: "keyword_search", label: "Keywords" },
  { type: "reviews", label: "Reviews" },
  { type: "daily_digest", label: "Daily Digest" },
  { type: "compute_review_metrics", label: "Review Metrics" },
  { type: "compute_similarity_scores", label: "Similarity Scores" },
  { type: "backfill_categories", label: "Backfill Categories" },
  { type: "compute_app_scores", label: "App Scores" },
];

interface RunHistoryTableProps {
  runs: any[];
  total: number;
  page: number;
  filterType: string;
  filterTrigger: string;
  filterQueue: string;
  filterPlatform: string;
  filterStatus: string;
  onPageChange: (page: number) => void;
  onFilterTypeChange: (type: string) => void;
  onFilterTriggerChange: (trigger: string) => void;
  onFilterQueueChange: (queue: string) => void;
  onFilterPlatformChange: (platform: string) => void;
  onFilterStatusChange: (status: string) => void;
  onRetry: (runId: string) => void;
  onRefresh: () => void;
  retryingRunId: string | null;
}

export function RunHistoryTable({
  runs,
  total,
  page,
  filterType,
  filterTrigger,
  filterQueue,
  filterPlatform,
  filterStatus,
  onPageChange,
  onFilterTypeChange,
  onFilterTriggerChange,
  onFilterQueueChange,
  onFilterPlatformChange,
  onFilterStatusChange,
  onRetry,
  onRefresh,
  retryingRunId,
}: RunHistoryTableProps) {
  const { formatDateTime } = useFormatDate();
  const { fetchWithAuth } = useAuth();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, any[]>>({});
  const [loadingErrors, setLoadingErrors] = useState<string | null>(null);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const isExpandable = (run: any) =>
    run.error || (run.assets && run.assets.length > 0) || run.hasItemErrors;

  const loadItemErrors = async (runId: string) => {
    if (itemErrors[runId]) return;
    setLoadingErrors(runId);
    try {
      const res = await fetchWithAuth(`/api/system-admin/scraper/runs/${runId}/item-errors`);
      if (res.ok) {
        const data = await res.json();
        setItemErrors((prev) => ({ ...prev, [runId]: data.errors }));
      }
    } catch {
      // ignore
    }
    setLoadingErrors(null);
  };

  const handleRowClick = (run: any) => {
    if (!isExpandable(run)) return;
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
    } else {
      setExpandedRunId(run.id);
      if (run.hasItemErrors && !itemErrors[run.id]) {
        loadItemErrors(run.id);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Run History</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value)}
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
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>
            <select
              value={filterTrigger}
              onChange={(e) => onFilterTriggerChange(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
            >
              <option value="">All triggers</option>
              <option value="scheduler">Scheduler</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={filterQueue}
              onChange={(e) => onFilterQueueChange(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
            >
              <option value="">All queues</option>
              <option value="interactive">Interactive</option>
              <option value="background">Background</option>
            </select>
            {/* Platform filter using pill badges */}
            <div className="flex items-center gap-1">
              {filterPlatform ? (
                <Badge
                  variant="default"
                  className="text-xs cursor-pointer"
                  style={{ backgroundColor: PLATFORM_COLORS[filterPlatform as PlatformId] }}
                  onClick={() => onFilterPlatformChange("")}
                >
                  {PLATFORM_LABELS[filterPlatform as PlatformId] || filterPlatform} &times;
                </Badge>
              ) : (
                <select
                  value={filterPlatform}
                  onChange={(e) => onFilterPlatformChange(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                >
                  <option value="">All platforms</option>
                  {(Object.keys(PLATFORMS) as PlatformId[]).map((pid) => (
                    <option key={pid} value={pid}>
                      {PLATFORMS[pid].name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
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
              <TableHead title="Canonical scrape_runs.id (UUID); BullMQ job id shown below recycles after Redis eviction or restart.">
                Run
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fallback</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Triggered By</TableHead>
              <TableHead>Queued</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run: any) => (
              <>
                <TableRow
                  key={run.id}
                  className={isExpandable(run) ? "cursor-pointer" : ""}
                  onClick={() => handleRowClick(run)}
                >
                  <TableCell className="w-8 pr-0">
                    {isExpandable(run) &&
                      (expandedRunId === run.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div title={run.id}>{String(run.id).slice(0, 8)}</div>
                    {run.jobId ? (
                      <div className="text-[10px] text-muted-foreground">bullmq:{run.jobId}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {run.scraperType}
                  </TableCell>
                  <TableCell className="text-sm">
                    {run.platform ? (
                      <Badge
                        variant="outline"
                        className="text-xs cursor-pointer"
                        style={{ borderColor: PLATFORM_COLORS[run.platform as PlatformId], color: PLATFORM_COLORS[run.platform as PlatformId] }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilterPlatformChange(run.platform);
                        }}
                      >
                        {PLATFORM_LABELS[run.platform as PlatformId] || run.platform}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.status === "completed" && run.metadata?.items_failed > 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-600 border-orange-200"
                      >
                        partial
                      </Badge>
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell>
                    {run.metadata?.fallback_used ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-orange-50 text-orange-600 border-orange-200"
                      >
                        Fallback
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.queue ? (
                      <Badge variant="outline" className="text-[10px]">
                        {run.queue}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
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
                      ? formatDuration(run.metadata.duration_ms)
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {run.metadata?.items_scraped != null ? (
                      <span>
                        {run.metadata.items_scraped} scraped
                        {run.metadata.items_skipped_fresh > 0 && (
                          <span className="text-muted-foreground ml-1">
                            · {run.metadata.items_skipped_fresh} skipped
                          </span>
                        )}
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
                  <TableCell className="text-sm max-w-[200px]">
                    {run.error ? (
                      <span
                        className="text-destructive text-xs truncate block cursor-help"
                        title={run.error}
                      >
                        {run.error.length > 60 ? run.error.slice(0, 60) + "..." : run.error}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
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
                  <TableCell>
                    {(run.status === "failed" || run.status === "completed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={retryingRunId === String(run.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(String(run.id));
                        }}
                        title="Retry this run"
                      >
                        <RotateCw
                          className={`h-3.5 w-3.5 ${retryingRunId === String(run.id) ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {expandedRunId === run.id && (
                  <TableRow key={`${run.id}-details`}>
                    <TableCell colSpan={15} className="bg-muted/30 p-4">
                      {run.error && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-destructive mb-1">
                            Error
                          </div>
                          <CopyableError error={run.error} />
                        </div>
                      )}
                      {run.metadata?.fallback_used && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-orange-600">
                              Fallback Details
                            </span>
                            <CopyReportButton
                              getReport={() => buildFallbackReport(toRunInfo(run))}
                              label="Copy"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {run.metadata.fallback_count} fallback{run.metadata.fallback_count !== 1 ? "s" : ""} used
                            {run.metadata.fallback_contexts && (
                              <ul className="mt-1 list-disc list-inside">
                                {run.metadata.fallback_contexts.map((ctx: string, i: number) => (
                                  <li key={i} className="font-mono">{ctx}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                      {run.assets && run.assets.length > 0 && (
                        <div className="mb-3">
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
                      {/* Per-item errors */}
                      {run.hasItemErrors && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium text-orange-600">
                              Failed Items ({run.metadata?.items_failed ?? 0})
                            </span>
                            {itemErrors[run.id] && itemErrors[run.id].length > 0 && (
                              <CopyReportButton
                                getReport={() => buildRunReport(toRunInfo(run), itemErrors[run.id])}
                                label="Copy All"
                                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 transition-colors ml-auto"
                              />
                            )}
                          </div>
                          {loadingErrors === run.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading error details...
                            </div>
                          ) : itemErrors[run.id] ? (
                            <div className="space-y-2">
                              {itemErrors[run.id].map((err: any) => (
                                <ItemErrorCard key={err.id} run={run} error={err} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {!run.error &&
                        !run.metadata?.fallback_used &&
                        (!run.assets || run.assets.length === 0) &&
                        !run.hasItemErrors && (
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
                  colSpan={15}
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
                onClick={() => onPageChange(page - 1)}
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
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CopyableError({ error }: { error: string }) {
  return (
    <div className="relative group">
      <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-md whitespace-pre-wrap break-words max-h-[7.5rem] overflow-y-auto">
        {error}
      </pre>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={error} variant="icon" size="xs" />
      </div>
    </div>
  );
}

function toRunInfo(run: any): RunInfo {
  return {
    id: run.id,
    platform: run.platform,
    scraperType: run.scraperType,
    status: run.status,
    triggeredBy: run.triggeredBy,
    queue: run.queue,
    jobId: run.jobId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    metadata: run.metadata,
  };
}

function ItemErrorCard({ run, error }: { run: any; error: any }) {
  const [showStack, setShowStack] = useState(false);

  return (
    <div className="border border-orange-200 bg-orange-50/50 rounded-md p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-medium text-orange-700">
              {error.itemIdentifier}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
              {error.itemType}
            </Badge>
          </div>
          {error.url && (
            <div className="text-muted-foreground truncate mb-1" title={error.url}>
              {error.url}
            </div>
          )}
          <div className="text-destructive mt-1">{error.errorMessage}</div>
          {error.stackTrace && (
            <div className="mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowStack(!showStack); }}
                className="text-muted-foreground hover:text-foreground underline"
              >
                {showStack ? "Hide stack trace" : "Show stack trace"}
              </button>
              {showStack && (
                <pre className="mt-1 p-2 bg-muted rounded text-[10px] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {error.stackTrace}
                </pre>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {error.linearIssueUrl && (
            <a
              href={error.linearIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 transition-colors"
              title={`Linear: ${error.linearIssueId}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <CopyReportButton
            getReport={() => buildItemReport(toRunInfo(run), error)}
            className="shrink-0 p-1.5 rounded hover:bg-orange-100 text-orange-600 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

