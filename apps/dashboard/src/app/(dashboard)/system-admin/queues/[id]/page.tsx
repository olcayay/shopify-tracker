"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, RotateCcw, Trash2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { timeAgo } from "@/lib/format-utils";
import { toast } from "sonner";

interface QueueJob {
  id: string;
  name: string;
  state: string;
  data: Record<string, unknown>;
  timestamp: string | null;
  processedOn: string | null;
  finishedOn: string | null;
  failedReason: string | null;
  attemptsMade: number;
  opts: { delay?: number; priority?: number; attempts?: number };
  recipient: string | null;
  emailType: string | null;
  platform: string | null;
  slug: string | null;
  triggeredBy: string | null;
  userId: string | null;
}

interface JobDetail extends QueueJob {
  returnvalue: Record<string, unknown> | null;
  stacktrace: string[];
  logs: string[];
}

const STATE_COLORS: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  delayed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const QUEUE_NAMES: Record<string, string> = {
  "background": "Background Scraper",
  "interactive": "Interactive Scraper",
  "email-instant": "Email Instant",
  "email-bulk": "Email Bulk",
  "notifications": "Notifications",
};

function JobSummary({ job, queueKey }: { job: QueueJob; queueKey: string }) {
  if (queueKey.startsWith("email")) {
    return (
      <div className="text-xs">
        <span className="font-medium">{job.emailType || job.name}</span>
        {job.recipient && <span className="text-muted-foreground ml-2">→ {job.recipient}</span>}
      </div>
    );
  }
  if (queueKey === "notifications") {
    return (
      <div className="text-xs">
        <span className="font-medium">{job.name}</span>
        {job.userId && <span className="text-muted-foreground ml-2">user: {job.userId.slice(0, 8)}...</span>}
      </div>
    );
  }
  // Scraper
  return (
    <div className="text-xs">
      <span className="font-medium">{job.name}</span>
      {job.platform && <span className="text-muted-foreground ml-1">({job.platform})</span>}
      {job.slug && <span className="text-muted-foreground ml-1">— {job.slug}</span>}
    </div>
  );
}

export default function QueueJobsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queueKey = params.id as string;
  const stateFilter = searchParams.get("state") || "waiting";

  const { fetchWithAuth } = useAuth();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/system-admin/queue-jobs?queue=${queueKey}&state=${stateFilter}&limit=100`
      );
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, queueKey, stateFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadJobDetail = async (jobId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}`);
      if (res.ok) {
        setSelectedJob(await res.json());
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const retryJob = async (jobId: string) => {
    const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}/retry`, { method: "POST" });
    if (res.ok) {
      toast.success("Job retried");
      loadJobs();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Retry failed");
    }
  };

  const removeJob = async (jobId: string) => {
    const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Job removed");
      loadJobs();
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } else {
      toast.error("Remove failed");
    }
  };

  const states = ["waiting", "active", "completed", "failed", "delayed"];
  const queueName = QUEUE_NAMES[queueKey] || queueKey;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/system-admin/queues">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{queueName} Jobs</h1>
          <p className="text-xs text-muted-foreground">Inspect individual jobs in the {queueName} queue</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* State filter tabs */}
      <div className="flex gap-1 border-b">
        {states.map((s) => (
          <Link
            key={s}
            href={`/system-admin/queues/${queueKey}?state=${s}`}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              stateFilter === s
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job list */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-20">State</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No {stateFilter} jobs
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className={`cursor-pointer hover:bg-muted/50 ${selectedJob?.id === job.id ? "bg-muted/80" : ""}`}
                    onClick={() => loadJobDetail(job.id)}
                  >
                    <TableCell>
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <JobSummary job={job} queueKey={queueKey} />
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        #{job.id}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {job.timestamp ? timeAgo(job.timestamp) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATE_COLORS[job.state] || ""}`}>
                        {job.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {job.state === "failed" && (
                          <Button variant="ghost" size="sm" onClick={() => retryJob(job.id)} title="Retry">
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                        {(job.state === "waiting" || job.state === "delayed" || job.state === "failed") && (
                          <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)} title="Remove">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Job detail panel */}
        <div className="border rounded-lg p-4 min-h-[300px]">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading job detail...
            </div>
          ) : selectedJob ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Job #{selectedJob.id}</h3>
                <Badge className={STATE_COLORS[selectedJob.state] || ""}>{selectedJob.state}</Badge>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-mono">{selectedJob.name}</span>
                </div>
                {selectedJob.recipient && (
                  <div>
                    <span className="text-muted-foreground">To:</span>{" "}
                    <span className="font-medium">{selectedJob.recipient}</span>
                  </div>
                )}
                {selectedJob.emailType && (
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="font-mono">{selectedJob.emailType}</span>
                  </div>
                )}
                {selectedJob.userId && (
                  <div>
                    <span className="text-muted-foreground">User:</span>{" "}
                    <span className="font-mono text-[10px]">{selectedJob.userId}</span>
                  </div>
                )}
                {selectedJob.platform && (
                  <div>
                    <span className="text-muted-foreground">Platform:</span>{" "}
                    <span>{selectedJob.platform}</span>
                  </div>
                )}
                {selectedJob.triggeredBy && (
                  <div>
                    <span className="text-muted-foreground">Triggered by:</span>{" "}
                    <span>{selectedJob.triggeredBy}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Attempts:</span>{" "}
                  <span>{selectedJob.attemptsMade}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  <span>{selectedJob.timestamp ? timeAgo(selectedJob.timestamp) : "—"}</span>
                </div>
                {selectedJob.processedOn && (
                  <div>
                    <span className="text-muted-foreground">Processed:</span>{" "}
                    <span>{timeAgo(selectedJob.processedOn)}</span>
                  </div>
                )}
                {selectedJob.finishedOn && (
                  <div>
                    <span className="text-muted-foreground">Finished:</span>{" "}
                    <span>{timeAgo(selectedJob.finishedOn)}</span>
                  </div>
                )}
              </div>

              {/* Error */}
              {selectedJob.failedReason && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
                  <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">
                    {selectedJob.failedReason}
                  </p>
                  {selectedJob.stacktrace.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-red-600 dark:text-red-400 cursor-pointer">
                        Stack trace
                      </summary>
                      <pre className="text-[10px] text-red-600 dark:text-red-400 mt-1 overflow-x-auto max-h-40 overflow-y-auto">
                        {selectedJob.stacktrace.join("\n")}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Job data */}
              <div>
                <p className="text-xs font-medium mb-1">Job Data</p>
                <pre className="text-[10px] font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedJob.data, null, 2)}
                </pre>
              </div>

              {/* Return value */}
              {selectedJob.returnvalue && (
                <div>
                  <p className="text-xs font-medium mb-1">Return Value</p>
                  <pre className="text-[10px] font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedJob.returnvalue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Click a job to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
