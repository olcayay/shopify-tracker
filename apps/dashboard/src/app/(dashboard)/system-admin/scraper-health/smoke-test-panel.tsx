"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SMOKE_PLATFORMS,
  SMOKE_CHECKS,
  getSmokeCheck,
  type SmokeCheckName,
  type PlatformId,
} from "@appranks/shared";
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
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Minus,
  RotateCcw,
  Loader2,
  FlaskConical,
  Copy,
} from "lucide-react";
import {
  useSmokeTest,
  type CellResult,
  type CellStatus,
} from "./use-smoke-test";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { timeAgo } from "@/lib/format-utils";

const CHECK_LABELS: Record<SmokeCheckName, string> = {
  categories: "Categories",
  app: "App",
  keyword: "Keyword",
  reviews: "Reviews",
  featured: "Featured",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 100) / 10;
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = Math.round(secs % 60);
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
}

function formatTotalDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="text-sm text-blue-500 font-medium">{elapsed}s</span>;
}

function StatusCell({
  platform,
  check,
  result,
  isNA,
  onRetry,
  onRun,
  isExpanded,
  onToggleExpand,
  isRunning,
}: {
  platform: string;
  check: SmokeCheckName;
  result: CellResult | undefined;
  isNA: boolean;
  onRetry: () => void;
  onRun: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRunning: boolean;
}) {
  if (isNA) {
    return (
      <div className="flex items-center justify-center py-2">
        <Minus className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>
    );
  }

  const status = result?.status || "pending";

  return (
    <div
      className={`group/cell relative rounded-md px-2 py-2 transition-colors cursor-default ${
        status === "fail"
          ? "bg-red-50 cursor-pointer"
          : status === "running"
            ? "bg-blue-50"
            : ""
      }`}
      onClick={status === "fail" ? onToggleExpand : undefined}
    >
      <div className="flex items-center justify-center gap-1.5">
        {status === "pending" && (
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600/30" />
        )}
        {status === "running" && (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            {result?.startedAt && <ElapsedTimer startedAt={result.startedAt} />}
          </>
        )}
        {status === "pass" && (
          <>
            <Check className="w-4 h-4 text-green-600" />
            {result?.durationMs != null && (
              <span className="text-sm text-green-600">
                {formatDuration(result.durationMs)}
              </span>
            )}
          </>
        )}
        {status === "fail" && (
          <>
            <X className="w-4 h-4 text-red-600" />
            {result?.durationMs != null && (
              <span className="text-sm text-red-600">
                {formatDuration(result.durationMs)}
              </span>
            )}
          </>
        )}
      </div>
      {/* Cell-level run button — visible on hover when not running */}
      {!isRunning && status !== "running" && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover/cell:opacity-100 transition-opacity rounded-md"
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          title={`Run ${CHECK_LABELS[check]} for ${platform}`}
        >
          <Play className="w-3.5 h-3.5 text-blue-600" />
        </button>
      )}
    </div>
  );
}

function CopyableLog({ text, maxHeight = "max-h-48" }: { text: string; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className={`text-xs text-red-700 bg-red-100 rounded p-3 ${maxHeight} overflow-auto font-mono whitespace-pre-wrap break-words`}>
        {text.slice(-3000)}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded bg-red-200/80 hover:bg-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
        title={copied ? "Copied!" : "Copy log"}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-red-700" />}
      </button>
    </div>
  );
}

function FailureDetails({
  result,
  onRetry,
}: {
  result: CellResult;
  onRetry: () => void;
}) {
  const fullLog = [
    `Platform: ${result.platform}`,
    `Check: ${result.check}`,
    `Status: ${result.status}`,
    result.durationMs ? `Duration: ${formatDuration(result.durationMs)}` : null,
    result.error ? `Error: ${result.error}` : null,
    result.output ? `\nOutput:\n${result.output}` : null,
  ].filter(Boolean).join("\n");

  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-1 mb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-red-600" />
          <span className="text-base font-medium text-red-800">
            {PLATFORM_LABELS[result.platform as PlatformId]} / {CHECK_LABELS[result.check]}
          </span>
          {result.durationMs != null && (
            <Badge variant="outline" className="text-xs font-mono border-red-300">
              {formatDuration(result.durationMs)}
            </Badge>
          )}
          {result.error && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-300">
              {result.error}
            </Badge>
          )}
          {result.traceId && (
            <Badge variant="outline" className="text-xs font-mono text-muted-foreground cursor-pointer" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(result.traceId!); }} title="Click to copy trace ID">
              trace: {result.traceId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-sm px-3"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            disabled={result.status === "running"}
          >
            {result.status === "running" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <RotateCcw className="w-3 h-3 mr-1" /> Retry
              </>
            )}
          </Button>
        </div>
      </div>
      {result.output && <CopyableLog text={result.output} />}
    </div>
  );
}

