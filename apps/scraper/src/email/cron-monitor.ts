/**
 * Cron execution monitor (PLA-684).
 * Tracks cron job executions, durations, and failures.
 * Provides history for admin dashboard and alerting.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("cron-monitor");

export interface CronExecution {
  cronName: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: "running" | "success" | "failed";
  error?: string;
  jobsEnqueued?: number;
}

/** In-memory cron execution history (ring buffer) */
const MAX_HISTORY = 200;
const executionHistory: CronExecution[] = [];
const runningJobs = new Map<string, CronExecution>();

/**
 * Record the start of a cron execution.
 */
export function cronStarted(cronName: string): void {
  const execution: CronExecution = {
    cronName,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    status: "running",
  };

  runningJobs.set(cronName, execution);
  log.info("cron started", { cronName });
}

/**
 * Record the successful completion of a cron execution.
 */
export function cronSucceeded(cronName: string, jobsEnqueued?: number): void {
  const running = runningJobs.get(cronName);
  const now = new Date();

  const execution: CronExecution = running
    ? {
        ...running,
        finishedAt: now.toISOString(),
        durationMs: now.getTime() - new Date(running.startedAt).getTime(),
        status: "success",
        jobsEnqueued,
      }
    : {
        cronName,
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        durationMs: 0,
        status: "success",
        jobsEnqueued,
      };

  runningJobs.delete(cronName);
  addToHistory(execution);
  log.info("cron succeeded", { cronName, durationMs: execution.durationMs, jobsEnqueued });
}

/**
 * Record a failed cron execution.
 */
export function cronFailed(cronName: string, error: unknown): void {
  const running = runningJobs.get(cronName);
  const now = new Date();
  const errorMessage = error instanceof Error ? error.message : String(error);

  const execution: CronExecution = running
    ? {
        ...running,
        finishedAt: now.toISOString(),
        durationMs: now.getTime() - new Date(running.startedAt).getTime(),
        status: "failed",
        error: errorMessage,
      }
    : {
        cronName,
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        durationMs: 0,
        status: "failed",
        error: errorMessage,
      };

  runningJobs.delete(cronName);
  addToHistory(execution);
  log.error("cron failed", { cronName, error: errorMessage, durationMs: execution.durationMs });
}

function addToHistory(execution: CronExecution): void {
  executionHistory.unshift(execution);
  if (executionHistory.length > MAX_HISTORY) {
    executionHistory.length = MAX_HISTORY;
  }
}

/**
 * Get cron execution history.
 */
export function getCronHistory(options?: {
  cronName?: string;
  limit?: number;
  status?: "success" | "failed";
}): CronExecution[] {
  let results = [...executionHistory];

  if (options?.cronName) {
    results = results.filter((e) => e.cronName === options.cronName);
  }
  if (options?.status) {
    results = results.filter((e) => e.status === options.status);
  }

  return results.slice(0, options?.limit ?? 50);
}

/**
 * Get currently running cron jobs.
 */
export function getRunningCrons(): CronExecution[] {
  return [...runningJobs.values()];
}

/**
 * Get a summary of cron health.
 */
export function getCronSummary(): {
  totalExecutions: number;
  recentFailures: number;
  currentlyRunning: number;
  lastExecution: CronExecution | null;
  cronNames: string[];
} {
  const last24h = executionHistory.filter(
    (e) => new Date(e.startedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  const cronNames = [...new Set(executionHistory.map((e) => e.cronName))];

  return {
    totalExecutions: executionHistory.length,
    recentFailures: last24h.filter((e) => e.status === "failed").length,
    currentlyRunning: runningJobs.size,
    lastExecution: executionHistory[0] || null,
    cronNames,
  };
}

/** Reset history (for testing) */
export function _resetCronHistory(): void {
  executionHistory.length = 0;
  runningJobs.clear();
}
