"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, Mail, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format-utils";

interface EmailHealthData {
  timestamp: string;
  status: "healthy" | "degraded" | "unhealthy";
  "email-instant"?: QueueStats;
  "email-bulk"?: QueueStats;
  last24h?: {
    sent: number;
    failed: number;
    bounced: number;
    complained: number;
    total: number;
    successRate: number;
    errorRate: number;
    avgSendMs: number;
  };
  dlqDepth: number;
  suppressedCount: number;
  recentErrors: { email_type: string; recipient_email: string; error_message: string; created_at: string }[];
}

interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  error?: string;
}

const STATUS_CONFIG = {
  healthy: { label: "Healthy", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", Icon: CheckCircle },
  degraded: { label: "Degraded", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800", Icon: AlertTriangle },
  unhealthy: { label: "Unhealthy", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", Icon: XCircle },
};

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function QueueCard({ name, stats }: { name: string; stats?: QueueStats }) {
  if (!stats || stats.error) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">{name}</h3>
        <p className="text-xs text-muted-foreground mt-2">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium">{name}</h3>
      <div className="grid grid-cols-5 gap-2 mt-3">
        <div>
          <p className="text-xs text-muted-foreground">Waiting</p>
          <p className="text-lg font-mono font-bold">{stats.waiting}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{stats.active}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Delayed</p>
          <p className="text-lg font-mono font-bold">{stats.delayed}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-lg font-mono font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Done</p>
          <p className="text-lg font-mono font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmailHealthPage() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<EmailHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/email-health");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const statusConfig = data ? STATUS_CONFIG[data.status] : STATUS_CONFIG.healthy;
  const StatusIcon = statusConfig.Icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email System Health"
        description="Real-time email infrastructure monitoring"
        icon={Activity}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Email Health" },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {loading && !data ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : data ? (
        <>
          {/* Status Banner */}
          <div className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} p-4 flex items-center gap-3`}>
            <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
            <div>
              <p className={`font-medium ${statusConfig.color}`}>
                System Status: {statusConfig.label}
              </p>
              <p className="text-xs text-muted-foreground">
                Last updated: {timeAgo(data.timestamp)}
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              label="Sent (24h)"
              value={data.last24h?.sent ?? 0}
              subtitle={`${data.last24h?.successRate ?? 100}% success`}
            />
            <StatCard
              label="Failed (24h)"
              value={data.last24h?.failed ?? 0}
              subtitle={`${data.last24h?.errorRate ?? 0}% error rate`}
            />
            <StatCard
              label="Bounced (24h)"
              value={data.last24h?.bounced ?? 0}
            />
            <StatCard
              label="Avg Send Time"
              value={`${data.last24h?.avgSendMs ?? 0}ms`}
            />
            <StatCard
              label="DLQ Depth"
              value={data.dlqDepth}
              subtitle={data.dlqDepth > 20 ? "Above threshold!" : "Normal"}
            />
            <StatCard
              label="Suppressed"
              value={data.suppressedCount}
              subtitle="Active suppressions"
            />
          </div>

          {/* Queue Status */}
          <div>
            <h2 className="text-sm font-medium mb-3">Queue Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QueueCard name="email-instant" stats={data["email-instant"]} />
              <QueueCard name="email-bulk" stats={data["email-bulk"]} />
            </div>
          </div>

          {/* Recent Errors */}
          {data.recentErrors && data.recentErrors.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-3">Recent Errors</h2>
              <div className="rounded-lg border divide-y">
                {data.recentErrors.map((err, i) => (
                  <div key={i} className="p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{err.email_type}</span>
                      <span className="text-muted-foreground">{timeAgo(err.created_at)}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 truncate" title={err.error_message}>
                      {err.error_message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Failed to load health data</div>
      )}
    </div>
  );
}
