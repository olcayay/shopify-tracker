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
  Copy,
  Check,
} from "lucide-react";
import { useFormatDate } from "@/lib/format-date";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";

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
  onPageChange: (page: number) => void;
  onFilterTypeChange: (type: string) => void;
  onFilterTriggerChange: (trigger: string) => void;
  onFilterQueueChange: (queue: string) => void;
  onFilterPlatformChange: (platform: string) => void;
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
  onPageChange,
  onFilterTypeChange,
  onFilterTriggerChange,
  onFilterQueueChange,
  onFilterPlatformChange,
  onRetry,
  onRefresh,
  retryingRunId,
}: RunHistoryTableProps) {
  const { formatDateTime } = useFormatDate();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const totalPages = Math.ceil(total / PAGE_SIZE);

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
              <TableHead>Job ID</TableHead>
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
              <TableHead>Assets</TableHead>
              <TableHead className="w-10" />
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
                    if (run.error || (run.assets && run.assets.length > 0)) {
                      setExpandedRunId(expandedRunId === run.id ? null : run.id);
                    }
                  }}
                >
                  <TableCell className="w-8 pr-0">
                    {(run.error || (run.assets && run.assets.length > 0)) &&
                      (expandedRunId === run.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {run.jobId || <span className="text-muted-foreground">{"\u2014"}</span>}
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
                    <TableCell colSpan={14} className="bg-muted/30 p-4">
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
                          <div className="text-sm font-medium text-orange-600 mb-1">
                            Fallback Details
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
                        !run.metadata?.fallback_used &&
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
                  colSpan={14}
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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-md whitespace-pre-wrap break-words max-h-[7.5rem] overflow-y-auto">
        {error}
      </pre>
      <button
        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
