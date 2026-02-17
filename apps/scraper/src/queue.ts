import { Queue, type ConnectionOptions } from "bullmq";

export const QUEUE_NAME = "scraper-jobs";

export type ScraperJobType = "category" | "app_details" | "keyword_search" | "reviews" | "daily_digest";

export interface ScraperJobData {
  type: ScraperJobType;
  /** Optional: specific slug for single-app or single-keyword scrapes */
  slug?: string;
  keyword?: string;
  /** Optional: specific user ID for single-user digest email */
  userId?: string;
  /** Optional: specific account ID for account-level digest email */
  accountId?: string;
  /** Triggered by: "api" | "scheduler" | "cli" */
  triggeredBy: string;
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

let _queue: Queue<ScraperJobData> | null = null;

export function getQueue(): Queue<ScraperJobData> {
  if (!_queue) {
    _queue = new Queue<ScraperJobData>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

export async function enqueueScraperJob(
  data: ScraperJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> {
  const queue = getQueue();
  const job = await queue.add(`scrape:${data.type}`, data, {
    priority: options?.priority,
    delay: options?.delay,
  });
  return job.id!;
}

export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
