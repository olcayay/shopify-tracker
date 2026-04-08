"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatDate } from "@/lib/format-date";
import { formatNumber } from "@/lib/format-utils";
import { ChevronDown, ChevronRight, X, Plus } from "lucide-react";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";

interface AiLog {
  id: string;
  accountId: string;
  accountName: string | null;
  userId: string | null;
  userName: string | null;
  platform: string;
  productType: string;
  productId: string | null;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseContent: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string | null;
  durationMs: number;
  status: string;
  errorMessage: string | null;
  tags: string[];
  notes: string | null;
  triggerType: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Stats {
  totalCalls: number;
  totalCost: string;
  totalTokens: number;
  avgDuration: number;
}

interface TimeseriesPoint {
  date: string;
  calls: number;
  cost: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgDurationMs: number;
}

interface AccountUsage {
  accountId: string;
  accountName: string | null;
  calls: number;
  cost: string;
  totalTokens: number;
  avgDuration: number;
  errorCount: number;
  lastUsed: string | null;
}

const STATUS_OPTIONS = ["success", "error", "timeout"];
const PLATFORM_OPTIONS = ["shopify", "salesforce", "canva"];
const PERIOD_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];
const DAYS_OPTIONS = [7, 30, 90, 180, 365];

export default function AiLogsPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterProductType, setFilterProductType] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Tag input
  const [tagInput, setTagInput] = useState("");
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);

  // Analytics state
  const [period, setPeriod] = useState("daily");
  const [days, setDays] = useState(30);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [accountUsage, setAccountUsage] = useState<AccountUsage[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (filterStatus) params.set("status", filterStatus);
    if (filterPlatform) params.set("platform", filterPlatform);
    if (filterProductType) params.set("productType", filterProductType);
    if (filterTag) params.set("tag", filterTag);
    return params.toString();
  }, [offset, filterStatus, filterPlatform, filterProductType, filterTag]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/ai-logs?${buildQuery()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setStats(data.stats);
        setHasMore(data.logs.length === limit);
      }
    } catch (err) {
      console.error("Failed to load AI logs:", err);
    }
    setLoading(false);
  }, [fetchWithAuth, buildQuery]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [tsRes, accRes] = await Promise.all([
        fetchWithAuth(`/api/system-admin/ai-logs/analytics/timeseries?period=${period}&days=${days}`),
        fetchWithAuth(`/api/system-admin/ai-logs/analytics/per-account?days=${days}`),
      ]);
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        setTimeseries(tsData.data || []);
      }
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccountUsage(accData.data || []);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
    setAnalyticsLoading(false);
  }, [fetchWithAuth, period, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  function resetFilters() {
    setFilterStatus("");
    setFilterPlatform("");
    setFilterProductType("");
    setFilterTag("");
    setOffset(0);
  }

  async function updateLog(id: string, updates: { tags?: string[]; notes?: string }) {
    const res = await fetchWithAuth(`/api/system-admin/ai-logs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setLogs((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    }
  }

  function addTag(logId: string, tag: string) {
    const log = logs.find((l) => l.id === logId);
    if (!log || !tag.trim()) return;
    const newTags = [...new Set([...(log.tags || []), tag.trim()])];
    updateLog(logId, { tags: newTags });
    setTagInput("");
  }

  function removeTag(logId: string, tag: string) {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    const newTags = (log.tags || []).filter((t) => t !== tag);
    updateLog(logId, { tags: newTags });
  }

  const formatCost = (cost: string | null) => {
    if (!cost) return "$0.00";
    const n = parseFloat(cost);
    return `$${n.toFixed(4)}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const chartData = timeseries.map((p) => ({
    time: p.date,
    costNum: parseFloat(p.cost),
    calls: p.calls,
    promptTokens: p.promptTokens,
    completionTokens: p.completionTokens,
    totalTokens: p.totalTokens,
    avgDurationMs: p.avgDurationMs,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Prompt Dashboard</h1>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex border rounded overflow-hidden">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Calls</CardDescription>
              <CardTitle className="text-2xl">{stats.totalCalls}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cost</CardDescription>
              <CardTitle className="text-2xl">{formatCost(stats.totalCost)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Tokens</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(stats.totalTokens)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Duration</CardDescription>
              <CardTitle className="text-2xl">
                {formatDuration(stats.avgDuration)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Charts */}
      {analyticsLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading charts...</div>
      ) : chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cost Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cost Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={chartData}
                series={[{ key: "costNum", label: "Cost", color: "#3b82f6" }]}
                height={200}
                formatXAxis={(v) => v.slice(5)}
                formatYAxis={(v) => `$${v}`}
                formatTooltipTime={(v) => `Date: ${v}`}
              />
            </CardContent>
          </Card>

          {/* API Calls Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">API Calls Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={chartData}
                series={[{ key: "calls", label: "Calls", color: "#8b5cf6" }]}
                height={200}
                formatXAxis={(v) => v.slice(5)}
                formatTooltipTime={(v) => `Date: ${v}`}
              />
            </CardContent>
          </Card>

          {/* Tokens Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tokens Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={chartData}
                series={[
                  { key: "promptTokens", label: "Prompt", color: "#f59e0b" },
                  { key: "completionTokens", label: "Completion", color: "#10b981" },
                ]}
                height={200}
                formatXAxis={(v) => v.slice(5)}
                formatTooltipTime={(v) => `Date: ${v}`}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Per-Account Usage Table */}
      {accountUsage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Per-Account Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountUsage.map((acc) => (
                  <TableRow key={acc.accountId}>
                    <TableCell className="text-sm font-medium">
                      {acc.accountName || acc.accountId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {acc.calls}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {formatCost(acc.cost)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {formatNumber(acc.totalTokens)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {formatDuration(acc.avgDuration)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {acc.errorCount > 0 ? (
                        <span className="text-destructive">{acc.errorCount}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.lastUsed ? formatDateTime(acc.lastUsed) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              className="border rounded px-2 py-1.5 text-sm bg-background"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1.5 text-sm bg-background"
              value={filterPlatform}
              onChange={(e) => { setFilterPlatform(e.target.value); setOffset(0); }}
            >
              <option value="">All Platforms</option>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1.5 text-sm bg-background"
              value={filterProductType}
              onChange={(e) => { setFilterProductType(e.target.value); setOffset(0); }}
            >
              <option value="">All Types</option>
              {["research_virtual_app", "seo_comparison", "seo_category_overview", "seo_best_of_intro", "seo_app_description", "seo_faq", "review_sentiment"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <Input
              placeholder="Filter by tag..."
              className="w-40"
              value={filterTag}
              onChange={(e) => { setFilterTag(e.target.value); setOffset(0); }}
            />
            {(filterStatus || filterPlatform || filterProductType || filterTag) && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No AI logs found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">In Tokens</TableHead>
                    <TableHead className="text-right">Out Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <TableCell className="px-2">
                          {expandedId === log.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">{log.userName || "—"}</TableCell>
                        <TableCell className="text-sm">{log.accountName || "—"}</TableCell>
                        <TableCell className="text-sm">{log.platform}</TableCell>
                        <TableCell className="text-sm font-mono">{log.productType}</TableCell>
                        <TableCell className="text-sm font-mono">{log.model}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {formatNumber(log.promptTokens)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {formatNumber(log.completionTokens)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {formatCost(log.costUsd)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {formatDuration(log.durationMs)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === "success" ? "default" : "destructive"}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={log.triggerType === "system" ? "border-amber-500 text-amber-600" : ""}
                          >
                            {log.triggerType}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1 items-center">
                            {(log.tags || []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs gap-1 cursor-default"
                              >
                                {tag}
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                                  onClick={() => removeTag(log.id, tag)}
                                />
                              </Badge>
                            ))}
                            {editingTagsId === log.id ? (
                              <form
                                className="flex gap-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  addTag(log.id, tagInput);
                                  setEditingTagsId(null);
                                }}
                              >
                                <Input
                                  className="h-6 w-24 text-xs"
                                  value={tagInput}
                                  onChange={(e) => setTagInput(e.target.value)}
                                  onBlur={() => {
                                    if (tagInput.trim()) addTag(log.id, tagInput);
                                    setEditingTagsId(null);
                                  }}
                                  autoFocus
                                  placeholder="tag..."
                                />
                              </form>
                            ) : (
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingTagsId(log.id);
                                  setTagInput("");
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Detail */}
                      {expandedId === log.id && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={14} className="bg-muted/30 p-4">
                            <div className="space-y-4 max-w-5xl">
                              {log.errorMessage && (
                                <div>
                                  <h4 className="text-sm font-semibold text-destructive mb-1">
                                    Error
                                  </h4>
                                  <pre className="text-xs bg-destructive/10 rounded p-3 whitespace-pre-wrap break-all">
                                    {log.errorMessage}
                                  </pre>
                                </div>
                              )}

                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-1">Metadata</h4>
                                  <pre className="text-xs bg-background rounded p-3 whitespace-pre-wrap break-words max-h-40 overflow-y-auto border font-mono">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {(log.ipAddress || log.userAgent) && (
                                <div className="flex gap-6 text-xs text-muted-foreground">
                                  {log.ipAddress && (
                                    <span>
                                      <span className="font-semibold text-foreground">IP:</span>{" "}
                                      {log.ipAddress}
                                    </span>
                                  )}
                                  {log.userAgent && (
                                    <span className="truncate max-w-md" title={log.userAgent}>
                                      <span className="font-semibold text-foreground">UA:</span>{" "}
                                      {log.userAgent}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div>
                                <h4 className="text-sm font-semibold mb-1">System Prompt <span className="font-normal text-muted-foreground">({formatNumber(log.systemPrompt.length)} chars)</span></h4>
                                <pre className="text-xs bg-background rounded p-3 whitespace-pre-wrap break-words max-h-60 overflow-y-auto border">
                                  {log.systemPrompt}
                                </pre>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold mb-1">User Prompt <span className="font-normal text-muted-foreground">({formatNumber(log.userPrompt.length)} chars)</span></h4>
                                <pre className="text-xs bg-background rounded p-3 whitespace-pre-wrap break-words max-h-60 overflow-y-auto border">
                                  {log.userPrompt}
                                </pre>
                              </div>

                              {log.responseContent && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-1">Response <span className="font-normal text-muted-foreground">({formatNumber(log.responseContent?.length ?? 0)} chars)</span></h4>
                                  <pre className="text-xs bg-background rounded p-3 whitespace-pre-wrap break-words max-h-60 overflow-y-auto border">
                                    {log.responseContent}
                                  </pre>
                                </div>
                              )}

                              <div>
                                <h4 className="text-sm font-semibold mb-1">Notes</h4>
                                <textarea
                                  className="w-full border rounded p-2 text-sm bg-background min-h-[60px] resize-y"
                                  defaultValue={log.notes || ""}
                                  placeholder="Add notes for prompt optimization..."
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== (log.notes || "")) {
                                      updateLog(log.id, { notes: val });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Showing {offset + 1}–{offset + logs.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
