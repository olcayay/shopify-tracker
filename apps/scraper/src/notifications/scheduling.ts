/**
 * Notification scheduling (PLA-699).
 * Schedule notifications to be delivered at a specific time.
 * Uses BullMQ delay mechanism.
 */
import { createLogger } from "@appranks/shared";
import type { NotificationJobData } from "@appranks/shared";
import { enqueueNotification, getNotificationsQueue } from "../queue.js";

const log = createLogger("notification:scheduling");

export interface ScheduledNotification {
  jobId: string;
  type: string;
  userId: string;
  scheduledFor: string;
  delayMs: number;
}

/**
 * Schedule a notification to be delivered at a specific time.
 */
export async function scheduleNotification(
  data: NotificationJobData,
  sendAt: Date
): Promise<ScheduledNotification> {
  const delayMs = Math.max(0, sendAt.getTime() - Date.now());

  const jobId = await enqueueNotification(data, { delay: delayMs });

  log.info("notification scheduled", {
    type: data.type,
    userId: data.userId,
    sendAt: sendAt.toISOString(),
    delayMs,
  });

  return {
    jobId,
    type: data.type,
    userId: data.userId,
    scheduledFor: sendAt.toISOString(),
    delayMs,
  };
}

/**
 * Get all pending scheduled notifications.
 */
export async function getScheduledNotifications(): Promise<{
  id: string;
  name: string;
  data: unknown;
  delay: number;
  scheduledFor: string | null;
  createdAt: string;
}[]> {
  const queue = getNotificationsQueue();
  const delayed = await queue.getDelayed();

  return delayed.map((j) => ({
    id: j.id!,
    name: j.name,
    data: j.data,
    delay: j.opts?.delay ?? 0,
    scheduledFor: j.opts?.delay
      ? new Date(j.timestamp + (j.opts.delay ?? 0)).toISOString()
      : null,
    createdAt: new Date(j.timestamp).toISOString(),
  }));
}

/**
 * Cancel a scheduled notification.
 */
export async function cancelScheduledNotification(jobId: string): Promise<boolean> {
  const queue = getNotificationsQueue();
  const job = await queue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "delayed") {
    await job.remove();
    log.info("scheduled notification cancelled", { jobId });
    return true;
  }
  return false;
}
