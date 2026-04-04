"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Play, Trash2, RefreshCw, PlayCircle, BarChart3, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format-utils";
import { toast } from "sonner";

interface DlqJob {
  id: number;
  jobType: string;
  queueName: string;
  platform: string;
  errorMessage: string | null;
  failedAt: string;
  replayedAt: string | null;
  failCount: number;
}

interface DlqStats {
  errorDistribution: { errorClass: string; count: number }[];
  topFailingTypes: { jobType: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
}

function getErrorClass(errorMessage: string | null): string {
  if (!errorMessage) return "unknown";
  if (errorMessage.startsWith("[provider_down]")) return "provider_down";
  if (errorMessage.startsWith("[permanent]")) return "permanent";
  if (errorMessage.startsWith("[transient]")) return "transient";
  return "unclassified";
}

function ErrorClassBadge({ errorMessage }: { errorMessage: string | null }) {
  const cls = getErrorClass(errorMessage);
  const colors: Record<string, string> = {
    provider_down: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    permanent: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    transient: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
    unclassified: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[cls] || colors.unknown}`}>
      {cls.replace("_", " ")}
    </span>
  );
}

export default function DlqPage() {
  const { fetchWithAuth } = useAuth();
  const [jobs, setJobs] = useState<DlqJob[]>([]);
  const [depth, setDepth] = useState(0);
  const [alert, setAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replayingAll, setReplayingAll] = useState(false);
  const [stats, setStats] = useState<DlqStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const hasProviderDownJobs = jobs.some(
    (j) => !j.replayedAt && getErrorClass(j.errorMessage) === "provider_down"
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/dlq?limit=100");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.data || []);
        setDepth(data.depth || 0);
        setAlert(data.alert || false);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/system-admin/dlq/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // non-critical
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const replayJob = async (id: number) => {
    const res = await fetchWithAuth(`/api/system-admin/dlq/${id}/replay`, { method: "POST" });
    if (res.ok) {
      toast.success("Job replayed successfully");
      fetchJobs();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to replay job");
    }
  };

  const bulkReplay = async (errorClass?: string) => {
    setReplayingAll(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/dlq/bulk-replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(errorClass ? { error_class: errorClass } : {}),
          max_jobs: 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.replayed} jobs replayed${data.failed ? `, ${data.failed} failed` : ""}`);
        fetchJobs();
      } else {
        toast.error("Bulk replay failed");
      }
    } finally {
      setReplayingAll(false);
    }
  };

  const deleteJob = async (id: number) => {
    const res = await fetchWithAuth(`/api/system-admin/dlq/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Job deleted");
      fetchJobs();
    } else {
      toast.error("Failed to delete job");
    }
  };

  const toggleStats = () => {
    if (!showStats && !stats) fetchStats();
    setShowStats((v) => !v);
  };

  const unresolvedCount = jobs.filter((j) => !j.replayedAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dead Letter Queue"
        description={`${depth} unresolved failed jobs${alert ? " — ALERT: above threshold" : ""}`}
        icon={AlertTriangle}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Dead Letter Queue" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleStats}>
              <BarChart3 className="h-4 w-4 mr-1" /> Stats
            </Button>
            {unresolvedCount > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkReplay()}
                disabled={replayingAll}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                {replayingAll ? "Replaying..." : `Replay All (${unresolvedCount})`}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Provider Down Banner */}
      {hasProviderDownJobs && (
        <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            <strong>Provider Down</strong> — Some jobs failed due to SMTP provider unavailability.
            These jobs may succeed after the provider recovers.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => bulkReplay("provider_down")}
            disabled={replayingAll}
          >
            Replay Provider-Down Jobs
          </Button>
        </div>
      )}

      {alert && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200">
          DLQ depth ({depth}) exceeds alert threshold. Review and resolve failed jobs.
        </div>
      )}

      {/* Stats panel */}
      {showStats && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Error Distribution</h3>
            {stats.errorDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground">No unresolved errors</p>
            ) : (
              <div className="space-y-2">
                {stats.errorDistribution.map((e) => (
                  <div key={e.errorClass} className="flex justify-between text-xs">
                    <span className="capitalize">{e.errorClass.replace("_", " ")}</span>
                    <span className="font-mono">{e.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Top Failing Types</h3>
            {stats.topFailingTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No failures</p>
            ) : (
              <div className="space-y-2">
                {stats.topFailingTypes.map((t) => (
                  <div key={t.jobType} className="flex justify-between text-xs">
                    <span className="truncate mr-2">{t.jobType}</span>
                    <span className="font-mono">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Daily Trend (7d)</h3>
            {stats.dailyTrend.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent failures</p>
            ) : (
              <div className="space-y-2">
                {stats.dailyTrend.map((d) => (
                  <div key={d.date} className="flex justify-between text-xs">
                    <span>{d.date}</span>
                    <span className="font-mono">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Error Class</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
            </TableRow>
          ) : jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No failed jobs</TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id}</TableCell>
                <TableCell className="text-xs">{job.jobType}</TableCell>
                <TableCell className="text-xs">{job.platform}</TableCell>
                <TableCell><ErrorClassBadge errorMessage={job.errorMessage} /></TableCell>
                <TableCell className="text-xs max-w-48 truncate text-muted-foreground" title={job.errorMessage || ""}>
                  {job.errorMessage?.replace(/^\[(provider_down|permanent|transient)\]\s*/, "") || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{timeAgo(job.failedAt)}</TableCell>
                <TableCell>
                  {job.replayedAt ? (
                    <span className="text-xs text-green-600 dark:text-green-400">Replayed</span>
                  ) : (
                    <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!job.replayedAt && (
                      <Button variant="ghost" size="sm" onClick={() => replayJob(job.id)} title="Replay">
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteJob(job.id)} title="Delete">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
