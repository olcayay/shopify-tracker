"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { timeAgo } from "@/lib/format-utils";
import { HEALTH_SCRAPER_TYPES } from "@/lib/platform-display";
import { OperationalMatrix } from "./components/operational-matrix";
import { UtilityScrapers } from "./components/utility-scrapers";
import { QueueStatusCard } from "./components/queue-status-card";
import { RunHistoryTable } from "./components/run-history-table";

const PAGE_SIZE = 20;

export default function ScraperPage() {
  const { fetchWithAuth } = useAuth();
  const [healthData, setHealthData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("");
  const [filterQueue, setFilterQueue] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [page, setPage] = useState(0);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterTrigger) params.set("triggeredBy", filterTrigger);
    if (filterQueue) params.set("queue", filterQueue);
    if (filterPlatform) params.set("platform", filterPlatform);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    const [healthRes, statsRes, runsRes, queueRes] = await Promise.all([
      fetchWithAuth("/api/system-admin/scraper/health"),
      fetchWithAuth("/api/system-admin/stats?platform=all"),
      fetchWithAuth(`/api/system-admin/scraper/runs?${params.toString()}`),
      fetchWithAuth("/api/system-admin/scraper/queue"),
    ]);

    if (healthRes.ok) setHealthData(await healthRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    if (runsRes.ok) {
      const data = await runsRes.json();
      setRuns(data.runs);
      setTotal(data.total);
    }
    if (queueRes.ok) setQueueStatus(await queueRes.json());
    setLastRefresh(new Date());
  }, [fetchWithAuth, filterType, filterTrigger, filterQueue, filterPlatform, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Auto-dismiss message
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function triggerScraper(platform: string, type: string) {
    const key = `${platform}:${type}`;
    setTriggering(key);
    setMessage("");
    const res = await fetchWithAuth("/api/system-admin/scraper/trigger", {
      method: "POST",
      body: JSON.stringify({ type, platform }),
    });
    if (res.ok) {
      setMessage(`Triggered "${type}" for ${platform}`);
      setTimeout(loadData, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to trigger scraper");
    }
    setTriggering(null);
  }

  async function triggerAllForPlatform(platform: string) {
    setMessage("");
    for (const type of HEALTH_SCRAPER_TYPES) {
      await triggerScraper(platform, type);
    }
    setMessage(`Triggered all scrapers for ${platform}`);
  }

  async function triggerUtility(type: string) {
    setTriggering(type);
    setMessage("");
    const res = await fetchWithAuth("/api/system-admin/scraper/trigger", {
      method: "POST",
      body: JSON.stringify({ type, platform: "shopify" }),
    });
    if (res.ok) {
      setMessage(`Triggered "${type}"`);
      setTimeout(loadData, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to trigger scraper");
    }
    setTriggering(null);
  }

  async function togglePause() {
    const endpoint = queueStatus?.isPaused
      ? "/api/system-admin/scraper/queue/resume"
      : "/api/system-admin/scraper/queue/pause";
    const res = await fetchWithAuth(endpoint, { method: "POST" });
    if (res.ok) {
      setMessage(queueStatus?.isPaused ? "Queue resumed" : "Queue paused");
      loadData();
    }
  }

  async function drainQueue() {
    const res = await fetchWithAuth("/api/system-admin/scraper/queue/jobs", { method: "DELETE" });
    if (res.ok) {
      setMessage("All waiting jobs removed");
      loadData();
    }
  }

  async function clearFailedJobs() {
    const res = await fetchWithAuth("/api/system-admin/scraper/queue/failed", { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setMessage(`${data.removed} failed job(s) removed`);
      loadData();
    }
  }

  async function removeJob(jobId: string) {
    const res = await fetchWithAuth(`/api/system-admin/scraper/queue/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) {
      setMessage(`Job ${jobId} removed`);
      loadData();
    }
  }

  async function retryRun(runId: string) {
    setRetryingRunId(runId);
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/scraper/runs/${runId}/retry`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setMessage(data.message || "Run retried");
      setTimeout(loadData, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to retry run");
    }
    setRetryingRunId(null);
  }

  // Build utility freshness map
  const utilityFreshness = new Map<string, { lastCompletedAt: string | null }>();
  if (stats?.freshness) {
    for (const f of stats.freshness) {
      utilityFreshness.set(f.scraperType, f);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link href="/system-admin" className="hover:underline">
              System Admin
            </Link>
            {" > Scraper"}
          </p>
          <h1 className="text-2xl font-bold">Scraper Management</h1>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {timeAgo(lastRefresh.toISOString())} &middot; Auto-refresh 30s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/system-admin/scraper-health">
            <Button variant="outline" size="sm">
              View Health Dashboard &rarr;
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted animate-in fade-in-0 slide-in-from-top-1">
          {message}
        </div>
      )}

      {/* Summary Stats */}
      {healthData && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm px-3 py-1 border-green-200 text-green-700 bg-green-50">
            {healthData.summary.healthy} Healthy
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 border-red-200 text-red-700 bg-red-50">
            {healthData.summary.failed} Failed
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 border-yellow-200 text-yellow-700 bg-yellow-50">
            {healthData.summary.stale} Stale
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 border-blue-200 text-blue-700 bg-blue-50">
            {healthData.summary.running} Running
          </Badge>
          <span className="text-sm text-muted-foreground">
            / {healthData.summary.totalScheduled} scheduled
          </span>
        </div>
      )}

      {/* Operational Matrix */}
      <OperationalMatrix
        healthData={healthData}
        onTrigger={triggerScraper}
        onTriggerAll={triggerAllForPlatform}
        triggering={triggering}
      />

      {/* Utility Scrapers */}
      <UtilityScrapers
        freshness={utilityFreshness}
        onTrigger={triggerUtility}
        triggering={triggering}
      />

      {/* Queue Status */}
      <QueueStatusCard
        queueStatus={queueStatus}
        onTogglePause={togglePause}
        onDrainQueue={drainQueue}
        onClearFailed={clearFailedJobs}
        onRemoveJob={removeJob}
        onKillJob={removeJob}
      />

      {/* Run History */}
      <RunHistoryTable
        runs={runs}
        total={total}
        page={page}
        filterType={filterType}
        filterTrigger={filterTrigger}
        filterQueue={filterQueue}
        filterPlatform={filterPlatform}
        onPageChange={(p) => setPage(p)}
        onFilterTypeChange={(v) => { setFilterType(v); setPage(0); }}
        onFilterTriggerChange={(v) => { setFilterTrigger(v); setPage(0); }}
        onFilterQueueChange={(v) => { setFilterQueue(v); setPage(0); }}
        onFilterPlatformChange={(v) => { setFilterPlatform(v); setPage(0); }}
        onRetry={retryRun}
        onRefresh={loadData}
        retryingRunId={retryingRunId}
      />
    </div>
  );
}
