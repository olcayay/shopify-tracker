/**
 * Scraper-wide constants extracted from magic numbers across the codebase.
 * Platform-specific constants live in each platform's own constants.ts file.
 */

// ── Queue job defaults ──────────────────────────────────────────────
/** Default number of retry attempts for queue jobs */
export const JOB_DEFAULT_ATTEMPTS = 2;
/** Exponential backoff base delay in ms between retries */
export const JOB_BACKOFF_DELAY_MS = 30_000;
/** Keep the last N completed jobs in the queue */
export const JOB_REMOVE_ON_COMPLETE_COUNT = 100;
/** Keep the last N failed jobs in the queue */
export const JOB_REMOVE_ON_FAIL_COUNT = 50;
/** Max number of failed jobs to clean in one batch (BullMQ clean() limit) */
export const QUEUE_CLEAN_FAILED_LIMIT = 1000;

// ── Worker concurrency & locking ────────────────────────────────────
/** Number of background jobs processed concurrently (one per platform) */
export const BACKGROUND_WORKER_CONCURRENCY = 11;
/** Redis distributed lock TTL in ms (auto-expires to prevent deadlocks) */
export const PLATFORM_LOCK_TTL_MS = 300_000; // 5 minutes
/** Maximum time to wait for a platform lock before failing the job */
export const PLATFORM_LOCK_TIMEOUT_MS = 300_000; // 5 minutes
/** Polling interval while waiting for a lock slot */
export const LOCK_POLL_INTERVAL_MS = 500;
/** Graceful shutdown timeout in ms before force-exiting */
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 60_000;

// ── HTTP client defaults ────────────────────────────────────────────
/** Default delay between HTTP requests in ms */
export const HTTP_DEFAULT_DELAY_MS = 2000;
/** Default maximum retry count for HTTP requests */
export const HTTP_DEFAULT_MAX_RETRIES = 4;
/** Default max concurrent HTTP requests */
export const HTTP_DEFAULT_MAX_CONCURRENCY = 2;
/** Maximum allowed HTTP response body size in bytes (20MB) */
export const HTTP_MAX_RESPONSE_SIZE = 20 * 1024 * 1024;
/** Concurrency wait polling interval in ms */
export const HTTP_CONCURRENCY_POLL_MS = 100;
/** Base backoff for 429 rate-limit responses in fetchPage (ms) */
export const HTTP_RATE_LIMIT_BASE_MS = 4_000;
/** Base backoff for 429 rate-limit responses in fetchRaw (ms) */
export const HTTP_RAW_RATE_LIMIT_BASE_MS = 15_000;

// ── Job timeouts (ms) ───────────────────────────────────────────────
export const JOB_TIMEOUT_CATEGORY_MS = 45 * 60 * 1000;
export const JOB_TIMEOUT_KEYWORD_SEARCH_MS = 45 * 60 * 1000;
export const JOB_TIMEOUT_REVIEWS_MS = 45 * 60 * 1000;
export const JOB_TIMEOUT_APP_DETAILS_MS = 30 * 60 * 1000;
export const JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS = 20 * 60 * 1000;
export const JOB_TIMEOUT_COMPUTE_MS = 15 * 60 * 1000;
export const JOB_TIMEOUT_DAILY_DIGEST_MS = 10 * 60 * 1000;
export const JOB_TIMEOUT_DEFAULT_MS = 30 * 60 * 1000;

// ── Batch sizes ─────────────────────────────────────────────────────
/** Chunk size for batch DB queries (e.g. backfill categories) */
export const DB_BATCH_CHUNK_SIZE = 100;

// ── Admin queue inspection ──────────────────────────────────────────
/** Max waiting jobs to fetch when inspecting queue status */
export const QUEUE_INSPECT_WAITING_LIMIT = 50;
/** Max active/delayed/failed jobs to fetch when inspecting queue status */
export const QUEUE_INSPECT_OTHER_LIMIT = 10;
