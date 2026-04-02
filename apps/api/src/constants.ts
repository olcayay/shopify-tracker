/**
 * API-wide constants extracted from magic numbers across the codebase.
 */

// ── Pagination defaults ─────────────────────────────────────────────
/** Default page size when no limit is specified */
export const PAGINATION_DEFAULT_LIMIT = 50;
/** Maximum allowed page size for most endpoints */
export const PAGINATION_MAX_LIMIT = 200;
/** Maximum page size for cross-platform / developer list endpoints */
export const PAGINATION_MAX_LIMIT_SMALL = 100;
/** Maximum page size for AI logs endpoint */
export const PAGINATION_MAX_LIMIT_AI_LOGS = 250;
/** Default page size for developer apps sub-list */
export const PAGINATION_DEFAULT_DEVELOPER_APPS = 20;
/** Maximum page size for developer apps sub-list */
export const PAGINATION_MAX_DEVELOPER_APPS = 50;
/** Live search result limit */
export const LIVE_SEARCH_LIMIT = 50;

// ── Rate limiting ───────────────────────────────────────────────────
/** Authenticated user: max requests per window */
export const RATE_LIMIT_AUTHENTICATED_MAX = 200;
/** Authenticated user: window duration in ms (1 minute) */
export const RATE_LIMIT_AUTHENTICATED_WINDOW_MS = 60_000;
/** Unauthenticated IP: max requests per window */
export const RATE_LIMIT_UNAUTHENTICATED_MAX = 30;
/** Unauthenticated IP: window duration in ms (1 minute) */
export const RATE_LIMIT_UNAUTHENTICATED_WINDOW_MS = 60_000;
/** System admin: max requests per window */
export const RATE_LIMIT_SYSTEM_ADMIN_MAX = 20;
/** System admin: window duration in ms (1 minute) */
export const RATE_LIMIT_SYSTEM_ADMIN_WINDOW_MS = 60_000;
/** Login endpoint: max attempts per window */
export const RATE_LIMIT_LOGIN_MAX = 5;
/** Login endpoint: window duration in ms (15 minutes) */
export const RATE_LIMIT_LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Register endpoint: max attempts per window */
export const RATE_LIMIT_REGISTER_MAX = 3;
/** Register endpoint: window duration in ms (1 hour) */
export const RATE_LIMIT_REGISTER_WINDOW_MS = 60 * 60 * 1000;
/** Rate limiter internal cleanup interval in ms (5 minutes) */
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ── Password Reset ─────────────────────────────────────────────────
/** Password reset: max attempts per window */
export const RATE_LIMIT_PASSWORD_RESET_MAX = 3;
/** Password reset: window duration in ms (1 hour) */
export const RATE_LIMIT_PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
/** Password reset token lifetime in ms (1 hour) */
export const PASSWORD_RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

// ── Auth / JWT ──────────────────────────────────────────────────────
/** Access token lifetime */
export const ACCESS_TOKEN_EXPIRY = "15m";
/** Refresh token lifetime in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// ── Default account limits ──────────────────────────────────────────
/** Max tracked apps for a new account */
export const DEFAULT_MAX_TRACKED_APPS = 100;
/** Max tracked keywords for a new account */
export const DEFAULT_MAX_TRACKED_KEYWORDS = 100;
/** Max competitor apps for a new account */
export const DEFAULT_MAX_COMPETITOR_APPS = 50;

// ── Redis ───────────────────────────────────────────────────────────
/** Redis connection timeout in ms */
export const REDIS_CONNECT_TIMEOUT_MS = 5000;

// ── Dead Letter Queue ──────────────────────────────────────────────
/** DLQ depth threshold that triggers an alert in the response */
export const DLQ_ALERT_THRESHOLD = 20;

// ── Idempotency ────────────────────────────────────────────────────
/** Idempotency cache TTL in seconds (24 hours) */
export const IDEMPOTENCY_TTL_SECONDS = 86_400;
