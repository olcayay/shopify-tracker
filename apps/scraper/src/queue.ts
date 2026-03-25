import { Queue, type ConnectionOptions } from "bullmq";

export const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
export const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";
/** @deprecated Use BACKGROUND_QUEUE_NAME or INTERACTIVE_QUEUE_NAME */
export const QUEUE_NAME = BACKGROUND_QUEUE_NAME;

export type ScraperJobType = "category" | "app_details" | "keyword_search" | "keyword_suggestions" | "reviews" | "daily_digest" | "compute_review_metrics" | "compute_similarity_scores" | "backfill_categories" | "compute_app_scores";

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
}

export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

const defaultJobOptions = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

let _backgroundQueue: Queue<ScraperJobData> | null = null;
let _interactiveQueue: Queue<ScraperJobData> | null = null;

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
  if (_backgroundQueue) {
    await _backgroundQueue.close();
    _backgroundQueue = null;
  }
  if (_interactiveQueue) {
    await _interactiveQueue.close();
    _interactiveQueue = null;
  }
}
