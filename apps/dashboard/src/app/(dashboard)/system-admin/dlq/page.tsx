"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Play, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format-utils";
import { toast } from "sonner";

interface DlqJob {
  id: number;
  jobType: string;
  platform: string;
  errorMessage: string | null;
  failedAt: string;
  replayedAt: string | null;
  failCount: number;
}

export default function DlqPage() {
  const { fetchWithAuth } = useAuth();
  const [jobs, setJobs] = useState<DlqJob[]>([]);
  const [depth, setDepth] = useState(0);
  const [alert, setAlert] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const deleteJob = async (id: number) => {
    const res = await fetchWithAuth(`/api/system-admin/dlq/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Job deleted");
      fetchJobs();
    } else {
      toast.error("Failed to delete job");
    }
  };

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
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      {alert && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200">
          DLQ depth ({depth}) exceeds alert threshold. Review and resolve failed jobs.
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
            </TableRow>
          ) : jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No failed jobs</TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id}</TableCell>
                <TableCell className="text-xs">{job.jobType}</TableCell>
                <TableCell className="text-xs">{job.platform}</TableCell>
                <TableCell className="text-xs max-w-48 truncate text-muted-foreground" title={job.errorMessage || ""}>
                  {job.errorMessage || "—"}
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
