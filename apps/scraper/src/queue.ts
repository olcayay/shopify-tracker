import { Queue, type ConnectionOptions } from "bullmq";
import type { InstantEmailJobData, BulkEmailJobData, NotificationJobData } from "@appranks/shared";
import {
  JOB_DEFAULT_ATTEMPTS,
  JOB_BACKOFF_DELAY_MS,
  JOB_REMOVE_ON_COMPLETE_COUNT,
  JOB_REMOVE_ON_FAIL_COUNT,
} from "./constants.js";

export const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
export const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";
export const EMAIL_INSTANT_QUEUE_NAME = "email-instant";
export const EMAIL_BULK_QUEUE_NAME = "email-bulk";
export const NOTIFICATIONS_QUEUE_NAME = "notifications";
/** @deprecated Use BACKGROUND_QUEUE_NAME or INTERACTIVE_QUEUE_NAME */
export const QUEUE_NAME = BACKGROUND_QUEUE_NAME;

export type ScraperJobType = "category" | "app_details" | "keyword_search" | "keyword_suggestions" | "reviews" | "daily_digest" | "weekly_summary" | "compute_review_metrics" | "compute_similarity_scores" | "backfill_categories" | "compute_app_scores" | "data_cleanup";

export interface ScraperJobOptions {
  /** For category/keyword: how many pages to scrape */
  pages?: "first" | "all" | number;
  /** After scraping list, also scrape app details for discovered apps */
  scrapeAppDetails?: boolean;
  /** Also scrape reviews (for app_details directly, or cascaded through scrapeAppDetails) */
  scrapeReviews?: boolean;
  /** Skip the 12-hour dedup check (for manual re-scrapes) */
  force?: boolean;
}

export interface ScraperJobData {
  type: ScraperJobType;
  /** Optional: specific slug for single-app or single-keyword scrapes */
  slug?: string;
  keyword?: string;
  /** Optional: specific user ID for single-user digest email */
  userId?: string;
  /** Optional: specific account ID for account-level digest email */
  accountId?: string;
  /** Platform to scope the job to (defaults to "shopify") */
  platform?: string;
  /** Triggered by: "api" | "scheduler" | "cli" */
  triggeredBy: string;
  /** Optional: scraper configuration options */
  options?: ScraperJobOptions;
  /** Optional: originating API request ID for correlation */
  requestId?: string;
  /** Optional: ID of the stale run this job is retrying */
  retryOf?: string;
}

export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ — allows unlimited retries on connection loss
    enableReadyCheck: false, // Prevent blocking on Redis restarts
  };
}

