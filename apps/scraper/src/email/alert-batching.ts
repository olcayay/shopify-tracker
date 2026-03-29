/**
 * Alert batching and quiet hours system.
 *
 * Collects alert events within a time window and merges them
 * into batched notifications when thresholds are exceeded.
 * Respects quiet hours per user timezone.
 */
import { getLocalTime } from "./timezone.js";

export interface AlertEvent {
  userId: string;
  accountId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
}

export interface BatchedAlert {
  userId: string;
  accountId: string;
  category: string;
  events: AlertEvent[];
  mergedTitle: string;
  mergedBody: string;
}

// Configuration
const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_THRESHOLD = 3; // Merge when > 3 events of same category
const QUIET_HOURS_START = 22; // 10 PM local time
const QUIET_HOURS_END = 7; // 7 AM local time

// In-memory buffer (per-user per-category)
const eventBuffer = new Map<string, AlertEvent[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();

/**
 * Check if current time is within quiet hours for a user's timezone.
 */
export function isQuietHours(now: Date, timezone: string): boolean {
  const local = getLocalTime(now, timezone);
  return local.hour >= QUIET_HOURS_START || local.hour < QUIET_HOURS_END;
}

/**
 * Add an alert event to the batch buffer.
 * Returns immediately batched alerts if threshold is met, or null if buffered.
 */
export function addToBatch(event: AlertEvent): BatchedAlert | null {
  const key = `${event.userId}:${event.category}`;
  const buffer = eventBuffer.get(key) || [];
  buffer.push(event);
  eventBuffer.set(key, buffer);

  // Check if we should flush
  if (buffer.length > BATCH_THRESHOLD) {
    return flushBatch(key);
  }

  // Set timer for first event in window
  if (!batchTimers.has(key)) {
    batchTimers.set(
      key,
      setTimeout(() => {
        flushBatch(key);
        batchTimers.delete(key);
      }, BATCH_WINDOW_MS)
    );
  }

  return null;
}

/**
 * Flush a batch buffer and return the merged alert.
 */
export function flushBatch(key: string): BatchedAlert | null {
  const events = eventBuffer.get(key);
  if (!events || events.length === 0) return null;

  eventBuffer.delete(key);
  const timer = batchTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    batchTimers.delete(key);
  }

  // If only 1-3 events, don't merge
  if (events.length <= BATCH_THRESHOLD) {
    return null; // These should be sent individually
  }

  const first = events[0];
  const categoryLabel = first.category.charAt(0).toUpperCase() + first.category.slice(1);

  return {
    userId: first.userId,
    accountId: first.accountId,
    category: first.category,
    events,
    mergedTitle: `${events.length} ${categoryLabel} updates`,
    mergedBody: `${events.length} ${first.category} changes detected in the last few minutes.`,
  };
}

/**
 * Flush all pending batches (e.g., on shutdown).
 */
export function flushAllBatches(): BatchedAlert[] {
  const results: BatchedAlert[] = [];
  for (const key of eventBuffer.keys()) {
    const batch = flushBatch(key);
    if (batch) results.push(batch);
  }
  return results;
}

/**
 * Get pending event count for a user+category.
 */
export function getPendingCount(userId: string, category: string): number {
  const key = `${userId}:${category}`;
  return eventBuffer.get(key)?.length || 0;
}

/**
 * Clear all buffers (for testing).
 */
export function clearAllBuffers(): void {
  for (const timer of batchTimers.values()) clearTimeout(timer);
  eventBuffer.clear();
  batchTimers.clear();
}

export { BATCH_WINDOW_MS, BATCH_THRESHOLD, QUIET_HOURS_START, QUIET_HOURS_END };
