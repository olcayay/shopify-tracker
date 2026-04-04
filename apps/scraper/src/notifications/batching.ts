/**
 * Notification batching engine (PLA-687).
 *
 * Groups similar notifications within a time window (default 5 minutes)
 * to prevent notification spam. When 3+ events of the same category
 * arrive for the same user within the window, they are merged into
 * a single summary notification.
 *
 * Uses in-memory state (suitable for single-instance; can be replaced
 * with Redis for multi-instance).
 */
import { createLogger } from "@appranks/shared";
import type { NotificationJobData } from "@appranks/shared";

const log = createLogger("notification:batching");

export interface BatchConfig {
  /** Time window in ms (default: 5 minutes) */
  windowMs: number;
  /** Minimum events before merging into batch (default: 3) */
  mergeThreshold: number;
}

interface PendingBatch {
  key: string;
  userId: string;
  accountId: string;
  category: string;
  events: NotificationJobData[];
  windowStart: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_CONFIG: BatchConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  mergeThreshold: 3,
};

/** Map notification job type → category for batching */
const TYPE_TO_CATEGORY: Record<string, string> = {
  notification_ranking_change: "ranking",
  notification_new_competitor: "competitor",
  notification_new_review: "review",
  notification_milestone: "milestone",
  notification_price_change: "competitor",
  notification_category_change: "ranking",
};

/** Urgent types that bypass batching */
const URGENT_TYPES = new Set([
  "notification_milestone",
]);

/** Active batches keyed by `userId:category` */
const batches = new Map<string, PendingBatch>();

/** Callback to flush batched notifications */
type FlushCallback = (events: NotificationJobData[], merged: NotificationJobData) => Promise<void>;

let _flushCallback: FlushCallback | null = null;
let _config = { ...DEFAULT_CONFIG };

/**
 * Configure the batching engine.
 */
export function configureBatching(
  config?: Partial<BatchConfig>,
  onFlush?: FlushCallback
): void {
  if (config) _config = { ..._config, ...config };
  if (onFlush) _flushCallback = onFlush;
}

/**
 * Build a batch key from userId and category.
 */
function batchKey(userId: string, category: string): string {
  return `${userId}:${category}`;
}

/**
 * Check if a notification should be batched.
 * Returns true if the event was added to a batch (caller should NOT enqueue it).
 * Returns false if the event should be sent immediately.
 */
export function shouldBatch(data: NotificationJobData): boolean {
  // Urgent types bypass batching
  if (URGENT_TYPES.has(data.type)) return false;

  const category = TYPE_TO_CATEGORY[data.type];
  if (!category) return false; // Unknown type — send immediately

  const key = batchKey(data.userId, category);
  const now = Date.now();

  const existing = batches.get(key);

  if (existing && (now - existing.windowStart) < _config.windowMs) {
    // Add to existing batch
    existing.events.push(data);
    log.debug("event added to batch", {
      key,
      eventCount: existing.events.length,
      type: data.type,
    });
    return true;
  }

  // Start a new batch window
  const batch: PendingBatch = {
    key,
    userId: data.userId,
    accountId: data.accountId,
    category,
    events: [data],
    windowStart: now,
    timer: null,
  };

  // Set timer to flush when window expires
  batch.timer = setTimeout(() => {
    flushBatch(key);
  }, _config.windowMs);

  batches.set(key, batch);
  log.debug("new batch started", { key, type: data.type });

  return true;
}

/**
 * Flush a batch — merge events if threshold met, else send individually.
 */
async function flushBatch(key: string): Promise<void> {
  const batch = batches.get(key);
  if (!batch) return;

  batches.delete(key);
  if (batch.timer) clearTimeout(batch.timer);

  if (!_flushCallback) {
    log.warn("no flush callback configured — dropping batch", { key, count: batch.events.length });
    return;
  }

  if (batch.events.length >= _config.mergeThreshold) {
    // Merge into a single summary notification
    const merged = buildMergedNotification(batch);
    log.info("batch merged", {
      key,
      eventCount: batch.events.length,
      mergedType: merged.type,
    });
    await _flushCallback(batch.events, merged);
  } else {
    // Below threshold — send each individually
    for (const event of batch.events) {
      await _flushCallback([event], event);
    }
    log.debug("batch flushed individually", { key, count: batch.events.length });
  }
}

/**
 * Build a merged notification from a batch of events.
 */
function buildMergedNotification(batch: PendingBatch): NotificationJobData {
  const count = batch.events.length;
  const first = batch.events[0];

  // Build summary payload
  const summaryPayload: Record<string, unknown> = {
    ...first.payload,
    batchCount: count,
    batchCategory: batch.category,
    batchedEventTypes: [...new Set(batch.events.map((e) => e.type))],
    isBatched: true,
  };

  // Collect unique app names from events
  const appNames = [...new Set(
    batch.events
      .map((e) => e.payload?.appName as string)
      .filter(Boolean)
  )];
  if (appNames.length > 0) {
    summaryPayload.appNames = appNames;
    summaryPayload.appName = appNames.length === 1
      ? appNames[0]
      : `${appNames[0]} and ${appNames.length - 1} more`;
  }

  return {
    type: first.type,
    userId: batch.userId,
    accountId: batch.accountId,
    payload: summaryPayload,
    createdAt: new Date().toISOString(),
    sendPush: first.sendPush,
  };
}

/**
 * Force-flush all pending batches (for graceful shutdown).
 */
export async function flushAllBatches(): Promise<number> {
  const keys = [...batches.keys()];
  for (const key of keys) {
    await flushBatch(key);
  }
  return keys.length;
}

/**
 * Get current batch statistics.
 */
export function getBatchStats(): {
  activeBatches: number;
  totalPendingEvents: number;
  batches: { key: string; category: string; eventCount: number; ageMs: number }[];
} {
  const now = Date.now();
  const stats = [...batches.values()].map((b) => ({
    key: b.key,
    category: b.category,
    eventCount: b.events.length,
    ageMs: now - b.windowStart,
  }));

  return {
    activeBatches: batches.size,
    totalPendingEvents: stats.reduce((sum, b) => sum + b.eventCount, 0),
    batches: stats,
  };
}

/** Reset state (for testing) */
export function _resetBatching(): void {
  for (const batch of batches.values()) {
    if (batch.timer) clearTimeout(batch.timer);
  }
  batches.clear();
  _flushCallback = null;
  _config = { ...DEFAULT_CONFIG };
}
