"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, Mail, MousePointerClick, Eye, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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

function TrendBar({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground py-4">No data yet</p>;

  const maxSent = Math.max(...data.map((d) => Number(d.sent) || 1));

  return (
    <div className="flex items-end gap-0.5 h-24">
      {data.map((d, i) => {
        const height = Math.max(4, (Number(d.sent) / maxSent) * 100);
        const failRate = Number(d.sent) > 0 ? Number(d.failed) / Number(d.sent) : 0;
        const barColor = failRate > 0.1 ? "bg-red-400" : failRate > 0.05 ? "bg-yellow-400" : "bg-blue-400";
        return (
          <div
            key={i}
            className={`${barColor} rounded-t-sm flex-1 min-w-1`}
            style={{ height: `${height}%` }}
            title={`${d.date}: ${d.sent} sent, ${d.failed} failed`}
          />
        );
      })}
    </div>
  );
}

export default function EmailAnalyticsPage() {
  const { fetchWithAuth } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [byType, setByType] = useState<TypeBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            <h3 className="text-sm font-medium mb-3">Send Volume Trend</h3>
            <TrendBar data={trends} />
            {trends.length > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{trends[0]?.date}</span>
                <span>{trends[trends.length - 1]?.date}</span>
              </div>
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
