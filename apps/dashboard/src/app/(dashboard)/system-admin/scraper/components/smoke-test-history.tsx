"use client";

import { useState } from "react";
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
import { Check, X, Minus, History, ChevronDown, ChevronRight } from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { timeAgo, formatDuration } from "@/lib/format-utils";

const CHECK_LABELS: Record<SmokeCheckName, string> = {
  categories: "Categories",
  app: "App",
  keyword: "Keyword",
  reviews: "Reviews",
  featured: "Featured",
};

export interface SmokeHistoryEntry {
  platform: string;
  checkName: string;
  passCount: number;
  totalCount: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  recentErrors: { error: string; createdAt: string; durationMs: number | null }[];
}

interface SmokeTestHistoryProps {
  history: SmokeHistoryEntry[] | null;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type RateLevel = "perfect" | "good" | "warning" | "danger" | "nodata";

function getRateLevel(passCount: number, totalCount: number): RateLevel {
  if (totalCount === 0) return "nodata";
  if (passCount === totalCount) return "perfect";
  const rate = passCount / totalCount;
  if (rate >= 0.8) return "good";
  if (rate >= 0.5) return "warning";
  return "danger";
}

const RATE_STYLES: Record<RateLevel, { badge: string; bg: string; bar: string; dot: string }> = {
  perfect: {
    badge: "bg-green-50 text-green-700 border-green-300",
    bg: "bg-green-50/50",
    bar: "bg-green-500",
    dot: "bg-green-500",
  },
  good: {
    badge: "bg-green-50 text-green-700 border-green-200",
    bg: "bg-green-50/30",
    bar: "bg-green-400",
    dot: "bg-green-400",
  },
  warning: {
    badge: "bg-yellow-50 text-yellow-700 border-yellow-300",
    bg: "bg-yellow-50/30",
    bar: "bg-yellow-500",
    dot: "bg-yellow-500",
  },
  danger: {
    badge: "bg-red-50 text-red-700 border-red-300",
    bg: "bg-red-50/30",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  nodata: {
    badge: "bg-gray-50 text-gray-400 border-gray-200",
    bg: "",
    bar: "bg-gray-200",
    dot: "bg-gray-300",
  },
};

export function SmokeTestHistory({ history }: SmokeTestHistoryProps) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!history || !Array.isArray(history)) return null;

  // Build lookup: platform:checkName -> entry
  const entryMap = new Map<string, SmokeHistoryEntry>();
  for (const entry of history) {
    entryMap.set(`${entry.platform}:${entry.checkName}`, entry);
  }

  // Calculate global stats
  let totalChecks = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let checksWithData = 0;
  for (const entry of history) {
    totalChecks += entry.totalCount;
    totalPassed += entry.passCount;
    totalFailed += entry.totalCount - entry.passCount;
    checksWithData++;
  }

