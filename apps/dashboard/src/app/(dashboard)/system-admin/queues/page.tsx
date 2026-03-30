"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Activity } from "lucide-react";

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface QueueStats {
  background: QueueCounts;
  interactive: QueueCounts;
  emailInstant: QueueCounts | null;
  emailBulk: QueueCounts | null;
  notifications: QueueCounts | null;
}

const QUEUE_LABELS: Record<string, { label: string; description: string }> = {
  background: { label: "Background Scraper", description: "Scheduled scraping jobs" },
  interactive: { label: "Interactive Scraper", description: "User-triggered scraping jobs" },
  emailInstant: { label: "Email Instant", description: "Transactional emails (password reset, verification)" },
  emailBulk: { label: "Email Bulk", description: "Marketing & alert emails (digests, alerts)" },
  notifications: { label: "Notifications", description: "In-app & push notifications" },
};

function StatusBadge({ count, label, variant }: { count: number; label: string; variant: "active" | "waiting" | "failed" | "completed" | "delayed" }) {
  const colors: Record<string, string> = {
    active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    delayed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`text-xs ${colors[variant]}`}>{count}</Badge>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function QueueMonitoringDashboard() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/queue-stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Queue Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Real-time status of all 5 BullMQ queues</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(QUEUE_LABELS).map(([key, { label, description }]) => {
            const counts = stats?.[key as keyof QueueStats] as QueueCounts | null;
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {label}
                    {counts ? (
                      (counts.active > 0 || counts.waiting > 0) ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Idle</Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-xs">N/A</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </CardHeader>
                <CardContent>
                  {counts ? (
                    <div className="grid grid-cols-2 gap-2">
                      <StatusBadge count={counts.active} label="Active" variant="active" />
                      <StatusBadge count={counts.waiting} label="Waiting" variant="waiting" />
                      <StatusBadge count={counts.failed} label="Failed" variant="failed" />
                      <StatusBadge count={counts.completed} label="Completed" variant="completed" />
                      <StatusBadge count={counts.delayed} label="Delayed" variant="delayed" />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Queue not available</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