const defaultJobOptions = {
  attempts: JOB_DEFAULT_ATTEMPTS,
  backoff: { type: "exponential" as const, delay: JOB_BACKOFF_DELAY_MS },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

let _backgroundQueue: Queue<ScraperJobData> | null = null;
let _interactiveQueue: Queue<ScraperJobData> | null = null;
let _emailInstantQueue: Queue<InstantEmailJobData> | null = null;
let _emailBulkQueue: Queue<BulkEmailJobData> | null = null;
let _notificationsQueue: Queue<NotificationJobData> | null = null;

export function getBackgroundQueue(): Queue<ScraperJobData> {
  if (!_backgroundQueue) {
    _backgroundQueue = new Queue<ScraperJobData>(BACKGROUND_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _backgroundQueue;
}

export function getInteractiveQueue(): Queue<ScraperJobData> {
  if (!_interactiveQueue) {
    _interactiveQueue = new Queue<ScraperJobData>(INTERACTIVE_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _interactiveQueue;
}

/** @deprecated Use getBackgroundQueue() or getInteractiveQueue() */
export function getQueue(): Queue<ScraperJobData> {
  return getBackgroundQueue();
}

// ── Email & Notification queues ─────────────────────────────────────

const emailInstantJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

const emailBulkJobOptions = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

const notificationsJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

export function getEmailInstantQueue(): Queue<InstantEmailJobData> {
  if (!_emailInstantQueue) {
    _emailInstantQueue = new Queue<InstantEmailJobData>(EMAIL_INSTANT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: emailInstantJobOptions,
    });
  }
  return _emailInstantQueue;
}

export function getEmailBulkQueue(): Queue<BulkEmailJobData> {
  if (!_emailBulkQueue) {
    _emailBulkQueue = new Queue<BulkEmailJobData>(EMAIL_BULK_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: emailBulkJobOptions,
    });
  }
  return _emailBulkQueue;
}

export function getNotificationsQueue(): Queue<NotificationJobData> {
  if (!_notificationsQueue) {
    _notificationsQueue = new Queue<NotificationJobData>(NOTIFICATIONS_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: notificationsJobOptions,
    });
  }
  return _notificationsQueue;
}

export async function enqueueInstantEmail(
  data: InstantEmailJobData,
  options?: { priority?: number }
): Promise<string> {
  const queue = getEmailInstantQueue();
  const job = await queue.add(`email:${data.type}`, data, {
    priority: options?.priority,
  });
  return job.id!;
}

export async function enqueueBulkEmail(
  data: BulkEmailJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> {
  const queue = getEmailBulkQueue();
  const job = await queue.add(`email:${data.type}`, data, {
    priority: options?.priority,
    delay: options?.delay,
  });
  return job.id!;
}

export async function enqueueNotification(
  data: NotificationJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> {
  const queue = getNotificationsQueue();
  const job = await queue.add(`notification:${data.type}`, data, {
    priority: options?.priority,
    delay: options?.delay,
  });
  return job.id!;
}

/**
 * Enqueue an instant email to be sent at a specific time (delayed send).
 */
export async function enqueueScheduledInstantEmail(
  data: InstantEmailJobData,
  sendAt: Date,
  options?: { priority?: number }
): Promise<{ jobId: string; delayMs: number; sendAt: string }> {
  const delayMs = Math.max(0, sendAt.getTime() - Date.now());
  const queue = getEmailInstantQueue();
  const job = await queue.add(`scheduled:${data.type}`, data, {
    delay: delayMs,
    priority: options?.priority,
  });
  return { jobId: job.id!, delayMs, sendAt: sendAt.toISOString() };
}

/**
 * Enqueue a bulk email to be sent at a specific time (delayed send).
 */
export async function enqueueScheduledBulkEmail(
  data: BulkEmailJobData,
  sendAt: Date,
  options?: { priority?: number }
): Promise<{ jobId: string; delayMs: number; sendAt: string }> {
  const delayMs = Math.max(0, sendAt.getTime() - Date.now());
  const queue = getEmailBulkQueue();
  const job = await queue.add(`scheduled:${data.type}`, data, {
    delay: delayMs,
    priority: options?.priority,
  });
  return { jobId: job.id!, delayMs, sendAt: sendAt.toISOString() };
}

/**
 * Get all scheduled (delayed) email jobs.
 */
export async function getScheduledEmails(): Promise<{
  instant: { id: string; name: string; delay: number; data: unknown; timestamp: number }[];
  bulk: { id: string; name: string; delay: number; data: unknown; timestamp: number }[];
}> {
  const instantQueue = getEmailInstantQueue();
  const bulkQueue = getEmailBulkQueue();

  const [instantDelayed, bulkDelayed] = await Promise.all([
    instantQueue.getDelayed(),
    bulkQueue.getDelayed(),
  ]);

  return {
    instant: instantDelayed.map((j) => ({
      id: j.id!,
      name: j.name,
      delay: j.opts?.delay ?? 0,
      data: j.data,
      timestamp: j.timestamp,
    })),
    bulk: bulkDelayed.map((j) => ({
      id: j.id!,
      name: j.name,
      delay: j.opts?.delay ?? 0,
      data: j.data,
      timestamp: j.timestamp,
    })),
  };
}

/**
 * Cancel a scheduled email job.
 */
export async function cancelScheduledEmail(
  jobId: string,
  queue: "instant" | "bulk" = "instant"
): Promise<boolean> {
  const q = queue === "bulk" ? getEmailBulkQueue() : getEmailInstantQueue();
  const job = await q.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "delayed") {
    await job.remove();
    return true;
  }
  return false;
}

/** Long-running job types that should not retry — the scheduler will re-enqueue on the next cycle */
const NO_RETRY_TYPES: Set<ScraperJobType> = new Set([
  "category",
  "keyword_search",
  "reviews",
  "app_details",
  "keyword_suggestions",
]);

export async function enqueueScraperJob(
  data: ScraperJobData,
  options?: { priority?: number; delay?: number; queue?: "interactive" | "background" }
): Promise<string> {
  const queue = options?.queue === "interactive" ? getInteractiveQueue() : getBackgroundQueue();
  const job = await queue.add(`scrape:${data.type}`, data, {
    priority: options?.priority,
    delay: options?.delay,
    ...(NO_RETRY_TYPES.has(data.type) ? { attempts: 1 } : {}),
  });
  return job.id!;
}

export async function closeQueue(): Promise<void> {
  await closeAllQueues();
}

export async function closeAllQueues(): Promise<void> {
  const queues: [string, { close(): Promise<void> } | null][] = [
    ["background", _backgroundQueue],
    ["interactive", _interactiveQueue],
    ["emailInstant", _emailInstantQueue],
    ["emailBulk", _emailBulkQueue],
    ["notifications", _notificationsQueue],
  ];
  await Promise.all(
    queues.map(async ([, q]) => { if (q) await q.close(); })
  );
  _backgroundQueue = null;
  _interactiveQueue = null;
  _emailInstantQueue = null;
  _emailBulkQueue = null;
  _notificationsQueue = null;
}