  const globalRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;
  const hasAnyData = history.length > 0;

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
            <History className="h-5 w-5" />
            <CardTitle className="text-lg">Smoke Test History</CardTitle>
            {hasAnyData && (
              <div className="flex items-center gap-2 ml-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${globalRate >= 80 ? "bg-green-50 text-green-700 border-green-200" : globalRate >= 50 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}`}
                >
                  {globalRate}% overall
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {checksWithData} checks tracked
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> 100%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" /> &ge;80%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> 50-79%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> &lt;50%
            </span>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-0">
          {!hasAnyData ? (
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground">
                No smoke test results yet. Run a smoke test to see historical pass rates.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 w-[140px] text-sm">
                        Platform
                      </TableHead>
                      {SMOKE_CHECKS.map((check) => (
                        <TableHead key={check} className="text-center text-xs px-2 min-w-[100px]">
                          {CHECK_LABELS[check]}
                        </TableHead>
                      ))}
                      <TableHead className="text-center text-xs px-2 w-[70px]">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SMOKE_PLATFORMS.map((sp) => {
                      // Calculate per-platform rate
                      let platPass = 0;
                      let platTotal = 0;
                      for (const check of SMOKE_CHECKS) {
                        const e = entryMap.get(`${sp.platform}:${check}`);
                        if (e) {
                          platPass += e.passCount;
                          platTotal += e.totalCount;
                        }
                      }
                      const platLevel = getRateLevel(platPass, platTotal);

                      return (
                        <TableRow key={sp.platform} className="group">
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: PLATFORM_COLORS[sp.platform] }}
                              />
                              <span className="text-sm font-medium">
                                {PLATFORM_LABELS[sp.platform]}
                              </span>
                            </div>
                          </TableCell>
                          {SMOKE_CHECKS.map((check) => {
                            const isNA = !getSmokeCheck(sp.platform, check);
                            const entry = entryMap.get(`${sp.platform}:${check}`);
                            const cellKey = `${sp.platform}:${check}`;
                            const isExpanded = expandedCell === cellKey;

                            if (isNA) {
                              return (
                                <TableCell key={check} className="text-center px-1">
                                  <div className="flex items-center justify-center py-1">
                                    <Minus className="w-4 h-4 text-gray-300" />
                                  </div>
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell key={check} className="text-center px-1">
                                <SmokeCell
                                  entry={entry}
                                  isExpanded={isExpanded}
                                  onToggle={() => setExpandedCell(isExpanded ? null : cellKey)}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center px-1">
                            {platTotal > 0 ? (
                              <span className={`text-xs font-medium ${
                                platLevel === "perfect" || platLevel === "good" ? "text-green-600" :
                                platLevel === "warning" ? "text-yellow-600" :
                                "text-red-600"
                              }`}>
                                {Math.round((platPass / platTotal) * 100)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Expanded error log panel */}
              {expandedCell && (() => {
                const entry = entryMap.get(expandedCell);
                if (!entry || entry.recentErrors.length === 0) return null;
                const [platform, check] = expandedCell.split(":");
                return (
                  <div className="border-t px-4 py-4 bg-red-50/30">
                    <div className="flex items-center gap-2 mb-3">
                      <X className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-800">
                        {PLATFORM_LABELS[platform as PlatformId] || platform} &mdash; {CHECK_LABELS[check as SmokeCheckName] || check}
                      </span>
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                        {entry.recentErrors.length} failure{entry.recentErrors.length !== 1 ? "s" : ""} in last {entry.totalCount} runs
                      </Badge>
                      <button
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                        onClick={() => setExpandedCell(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {entry.recentErrors.map((err, i) => (
                        <div key={i} className="bg-background rounded-lg border border-red-200 p-3 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="text-xs font-medium text-foreground">
                              {formatTimestamp(err.createdAt)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({timeAgo(err.createdAt)})
                            </span>
                            {err.durationMs != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                                {formatDuration(err.durationMs)}
                              </Badge>
                            )}
                          </div>
                          <pre className="whitespace-pre-wrap text-red-700 font-mono text-[11px] leading-relaxed break-all bg-red-50 rounded p-2 border border-red-100">
                            {err.error}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SmokeCell({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: SmokeHistoryEntry | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // No data yet for this check
  if (!entry) {
    return (
      <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
        <span className="text-xs text-muted-foreground font-mono">0/0</span>
        <span className="text-[10px] text-muted-foreground">no runs</span>
      </div>
    );
  }

  const level = getRateLevel(entry.passCount, entry.totalCount);
  const styles = RATE_STYLES[level];
  const hasErrors = entry.recentErrors.length > 0;
  const failCount = entry.totalCount - entry.passCount;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-md transition-all w-full ${
            hasErrors ? "cursor-pointer hover:ring-2 hover:ring-red-200" : ""
          } ${isExpanded ? "ring-2 ring-red-300 bg-red-50/50" : styles.bg}`}
          onClick={hasErrors ? onToggle : undefined}
        >
          {/* Rate badge */}
          <Badge
            variant="outline"
            className={`text-[11px] px-2 py-0 h-5 font-mono font-medium ${styles.badge}`}
          >
            {entry.passCount}/{entry.totalCount}
          </Badge>

          {/* Mini progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${styles.bar}`}
              style={{ width: `${entry.totalCount > 0 ? (entry.passCount / entry.totalCount) * 100 : 0}%` }}
            />
          </div>

          {/* Last run info */}
          <div className="flex items-center gap-1">
            {entry.lastStatus === "pass" ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : entry.lastStatus === "fail" ? (
              <X className="w-3 h-3 text-red-500" />
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              {entry.lastRunAt ? timeAgo(entry.lastRunAt) : "never"}
            </span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold">
            Pass rate: {entry.totalCount > 0 ? Math.round((entry.passCount / entry.totalCount) * 100) : 0}%
          </div>
          <div>
            Last {entry.totalCount} runs: <span className="text-green-600">{entry.passCount} passed</span>
            {failCount > 0 && <>, <span className="text-red-600">{failCount} failed</span></>}
          </div>
          {entry.lastRunAt && (
            <div>
              Last run: {formatTimestamp(entry.lastRunAt)} ({entry.lastStatus})
            </div>
          )}
          {hasErrors && (
            <div className="text-red-500 font-medium">Click to view {entry.recentErrors.length} error log{entry.recentErrors.length !== 1 ? "s" : ""}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