interface SmokeTestPanelProps {
  onComplete?: () => void;
  history?: { platform: string; checkName: string; passCount: number; totalCount: number; lastRunAt: string | null; lastStatus: string | null; lastDurationMs?: number | null; recentErrors?: { error: string; createdAt: string; durationMs: number | null }[] }[] | null;
}

export function SmokeTestPanel({ onComplete, history }: SmokeTestPanelProps) {
  const { isRunning, results, progress, summary, start, stop, retryCheck } =
    useSmokeTest();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  // Build effective results: use live results when available, fall back to history
  const effectiveResults = results.size > 0 ? results : (() => {
    if (!history || history.length === 0) return new Map<string, CellResult>();
    const map = new Map<string, CellResult>();
    for (const entry of history) {
      map.set(`${entry.platform}:${entry.checkName}`, {
        platform: entry.platform,
        check: entry.checkName as SmokeCheckName,
        status: entry.lastStatus === "pass" ? "pass" : entry.lastStatus === "fail" ? "fail" : "pending",
        durationMs: entry.lastDurationMs ?? undefined,
        error: entry.recentErrors?.[0]?.error,
        output: entry.recentErrors?.[0]?.error,
      });
    }
    return map;
  })();
  const hasResults = effectiveResults.size > 0;
  const isHistorical = results.size === 0 && hasResults;
  const wasRunningRef = useRef(false);

  // Auto-expand when test starts, call onComplete when test finishes
  useEffect(() => {
    if (isRunning) {
      setIsOpen(true);
      wasRunningRef.current = true;
    } else if (wasRunningRef.current) {
      wasRunningRef.current = false;
      onComplete?.();
    }
  }, [isRunning, onComplete]);

  const toggleCellExpand = (key: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  // Calculate live summary from results when retrying changes individual cells
  const liveCounts = {
    passed: 0,
    failed: 0,
    running: 0,
  };
  effectiveResults.forEach((r) => {
    if (r.status === "pass") liveCounts.passed++;
    else if (r.status === "fail") liveCounts.failed++;
    else if (r.status === "running") liveCounts.running++;
  });

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FlaskConical className="h-5 w-5" />
            <CardTitle className="text-lg">Smoke Test</CardTitle>
            {hasResults && !isRunning && (summary || isHistorical) && (
              <div className="flex items-center gap-2 ml-2">
                <Badge
                  variant="outline"
                  className="text-xs bg-green-50 text-green-700 border-green-200"
                >
                  {summary?.passed ?? liveCounts.passed} passed
                </Badge>
                {(summary?.failed ?? liveCounts.failed) > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-red-50 text-red-700 border-red-200"
                  >
                    {summary?.failed ?? liveCounts.failed} failed
                  </Badge>
                )}
                {isHistorical && (() => {
                  const lastRunAt = history?.reduce((latest, e) => {
                    if (!e.lastRunAt) return latest;
                    return !latest || e.lastRunAt > latest ? e.lastRunAt : latest;
                  }, null as string | null);
                  return (
                    <span className="text-xs text-muted-foreground">
                      (last run{lastRunAt ? ` ${timeAgo(lastRunAt)}` : ""})
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={stop}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Square className="h-3 w-3 mr-1" /> Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => start()}>
                <Play className="h-3 w-3 mr-1" /> {hasResults ? "Run Again" : "Run Smoke Test"}
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(isRunning || hasResults) && isOpen && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
              <span>
                {isRunning
                  ? `${progress.completed}/${progress.total} checks (${progress.running} running)`
                  : summary
                    ? `${progress.total}/${progress.total} — ${summary.passed} passed, ${summary.failed} failed (${formatTotalDuration(summary.totalDurationMs)})`
                    : `${progress.completed}/${progress.total} checks`}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  liveCounts.failed > 0
                    ? "bg-gradient-to-r from-green-500 to-red-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {/* Matrix table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] sticky left-0 bg-background z-10 text-sm">
                    Platform
                  </TableHead>
                  {SMOKE_CHECKS.map((check) => (
                    <TableHead key={check} className="text-center min-w-[110px] text-sm">
                      <div className="flex items-center justify-center gap-1 group/col">
                        {CHECK_LABELS[check]}
                        {!isRunning && (
                          <button
                            className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-100"
                            onClick={() => start({ check })}
                            title={`Run ${CHECK_LABELS[check]} for all platforms`}
                          >
                            <Play className="w-3 h-3 text-blue-600" />
                          </button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {SMOKE_PLATFORMS.map((sp) => {
                  // Check if any cell in this row is expanded with failure
                  const rowExpandedFailures: { key: string; result: CellResult }[] = [];
                  for (const check of SMOKE_CHECKS) {
                    const key = `${sp.platform}:${check}`;
                    const result = effectiveResults.get(key);
                    if (expandedCells.has(key) && result?.status === "fail") {
                      rowExpandedFailures.push({ key, result });
                    }
                  }

                  return (
                    <TableRow key={sp.platform} className="group">
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2 group/row">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                PLATFORM_COLORS[sp.platform],
                            }}
                          />
                          <span className="text-sm font-medium">
                            {PLATFORM_LABELS[sp.platform]}
                          </span>
                          {!isRunning && (
                            <button
                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-100"
                              onClick={() => start({ platform: sp.platform })}
                              title={`Run all checks for ${PLATFORM_LABELS[sp.platform]}`}
                            >
                              <Play className="w-3 h-3 text-blue-600" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      {SMOKE_CHECKS.map((check) => {
                        const isNA = !getSmokeCheck(sp.platform, check);
                        const key = `${sp.platform}:${check}`;
                        const result = effectiveResults.get(key);

                        return (
                          <TableCell key={check} className="text-center p-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <StatusCell
                                    platform={sp.platform}
                                    check={check}
                                    result={result}
                                    isNA={isNA}
                                    onRetry={() => retryCheck(sp.platform, check)}
                                    onRun={() => start({ platform: sp.platform, check })}
                                    isExpanded={expandedCells.has(key)}
                                    onToggleExpand={() => toggleCellExpand(key)}
                                    isRunning={isRunning}
                                  />
                                </div>
                              </TooltipTrigger>
                              {result && (result.status === "fail" || result.traceId) && (
                                <TooltipContent side="bottom">
                                  <div className="space-y-1">
                                    {result.status === "fail" && result.error && (
                                      <div className="text-sm text-red-600">{result.error} — click for details</div>
                                    )}
                                    {result.traceId && (
                                      <div className="text-xs font-mono text-muted-foreground">trace: {result.traceId}</div>
                                    )}
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Expanded failure details (shown below the table) */}
          {Array.from(expandedCells).map((key) => {
            const result = effectiveResults.get(key);
            if (!result || result.status !== "fail") return null;
            return (
              <FailureDetails
                key={key}
                result={result}
                onRetry={() => retryCheck(result.platform, result.check)}
              />
            );
          })}

          {/* Summary footer */}
          {(summary || isHistorical) && !isRunning && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-sm bg-green-50 text-green-700 border-green-200 px-3 py-1"
                >
                  {liveCounts.passed || summary?.passed || 0} Passed
                </Badge>
                {(liveCounts.failed || summary?.failed || 0) > 0 && (
                  <Badge
                    variant="outline"
                    className="text-sm bg-red-50 text-red-700 border-red-200 px-3 py-1"
                  >
                    {liveCounts.failed || summary?.failed || 0} Failed
                  </Badge>
                )}
                {(summary?.na ?? 0) > 0 && (
                  <Badge variant="outline" className="text-sm text-gray-500 dark:text-gray-400 px-3 py-1">
                    {summary?.na} N/A
                  </Badge>
                )}
                {summary?.totalDurationMs && (
                  <span className="text-sm text-muted-foreground">
                    {formatTotalDuration(summary.totalDurationMs)}
                  </span>
                )}
                {isHistorical && (
                  <span className="text-xs text-muted-foreground italic">
                    Last run results
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => start()}>
                <RotateCcw className="h-3 w-3 mr-1" /> Run Again
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
