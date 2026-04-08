"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, Mail, MousePointerClick, Eye, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";

interface Overview {
  days: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  total: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface TrendPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

interface TypeBreakdown {
  emailType: string;
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  openRate: number;
  clickRate: number;
}

function MetricCard({ label, value, rate, icon: Icon, color }: {
  label: string;
  value: number;
  rate?: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      {rate !== undefined && (
        <p className={`text-xs mt-1 ${rate > 0 ? color : "text-muted-foreground"}`}>
          {rate}%
        </p>
      )}
    </div>
  );
}

const TREND_SERIES = [
  { key: "sent", label: "Sent", color: "#3b82f6" },
  { key: "opened", label: "Opened", color: "#8b5cf6" },
  { key: "clicked", label: "Clicked", color: "#6366f1" },
  { key: "bounced", label: "Bounced", color: "#f59e0b" },
  { key: "failed", label: "Failed", color: "#ef4444" },
];

export default function EmailAnalyticsPage() {
  const { fetchWithAuth } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [byType, setByType] = useState<TypeBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState<"daily" | "hourly">("daily");
  const [hourlyData, setHourlyData] = useState<Record<string, unknown>[]>([]);
  const [hourlyRange, setHourlyRange] = useState("24h");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, trendsRes, byTypeRes] = await Promise.all([
        fetchWithAuth(`/api/system-admin/email-analytics/overview?days=${days}`),
        fetchWithAuth(`/api/system-admin/email-analytics/trends?days=${days}`),
        fetchWithAuth(`/api/system-admin/email-analytics/by-type?days=${days}`),
      ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data.data || []);
      }
      if (byTypeRes.ok) {
        const data = await byTypeRes.json();
        setByType(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, days]);

  const fetchHourly = useCallback(async () => {
    const hours = hourlyRange.replace("h", "");
    const res = await fetchWithAuth(`/api/system-admin/email-analytics/hourly?hours=${hours}`);
    if (res.ok) {
      const json = await res.json();
      // Hourly endpoint returns per-type data; we need per-status aggregation
      // Use the trends-style format: aggregate all types into sent/failed/skipped per hour
      setHourlyData(json.data || []);
    }
  }, [fetchWithAuth, hourlyRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (granularity === "hourly") fetchHourly();
  }, [granularity, fetchHourly]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Analytics"
        description={`Performance metrics for the last ${days} days`}
        icon={BarChart3}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Email Analytics" },
        ]}
        actions={
          <div className="flex gap-2">
            <select
              className="text-xs border rounded px-2 py-1 bg-background"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      {loading && !overview ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : overview ? (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <MetricCard label="Total Sent" value={overview.sent} icon={Mail} color="text-blue-600 dark:text-blue-400" />
            <MetricCard label="Delivery Rate" value={overview.delivered} rate={overview.deliveryRate} icon={TrendingUp} color="text-green-600 dark:text-green-400" />
            <MetricCard label="Open Rate" value={overview.opened} rate={overview.openRate} icon={Eye} color="text-purple-600 dark:text-purple-400" />
            <MetricCard label="Click Rate" value={overview.clicked} rate={overview.clickRate} icon={MousePointerClick} color="text-indigo-600 dark:text-indigo-400" />
            <MetricCard label="Bounce Rate" value={overview.bounced} rate={overview.bounceRate} icon={AlertTriangle} color="text-red-600 dark:text-red-400" />
          </div>

          {/* Trend Chart */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Email Volume Trend</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGranularity("daily")}
                  className={`px-2 py-0.5 text-xs rounded ${
                    granularity === "daily"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setGranularity("hourly")}
                  className={`px-2 py-0.5 text-xs rounded ${
                    granularity === "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Hourly
                </button>
              </div>
            </div>
            {granularity === "daily" ? (
              <TimeSeriesChart
                data={trends.map((t) => ({ time: t.date, sent: Number(t.sent), opened: Number(t.opened), clicked: Number(t.clicked), bounced: Number(t.bounced), failed: Number(t.failed) }))}
                series={TREND_SERIES}
                height={260}
                formatXAxis={(v) => v.slice(5)}
                formatTooltipTime={(v) => v}
              />
            ) : (
              <TimeSeriesChart
                data={hourlyData}
                series={Object.keys(hourlyData[0] || {})
                  .filter((k) => k !== "time")
                  .map((k, i) => ({
                    key: k,
                    label: k.replace(/^email_/, "").replace(/_/g, " "),
                    color: ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"][i % 8],
                  }))}
                height={260}
                formatXAxis={(v) => {
                  const d = new Date(v);
                  return `${d.getHours().toString().padStart(2, "0")}:00`;
                }}
                formatTooltipTime={(v) => {
                  const d = new Date(v);
                  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                }}
                timeRanges={["12h", "24h", "48h", "72h"]}
                selectedRange={hourlyRange}
                onRangeChange={setHourlyRange}
              />
            )}
          </div>

          {/* By Type Table */}
          <div>
            <h3 className="text-sm font-medium mb-3">Performance by Email Type</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Bounced</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No email data yet
                    </TableCell>
                  </TableRow>
                ) : (
                  byType.map((t) => (
                    <TableRow key={t.emailType}>
                      <TableCell className="text-xs font-medium">{t.emailType}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.sent}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.opened}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.clicked}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.bounced}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        <span className={t.openRate > 20 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                          {t.openRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        <span className={t.clickRate > 5 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                          {t.clickRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Failed to load analytics</div>
      )}
    </div>
  );
}
