/**
 * Notification priority queue (PLA-701).
 * Maps notification priorities to BullMQ job priorities for processing order.
 * Urgent notifications are processed before low-priority ones.
 */
import { createLogger } from "@appranks/shared";
import type { NotificationJobData } from "@appranks/shared";
import { enqueueNotification } from "../queue.js";

const log = createLogger("notification:priority");

/** BullMQ priority values (lower = higher priority) */
const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

/**
 * Determine the priority level for a notification based on its type.
 */
export function getNotificationPriority(type: string): string {
  const URGENT_TYPES = new Set([
    "system_scrape_failed",
    "account_limit_reached",
  ]);

  const HIGH_TYPES = new Set([
    "ranking_top3_entry",
    "ranking_top3_exit",
    "ranking_dropped_out",
    "competitor_overtook",
    "review_new_negative",
    "account_limit_warning",
  ]);

  const LOW_TYPES = new Set([
    "system_scrape_complete",
    "account_member_joined",
  ]);

  if (URGENT_TYPES.has(type)) return "urgent";
  if (HIGH_TYPES.has(type)) return "high";
  if (LOW_TYPES.has(type)) return "low";
  return "normal";
}

/**
 * Enqueue a notification with automatic priority assignment.
 */
export async function enqueueWithPriority(
  data: NotificationJobData,
  overridePriority?: string
): Promise<string> {
  const priority = overridePriority || getNotificationPriority(data.type);
  const bullmqPriority = PRIORITY_MAP[priority] ?? PRIORITY_MAP.normal;

  const jobId = await enqueueNotification(data, { priority: bullmqPriority });

  log.debug("notification enqueued with priority", {
    type: data.type,
    priority,
    bullmqPriority,
    jobId,
  });

  return jobId;
}
