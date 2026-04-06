"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, RefreshCw, RotateCcw, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";
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
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  delayed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const QUEUE_NAMES: Record<string, string> = {
  "background": "Background Scraper",
  "interactive": "Interactive Scraper",
  "email-instant": "Email Instant",
  "email-bulk": "Email Bulk",
  "notifications": "Notifications",
};

const STATES = ["all", "waiting", "active", "completed", "failed", "delayed"];
const PAGE_SIZE = 25;

type SortField = "id" | "state" | "name" | "timestamp" | "finishedOn" | "attemptsMade" | "emailType" | "recipient";
type SortDir = "asc" | "desc";

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string; currentDir: SortDir }) {
  if (field !== currentField) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return currentDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1" />
    : <ChevronDown className="h-3 w-3 ml-1" />;
}

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
  const initialState = searchParams.get("state") || "all";

  const { fetchWithAuth } = useAuth();
  const [allJobs, setAllJobs] = useState<QueueJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState(initialState);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [emailTypeFilter, setEmailTypeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");

  const isEmailQueue = queueKey.startsWith("email");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/system-admin/queue-jobs?queue=${queueKey}&state=${stateFilter}&limit=200`
      );
      if (res.ok) {
        const data = await res.json();
        setAllJobs(data.jobs || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, queueKey, stateFilter]);

  useEffect(() => { setPage(0); loadJobs(); }, [loadJobs]);

  const sortedJobs = useMemo(() => {
    let filtered = [...allJobs];

    // Apply email-specific filters
    if (isEmailQueue) {
      if (emailTypeFilter) {
        filtered = filtered.filter((j) => (j.emailType || j.name) === emailTypeFilter);
      }
      if (recipientFilter) {
        const q = recipientFilter.toLowerCase();
        filtered = filtered.filter((j) => j.recipient?.toLowerCase().includes(q));
      }
    }

    return filtered.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      switch (sortField) {
        case "id": valA = parseInt(a.id || "0", 10); valB = parseInt(b.id || "0", 10); break;
        case "state": valA = a.state; valB = b.state; break;
        case "name": valA = a.emailType || a.name || ""; valB = b.emailType || b.name || ""; break;
        case "emailType": valA = a.emailType || a.name || ""; valB = b.emailType || b.name || ""; break;
        case "recipient": valA = a.recipient || ""; valB = b.recipient || ""; break;
        case "timestamp": valA = a.timestamp || ""; valB = b.timestamp || ""; break;
        case "finishedOn": valA = a.finishedOn || ""; valB = b.finishedOn || ""; break;
        case "attemptsMade": valA = a.attemptsMade; valB = b.attemptsMade; break;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [allJobs, sortField, sortDir, isEmailQueue, emailTypeFilter, recipientFilter]);

  const totalPages = Math.ceil(sortedJobs.length / PAGE_SIZE);
  const pagedJobs = sortedJobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const loadJobDetail = async (jobId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}`);
      if (res.ok) setSelectedJob(await res.json());
    } finally { setLoadingDetail(false); }
  };

  const retryJob = async (jobId: string) => {
    const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}/retry`, { method: "POST" });
    if (res.ok) { toast.success("Job retried"); loadJobs(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Retry failed"); }
  };

  const removeJob = async (jobId: string) => {
    const res = await fetchWithAuth(`/api/system-admin/queue-jobs/${queueKey}/${jobId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Job removed"); loadJobs(); if (selectedJob?.id === jobId) setSelectedJob(null); }
    else toast.error("Remove failed");
  };

  const queueName = QUEUE_NAMES[queueKey] || queueKey;

  const stateCounts = useMemo(() => {
    if (stateFilter !== "all") return {};
    const c: Record<string, number> = {};
    for (const j of allJobs) c[j.state] = (c[j.state] || 0) + 1;
    return c;
  }, [allJobs, stateFilter]);

  // Unique email types for the filter dropdown
  const uniqueEmailTypes = useMemo(() => {
    if (!isEmailQueue) return [];
    const types = new Set<string>();
    for (const j of allJobs) {
      const t = j.emailType || j.name;
      if (t) types.add(t);
    }
    return [...types].sort();
  }, [allJobs, isEmailQueue]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/system-admin/queues">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{queueName} Jobs</h1>
          <p className="text-xs text-muted-foreground">{total} jobs{stateFilter !== "all" ? ` (${stateFilter})` : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* State filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATES.map((s) => {
          const count = s === "all" ? total : (stateCounts[s] || 0);
          const isActive = stateFilter === s;
          return (
            <button
              key={s}
              onClick={() => { setStateFilter(s); setPage(0); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              {s === "all" || count > 0 ? <span className="ml-1 font-mono">{s === "all" ? total : count}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Email-specific filters */}
      {isEmailQueue && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={emailTypeFilter}
            onChange={(e) => { setEmailTypeFilter(e.target.value); setPage(0); }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All types</option>
            {uniqueEmailTypes.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Filter by recipient..."
              value={recipientFilter}
              onChange={(e) => { setRecipientFilter(e.target.value); setPage(0); }}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Job table */}
        <div className="lg:col-span-3 border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 cursor-pointer select-none" onClick={() => toggleSort("id")}>
                    <span className="flex items-center">ID <SortIcon field="id" currentField={sortField} currentDir={sortDir} /></span>
                  </TableHead>
                  {isEmailQueue ? (
                    <>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("emailType")}>
                        <span className="flex items-center">Type <SortIcon field="emailType" currentField={sortField} currentDir={sortDir} /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("recipient")}>
                        <span className="flex items-center">Recipient <SortIcon field="recipient" currentField={sortField} currentDir={sortDir} /></span>
                      </TableHead>
                    </>
                  ) : (
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      <span className="flex items-center">Job <SortIcon field="name" currentField={sortField} currentDir={sortDir} /></span>
                    </TableHead>
                  )}
                  <TableHead className="w-20 cursor-pointer select-none" onClick={() => toggleSort("state")}>
                    <span className="flex items-center">State <SortIcon field="state" currentField={sortField} currentDir={sortDir} /></span>
                  </TableHead>
                  <TableHead className="w-24 cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort("timestamp")}>
                    <span className="flex items-center">Created <SortIcon field="timestamp" currentField={sortField} currentDir={sortDir} /></span>
                  </TableHead>
                  <TableHead className="w-12 cursor-pointer select-none hidden lg:table-cell" onClick={() => toggleSort("attemptsMade")}>
                    <span className="flex items-center">Tries <SortIcon field="attemptsMade" currentField={sortField} currentDir={sortDir} /></span>
                  </TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isEmailQueue ? 7 : 6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : pagedJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={isEmailQueue ? 7 : 6} className="text-center py-8 text-muted-foreground">No jobs</TableCell></TableRow>
                ) : (
                  pagedJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedJob?.id === job.id ? "bg-muted/80" : ""}`}
                      onClick={() => loadJobDetail(job.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">#{job.id}</TableCell>
                      {isEmailQueue ? (
                        <>
                          <TableCell className="text-xs font-mono">{job.emailType || job.name}</TableCell>
                          <TableCell className="text-xs truncate max-w-[160px]">{job.recipient || "—"}</TableCell>
                        </>
                      ) : (
                        <TableCell>
                          <JobSummary job={job} queueKey={queueKey} />
                          {job.failedReason && <p className="text-[10px] text-red-500 truncate max-w-[200px] mt-0.5">{job.failedReason}</p>}
                        </TableCell>
                      )}
                      <TableCell><Badge className={`text-[10px] ${STATE_COLORS[job.state] || ""}`}>{job.state}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{job.timestamp ? timeAgo(job.timestamp) : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-center">{job.attemptsMade}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {job.state === "failed" && (
                            <Button variant="ghost" size="sm" onClick={() => retryJob(job.id)} title="Retry"><RotateCcw className="h-3 w-3" /></Button>
                          )}
                          {["waiting", "delayed", "failed"].includes(job.state) && (
                            <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)} title="Remove"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedJobs.length)} of {sortedJobs.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs px-2">{page + 1}/{totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <DetailPanel
          selectedJob={selectedJob}
          loadingDetail={loadingDetail}
          queueKey={queueKey}
          fetchWithAuth={fetchWithAuth}
        />
      </div>
    </div>
  );
}

// ── Detail Panel with Email Preview ───────────────────────────────

function DetailPanel({
  selectedJob,
  loadingDetail,
  queueKey,
  fetchWithAuth,
}: {
  selectedJob: JobDetail | null;
  loadingDetail: boolean;
  queueKey: string;
  fetchWithAuth: (path: string, options?: RequestInit) => Promise<Response>;
}) {
  const [detailTab, setDetailTab] = useState<"details" | "preview">("details");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isEmailQueue = queueKey.startsWith("email");

  useEffect(() => {
    setDetailTab("details");
    setPreviewHtml(null);
    setPreviewSubject(null);
  }, [selectedJob?.id]);

  const loadPreview = async () => {
    if (!selectedJob) return;
    setPreviewLoading(true);
    try {
      const type = selectedJob.emailType || (selectedJob.data?.type as string);
      const payload = (selectedJob.data?.payload || selectedJob.data) as Record<string, unknown>;

      const res = await fetchWithAuth("/api/system-admin/email-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
        setDetailTab("preview");
      } else {
        toast.error("Preview failed");
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loadingDetail) {
    return <div className="lg:col-span-2 border rounded-lg p-4 min-h-[400px] flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!selectedJob) {
    return <div className="lg:col-span-2 border rounded-lg p-4 min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">Click a job to see details</div>;
  }

  return (
    <div className="lg:col-span-2 border rounded-lg min-h-[400px] max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">#{selectedJob.id}</h3>
          <Badge className={STATE_COLORS[selectedJob.state] || ""}>{selectedJob.state}</Badge>
        </div>
        {isEmailQueue && (
          <div className="flex gap-1">
            <button
              onClick={() => setDetailTab("details")}
              className={`px-2 py-1 text-xs rounded ${detailTab === "details" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Details
            </button>
            <button
              onClick={() => { if (!previewHtml) loadPreview(); else setDetailTab("preview"); }}
              disabled={previewLoading}
              className={`px-2 py-1 text-xs rounded ${detailTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {previewLoading ? "Loading..." : "Preview"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {detailTab === "preview" && previewHtml ? (
          <div className="space-y-3">
            {previewSubject && (
              <div className="text-xs">
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="font-medium">{previewSubject}</span>
              </div>
            )}
            <iframe
              srcDoc={previewHtml}
              className="w-full border rounded-md bg-white dark:bg-white"
              style={{ minHeight: 500 }}
              sandbox="allow-same-origin"
              title="Email preview"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-mono">{selectedJob.name}</span></div>
              {selectedJob.recipient && <div><span className="text-muted-foreground">To:</span> <span className="font-medium">{selectedJob.recipient}</span></div>}
              {selectedJob.emailType && <div><span className="text-muted-foreground">Type:</span> <span className="font-mono">{selectedJob.emailType}</span></div>}
              {selectedJob.userId && <div><span className="text-muted-foreground">User:</span> <span className="font-mono text-[10px]">{selectedJob.userId}</span></div>}
              {selectedJob.platform && <div><span className="text-muted-foreground">Platform:</span> {selectedJob.platform}</div>}
              {selectedJob.triggeredBy && <div><span className="text-muted-foreground">Trigger:</span> {selectedJob.triggeredBy}</div>}
              <div><span className="text-muted-foreground">Attempts:</span> {selectedJob.attemptsMade}</div>
              <div><span className="text-muted-foreground">Created:</span> {selectedJob.timestamp ? timeAgo(selectedJob.timestamp) : "—"}</div>
              {selectedJob.processedOn && <div><span className="text-muted-foreground">Processed:</span> {timeAgo(selectedJob.processedOn)}</div>}
              {selectedJob.finishedOn && <div><span className="text-muted-foreground">Finished:</span> {timeAgo(selectedJob.finishedOn)}</div>}
            </div>
            {selectedJob.failedReason && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
                <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">{selectedJob.failedReason}</p>
                {selectedJob.stacktrace.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-red-600 dark:text-red-400 cursor-pointer">Stack trace</summary>
                    <pre className="text-[10px] text-red-600 dark:text-red-400 mt-1 overflow-x-auto max-h-40 overflow-y-auto">{selectedJob.stacktrace.join("\n")}</pre>
                  </details>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-medium mb-1">Job Data</p>
              <pre className="text-[10px] font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-60 overflow-y-auto">{JSON.stringify(selectedJob.data, null, 2)}</pre>
            </div>
            {selectedJob.returnvalue && (
              <div>
                <p className="text-xs font-medium mb-1">Return Value</p>
                <pre className="text-[10px] font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify(selectedJob.returnvalue, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
