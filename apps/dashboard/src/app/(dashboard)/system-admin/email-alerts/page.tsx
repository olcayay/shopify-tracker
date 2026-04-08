"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, RefreshCw, TestTube, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format-utils";
import { toast } from "sonner";
import { TimeSeriesChart, type TimeSeriesConfig } from "@/components/ui/time-series-chart";

interface AlertRule {
  id: string;
  ruleName: string;
  metric: string;
  operator: string;
  threshold: number;
  cooldownMinutes: number;
  enabled: boolean;
  channels: string[];
}

interface AlertLog {
  id: string;
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  deliveredAt: string | null;
  createdAt: string;
}

export default function EmailAlertsPage() {
  const { fetchWithAuth } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rules" | "history">("rules");
  const [chartRange, setChartRange] = useState("7d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, historyRes] = await Promise.all([
        fetchWithAuth("/api/system-admin/email-alerts/rules"),
        fetchWithAuth("/api/system-admin/email-alerts/history?limit=50"),
      ]);
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.data || []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRule = async (rule: AlertRule) => {
    const res = await fetchWithAuth(`/api/system-admin/email-alerts/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (res.ok) {
      toast.success(`Rule ${rule.enabled ? "disabled" : "enabled"}`);
      fetchData();
    } else {
      toast.error("Failed to update rule");
    }
  };

  const testAlert = async (ruleId?: string) => {
    const res = await fetchWithAuth("/api/system-admin/email-alerts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId }),
    });
    if (res.ok) {
      toast.success("Test alert created");
      fetchData();
    } else {
      toast.error("Failed to create test alert");
    }
  };

  // Build chart data: group alerts by hour and rule name
  const { chartData, chartSeries } = useMemo(() => {
    const rangeHours = chartRange === "24h" ? 24 : chartRange === "7d" ? 168 : 720;
    const cutoff = new Date(Date.now() - rangeHours * 3600_000);
    const filtered = history.filter((h) => new Date(h.createdAt) >= cutoff);

    const ruleNames = new Set<string>();
    const hourMap = new Map<string, Record<string, number>>();

    for (const h of filtered) {
      const d = new Date(h.createdAt);
      const hourKey = rangeHours <= 24
        ? d.toISOString().slice(0, 13) + ":00"
        : d.toISOString().slice(0, 10);
      ruleNames.add(h.ruleName);
      if (!hourMap.has(hourKey)) hourMap.set(hourKey, {});
      const entry = hourMap.get(hourKey)!;
      entry[h.ruleName] = (entry[h.ruleName] || 0) + 1;
    }

    const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];
    const series: TimeSeriesConfig[] = Array.from(ruleNames).map((name, i) => ({
      key: name,
      label: name,
      color: COLORS[i % COLORS.length],
    }));

    const data = Array.from(hourMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, counts]) => ({ time, ...counts }));

    return { chartData: data, chartSeries: series };
  }, [history, chartRange]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Alerts"
        description="Threshold-based monitoring for email system health"
        icon={Bell}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Email Alerts" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => testAlert()}>
              <TestTube className="h-4 w-4 mr-1" /> Test Alert
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Alert Frequency Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium">Alert Frequency</h3>
          </div>
          <TimeSeriesChart
            data={chartData}
            series={chartSeries}
            height={220}
            formatXAxis={(v) => chartRange === "24h" ? v.slice(11, 16) : v.slice(5)}
            formatTooltipTime={(v) => chartRange === "24h"
              ? new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : v
            }
            timeRanges={["24h", "7d", "30d"]}
            selectedRange={chartRange}
            onRangeChange={setChartRange}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "rules" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("rules")}
        >
          Alert Rules ({rules.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("history")}
        >
          Alert History ({history.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : tab === "rules" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Cooldown</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-sm">{rule.ruleName}</TableCell>
                <TableCell className="text-xs font-mono">{rule.metric}</TableCell>
                <TableCell className="text-xs font-mono">
                  {rule.operator} {rule.threshold}{rule.metric.includes("rate") ? "%" : ""}
                </TableCell>
                <TableCell className="text-xs">{rule.cooldownMinutes}min</TableCell>
                <TableCell className="text-xs">
                  {(rule.channels || []).join(", ")}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${rule.enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {rule.enabled ? "Active" : "Disabled"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleRule(rule)} title={rule.enabled ? "Disable" : "Enable"}>
                      {rule.enabled ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => testAlert(rule.id)} title="Test">
                      <TestTube className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No alerts triggered yet
                </TableCell>
              </TableRow>
            ) : (
              history.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{log.ruleName}</TableCell>
                  <TableCell className="text-xs font-mono">{log.metric}</TableCell>
                  <TableCell className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
                    {log.currentValue}{log.metric.includes("rate") ? "%" : ""}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {log.threshold}{log.metric.includes("rate") ? "%" : ""}
                  </TableCell>
                  <TableCell>
                    {log.deliveredAt ? (
                      <span className="text-xs text-green-600 dark:text-green-400">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {timeAgo(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
