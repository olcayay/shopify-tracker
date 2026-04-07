import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });

// Initialize Sentry before other imports
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { createDb, createHealthCheckDb, closeDb, accounts, users } from "@appranks/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validateEnv, API_REQUIRED_ENV, createLogger } from "@appranks/shared";

const log = createLogger("api");
import { registerAuthMiddleware } from "./middleware/auth.js";
import { RateLimiter } from "./utils/rate-limiter.js";
import { ApiError } from "./utils/api-error.js";
import {
  RATE_LIMIT_AUTHENTICATED_MAX,
  RATE_LIMIT_AUTHENTICATED_WINDOW_MS,
  RATE_LIMIT_UNAUTHENTICATED_MAX,
  RATE_LIMIT_UNAUTHENTICATED_WINDOW_MS,
  RATE_LIMIT_SYSTEM_ADMIN_MAX,
  RATE_LIMIT_SYSTEM_ADMIN_WINDOW_MS,
  DEFAULT_MAX_TRACKED_APPS,
  DEFAULT_MAX_TRACKED_KEYWORDS,
  DEFAULT_MAX_COMPETITOR_APPS,
  REDIS_CONNECT_TIMEOUT_MS,
} from "./constants.js";
import { categoryRoutes } from "./routes/categories.js";
import { appRoutes } from "./routes/apps.js";
import { keywordRoutes } from "./routes/keywords.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { systemAdminRoutes } from "./routes/system-admin.js";
import { invitationRoutes } from "./routes/invitations.js";
import { featureRoutes } from "./routes/features.js";
import { integrationRoutes } from "./routes/integrations.js";
import { liveSearchRoutes } from "./routes/live-search.js";
import { featuredAppRoutes } from "./routes/featured-apps.js";
import { researchRoutes } from "./routes/research.js";
import { platformRoutes } from "./routes/platforms.js";
import { platformAttributeRoutes } from "./routes/platform-attributes.js";
import { developerRoutes } from "./routes/developers.js";
import { exportRoutes } from "./routes/export.js";
import { crossPlatformRoutes } from "./routes/cross-platform.js";
import { templateRoutes } from "./routes/templates.js";
import { adminRoutes } from "./routes/admin.js";
import { dlqRoutes } from "./routes/dlq.js";
import { featureFlagRoutes } from "./routes/feature-flags.js";
import { publicRoutes } from "./routes/public.js";
import { billingRoutes } from "./routes/billing.js";
import { overviewHighlightsRoutes } from "./routes/overview-highlights.js";
import { emailWebhookRoutes } from "./routes/email-webhooks.js";
import { suppressionRoutes } from "./routes/suppression.js";
import { emailAlertRoutes } from "./routes/email-alerts.js";
import { emailAnalyticsRoutes } from "./routes/email-analytics.js";
import { emailSchedulingRoutes } from "./routes/email-scheduling.js";
import { emailLogRoutes } from "./routes/email-logs.js";
import { emailSimulationRoutes } from "./routes/email-simulation.js";
import { emailErrorRoutes } from "./routes/email-errors.js";
import { emailPreferenceRoutes } from "./routes/email-preferences.js";
import { notificationBroadcastRoutes } from "./routes/notification-broadcast.js";
import { emailCampaignRoutes } from "./routes/email-campaigns.js";
import { notificationHealthRoutes } from "./routes/notification-health.js";
import { notificationAnalyticsRoutes } from "./routes/notification-analytics.js";
import { registerIdempotencyOnSend } from "./middleware/idempotency.js";
import Redis from "ioredis";

// Validate required environment variables at startup (fail fast)
validateEnv([...API_REQUIRED_ENV]);

const databaseUrl = process.env.DATABASE_URL!;

let db = createDb(databaseUrl, { max: 5 });
const healthDb = createHealthCheckDb(databaseUrl);

// Proxy that always delegates to the current `db` reference.
// Route handlers capture this proxy at registration time via `const db = app.db`.
// After a pool reset reassigns `db`, the proxy transparently forwards to the new pool.
const dbProxy = new Proxy({} as typeof db, {
  get(_target, prop, receiver) {
    const value = (db as any)[prop];
    if (typeof value === "function") {
      return value.bind(db);
    }
    return value;
  },
  set(_target, prop, value) {
    (db as any)[prop] = value;
    return true;
  },
});

// NOTE: Migrations are now handled by the standalone migration runner
// (packages/db/src/migrate.ts). In Docker, the 'migrate' service runs
// before the API starts. See docker-compose.prod.yml.

// Safety net: ensure critical columns exist even if Drizzle migration tracking
// marked them as applied before the SQL actually ran (PLA-647).
try {
  await db.execute(sql`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "past_due_since" timestamp`);
} catch (e: any) {
  log.warn("schema safety-net check failed (non-fatal)", { error: e.message });
}

// Seed admin user on first run
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const existingAccounts = await db.select().from(accounts).limit(1);
  if (existingAccounts.length === 0) {
    log.info("No accounts found, seeding admin user...");
    const [account] = await db
      .insert(accounts)
      .values({
        name: "Default Account",
        maxTrackedApps: DEFAULT_MAX_TRACKED_APPS,
        maxTrackedKeywords: DEFAULT_MAX_TRACKED_KEYWORDS,
        maxCompetitorApps: DEFAULT_MAX_COMPETITOR_APPS,
      })
      .returning();
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      email: adminEmail.toLowerCase(),
      passwordHash,
      name: "System Admin",
      accountId: account.id,
      role: "owner",
      isSystemAdmin: true,
    });
    log.info("Admin user created", { email: adminEmail });
  }
}

const app = Fastify({
  logger: true,
  requestTimeout: 30_000, // 30s — matches DB statement timeout
});

const allowedOrigins = [
  "https://appranks.io",
  "https://api.appranks.io",
  process.env.DASHBOARD_URL,
  process.env.NEXT_PUBLIC_API_URL,
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
].filter(Boolean) as string[];

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400, // Cache preflight responses for 24 hours
});

// Response compression (gzip/brotli)
import compress from "@fastify/compress";
await app.register(compress);

app.decorate("db", dbProxy);

// Security headers — defense-in-depth alongside Cloudflare
app.addHook("onRequest", async (_request, reply) => {
  reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("x-xss-protection", "0");
  reply.header("referrer-policy", "strict-origin-when-cross-origin");
  reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
});

// Correlation ID: read from x-request-id header or generate a UUID.
// Stored on request.id (Fastify built-in) and echoed back in the response.
app.addHook("onRequest", async (request, reply) => {
  const incomingId = request.headers["x-request-id"];
  if (incomingId && typeof incomingId === "string") {
    (request as any).id = incomingId;
  } else {
    (request as any).id = randomUUID();
  }
  reply.header("x-request-id", request.id);
});

// JWT auth middleware (replaces old API key auth)
registerAuthMiddleware(app);

// Billing guard: block write operations when payment grace period has expired
import { requireActiveBilling } from "./middleware/billing-guard.js";
app.addHook("preHandler", requireActiveBilling());

// Idempotency: cache responses for requests with Idempotency-Key header
registerIdempotencyOnSend(app);

// Retry GET requests once on transient DB connection errors (pool recovery, maintenance)
import { registerDbRetry } from "./middleware/db-retry.js";
registerDbRetry(app);

// Global API rate limiting (runs after auth so request.user is available)
const HEALTH_PATHS = ["/health", "/health/live", "/health/ready"];

const authenticatedLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_AUTHENTICATED_MAX, windowMs: RATE_LIMIT_AUTHENTICATED_WINDOW_MS, namespace: "auth" });
const unauthenticatedLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_UNAUTHENTICATED_MAX, windowMs: RATE_LIMIT_UNAUTHENTICATED_WINDOW_MS, namespace: "unauth" });
const systemAdminLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_SYSTEM_ADMIN_MAX, windowMs: RATE_LIMIT_SYSTEM_ADMIN_WINDOW_MS, namespace: "admin" });

app.addHook("onRequest", async (request, reply) => {
  // Skip rate limiting for health checks and preflight
  if (request.method === "OPTIONS") return;
  if (HEALTH_PATHS.includes(request.url)) return;

  let result: ReturnType<RateLimiter["check"]>;

  if (request.user?.isSystemAdmin && request.url.startsWith("/api/system-admin")) {
    // System admin endpoints: stricter limit keyed by userId
    result = systemAdminLimiter.check(request.user.userId);
  } else if (request.user?.userId) {
    // Authenticated: 200/min keyed by userId
    result = authenticatedLimiter.check(request.user.userId);
  } else {
    // Unauthenticated: 30/min keyed by IP
    result = unauthenticatedLimiter.check(request.ip);
  }

  // Set rate limit headers on every response
  reply.header("x-ratelimit-limit", result.limit.toString());
  reply.header("x-ratelimit-remaining", Math.max(0, result.remaining).toString());
  reply.header("x-ratelimit-reset", Math.ceil(result.resetAt / 1000).toString());

  if (!result.allowed) {
    reply.header("Retry-After", Math.ceil(result.retryAfterMs / 1000).toString());
    return reply.code(429).send({ error: "Too many requests. Please try again later." });
  }
});

// Register routes
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(categoryRoutes, { prefix: "/api/categories" });
await app.register(appRoutes, { prefix: "/api/apps" });
await app.register(keywordRoutes, { prefix: "/api/keywords" });
await app.register(accountRoutes, { prefix: "/api/account" });
await app.register(systemAdminRoutes, { prefix: "/api/system-admin" });
await app.register(templateRoutes, { prefix: "/api/system-admin" });
await app.register(invitationRoutes, { prefix: "/api/invitations" });
await app.register(featureRoutes, { prefix: "/api/features" });
await app.register(integrationRoutes, { prefix: "/api/integrations" });
await app.register(liveSearchRoutes, { prefix: "/api/live-search" });
await app.register(featuredAppRoutes, { prefix: "/api/featured-apps" });
await app.register(researchRoutes, { prefix: "/api/research-projects" });
await app.register(platformRoutes, { prefix: "/api/platforms" });
await app.register(platformAttributeRoutes, { prefix: "/api/platform-attributes" });
await app.register(developerRoutes, { prefix: "/api/developers" });
await app.register(exportRoutes, { prefix: "/api/export" });
await app.register(billingRoutes, { prefix: "/api/billing" });
await app.register(crossPlatformRoutes, { prefix: "/api/cross-platform" });
await app.register(overviewHighlightsRoutes, { prefix: "/api/overview" });
await app.register(adminRoutes, { prefix: "/api/admin" });
await app.register(featureFlagRoutes, { prefix: "/api/system-admin/feature-flags" });
await app.register(dlqRoutes, { prefix: "/api/system-admin/dlq" });
await app.register(suppressionRoutes, { prefix: "/api/system-admin/suppression" });
await app.register(emailAlertRoutes, { prefix: "/api/system-admin/email-alerts" });
await app.register(emailAnalyticsRoutes, { prefix: "/api/system-admin/email-analytics" });
await app.register(emailSchedulingRoutes, { prefix: "/api/system-admin/email-scheduling" });
await app.register(emailLogRoutes, { prefix: "/api/system-admin/email-logs" });
await app.register(emailSimulationRoutes, { prefix: "/api/system-admin/email-simulation" });
await app.register(emailErrorRoutes, { prefix: "/api/system-admin/email-errors" });
await app.register(emailPreferenceRoutes, { prefix: "/api/email-preferences" });
await app.register(notificationBroadcastRoutes, { prefix: "/api/system-admin/notifications" });
await app.register(emailCampaignRoutes, { prefix: "/api/system-admin/email" });
await app.register(notificationHealthRoutes, { prefix: "/api/system-admin/notification-health" });
await app.register(notificationAnalyticsRoutes, { prefix: "/api/system-admin/notification-analytics" });
await app.register(emailWebhookRoutes, { prefix: "/api/webhooks/email" });
await app.register(publicRoutes, { prefix: "/api/public" });

// Notification endpoints (authenticated)
const { notificationRoutes } = await import("./routes/notifications.js");
await app.register(notificationRoutes, { prefix: "/api/notifications" });

// Notification SSE stream (authenticated)
const { notificationStreamRoutes } = await import("./routes/notification-stream.js");
await app.register(notificationStreamRoutes, { prefix: "/api/notifications" });

// Email tracking and unsubscribe (public — no auth required)
const { emailTrackingRoutes } = await import("./routes/email-tracking.js");
await app.register(emailTrackingRoutes, { prefix: "/api/emails" });

// Admin email management (requires system admin auth)
const { adminEmailRoutes } = await import("./routes/admin-emails.js");
await app.register(adminEmailRoutes, { prefix: "/api/system-admin" });
const { adminNotificationRoutes } = await import("./routes/admin-notifications.js");
await app.register(adminNotificationRoutes, { prefix: "/api/system-admin" });

// AI content generation (requires system admin auth)
const { aiContentRoutes } = await import("./routes/ai-content.js");
await app.register(aiContentRoutes, { prefix: "/api/system-admin/ai" });

// Cache-Control + ETag headers based on route patterns
app.addHook("onSend", async (request, reply, payload) => {
  // Skip non-GET requests and already-set headers
  if (request.method !== "GET" || reply.getHeader("cache-control")) return;

  const url = request.url.split("?")[0];

  // No cache: auth, account, admin, mutations
  if (url.startsWith("/api/auth") || url.startsWith("/api/account") || url.startsWith("/api/system-admin") || url.startsWith("/api/admin")) {
    reply.header("cache-control", "private, no-cache");
    return;
  }

  // Public endpoints: long cache (1 hour)
  if (url.startsWith("/api/public/")) {
    reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
    reply.header("vary", "Accept-Encoding");
  }
  // Long cache (1 hour): platform list, feature tree
  else if (url === "/api/platforms" || url === "/api/features/tree") {
    reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=7200");
    reply.header("vary", "Accept-Encoding");
  }
  // Medium cache (5 min): app detail, category detail, keyword detail, scores
  else if (url.match(/^\/api\/(apps|categories|keywords|developers)\/[^/]+$/) ||
      url.match(/^\/api\/apps\/[^/]+\/(scores|rankings|changes|reviews|similar|featured|ads)/)) {
    reply.header("cache-control", "public, max-age=300, stale-while-revalidate=600");
    reply.header("vary", "Accept-Encoding");
  }
  // Short cache (1 min): list endpoints, featured apps
  else if (url.match(/^\/api\/(categories|featured-apps|integrations|platform-attributes)\/?$/) ||
      url.match(/^\/api\/categories\?/)) {
    reply.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
    reply.header("vary", "Accept-Encoding");
  }
  // Authenticated endpoints: private, short cache
  else {
    reply.header("cache-control", "private, max-age=30");
  }

  // ETag support for public cacheable responses
  if (payload && typeof payload === "string" && reply.getHeader("cache-control")?.toString().includes("public")) {
    const { createHash } = await import("crypto");
    const etag = `"${createHash("md5").update(payload).digest("hex").slice(0, 16)}"`;
    reply.header("etag", etag);

    const ifNoneMatch = request.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      reply.code(304);
      return "";
    }
  }
});

// Prometheus metrics endpoint
import { formatMetrics, registerMetricsHooks, setGauge } from "./utils/metrics.js";
registerMetricsHooks(app);

app.get("/metrics", async (request, reply) => {
  // In production, require either system admin JWT or METRICS_BEARER_TOKEN
  if (process.env.NODE_ENV === "production") {
    const metricsToken = process.env.METRICS_BEARER_TOKEN;
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const hasValidMetricsToken = metricsToken && bearerToken === metricsToken;

    if (!request.user?.isSystemAdmin && !hasValidMetricsToken) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  }
  reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
  return formatMetrics();
});

// Shallow health check — always responds (for load balancer liveness probes)
app.get("/health/live", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Deep health check — verifies DB + Redis connectivity (for readiness probes)
// Uses dedicated healthDb (separate single-connection pool) so it never blocks
// when the main pool is stuck.
app.get("/health/ready", async (_request, reply) => {
  const checks: Record<string, Record<string, unknown>> = {};

  // DB check — uses dedicated health check connection, not main pool
  const dbStart = Date.now();
  try {
    await healthDb.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", latencyMs: Date.now() - dbStart, error: String(err) };
  }

  // Main pool diagnostics — query pg_stat_activity via healthDb (not main pool)
  const poolStats = getPoolStats();
  let connections: Record<string, unknown> = {};
  let poolStatus = "ok";
  try {
    // Fetch max_connections separately — Cloud SQL restricts pg_settings access
    let dbMaxConnections = 25; // default for db-f1-micro
    try {
      const [maxConnRow] = await healthDb.execute(sql`SHOW max_connections`) as any;
      if (maxConnRow?.max_connections) dbMaxConnections = Number(maxConnRow.max_connections);
    } catch { /* fallback to default */ }
    const [connInfo] = await healthDb.execute(sql`
      SELECT
        count(*) FILTER (WHERE state = 'active') AS active_connections,
        count(*) FILTER (WHERE state = 'idle') AS idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
        count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_on_lock,
        count(*) AS total_connections,
        max(EXTRACT(EPOCH FROM (now() - query_start)))::int AS longest_query_secs
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
    `) as any;
    if (connInfo) {
      const active = Number(connInfo.active_connections ?? 0);
      const maxConn = dbMaxConnections;
      const idleInTx = Number(connInfo.idle_in_transaction ?? 0);
      connections = {
        active,
        idle: Number(connInfo.idle_connections ?? 0),
        idleInTransaction: idleInTx,
        waitingOnLock: Number(connInfo.waiting_on_lock ?? 0),
        total: Number(connInfo.total_connections ?? 0),
        max: maxConn,
        longestQuerySecs: connInfo.longest_query_secs != null ? Number(connInfo.longest_query_secs) : null,
      };
      if (poolCheckFailures > 0 || active >= maxConn) {
        poolStatus = "error";
      } else if (active >= maxConn * 0.8 || idleInTx > 0) {
        poolStatus = "warning";
      }
    }
  } catch {
    // Non-critical — fall back to basic pool status
  }

  checks.mainPool = {
    status: poolCheckFailures > 0 ? "error" : poolStatus,
    config: poolStats,
    connections,
    consecutiveFailures: poolCheckFailures,
  };

  // Redis check
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redisStart = Date.now();
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, { connectTimeout: REDIS_CONNECT_TIMEOUT_MS, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: "error", latencyMs: Date.now() - redisStart, error: String(err) };
  } finally {
    if (redis) redis.disconnect();
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const statusCode = allOk ? 200 : 503;

  return reply.code(statusCode).send({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Legacy /health endpoint — deep check for backwards compatibility
// Uses dedicated healthDb so it never blocks when main pool is stuck.
app.get("/health", async (_request, reply) => {
  const checks: Record<string, string> = {};

  try {
    await healthDb.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, { connectTimeout: REDIS_CONNECT_TIMEOUT_MS, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  } finally {
    if (redis) redis.disconnect();
  }

  const allOk = Object.values(checks).every((c) => c === "ok");
  return reply.code(allOk ? 200 : 503).send({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Error handler
app.setErrorHandler<Error & { statusCode?: number }>((error, request, reply) => {
  const requestId = request.id;

  // Premature close — client disconnected before response completed.
  // Expected with Cloudflare proxy timeouts and browser navigation.
  // Log at info level, not error/fatal.
  if (error.message === "premature close" || (error as any).code === "ERR_STREAM_PREMATURE_CLOSE") {
    request.log.info({ reqId: requestId, url: request.url }, "client disconnected (premature close)");
    return;
  }

  // ApiError — standardized error responses
  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send(error.toJSON(requestId));
  }

  // Zod validation errors → 400 with field-level details
  if (error.name === "ZodError" && "issues" in error) {
    const zodError = error as import("zod").ZodError;
    const fieldErrors = zodError.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return reply.code(400).send({
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: fieldErrors },
      requestId,
    });
  }

  // Database connection/query errors → 503 Service Unavailable
  const errMsg = error.message || "";
  const isDbError =
    errMsg.includes("connection") ||
    errMsg.includes("ECONNREFUSED") ||
    errMsg.includes("timeout") ||
    errMsg.includes("too many clients") ||
    errMsg.includes("terminating connection") ||
    error.constructor?.name === "PostgresError";

  if (isDbError) {
    app.log.error({ err: error, requestId }, "database error");
    return reply.code(503).send({
      error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" },
      requestId,
    });
  }

  // Report unhandled errors to Sentry
  Sentry.captureException(error, { extra: { requestId, url: request.url, method: request.method } });

  app.log.error({ err: error, requestId }, "unhandled error");
  reply.code(error.statusCode ?? 500).send({
    error: { code: "INTERNAL_ERROR", message: error.message || "Internal Server Error" },
    requestId,
  });
});

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`API server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Scheduled cleanup for expired tokens, invitations, and email logs
import { startScheduledCleanup } from "./utils/scheduled-cleanup.js";
startScheduledCleanup(db);

// Pool health monitor — detect stuck pool and actively recover.
// Runs every 30s. If main pool can't respond in 5s, it's likely stuck.
// On 3rd failure: reset pool (close + recreate). On 7th failure: process.exit.
const POOL_CHECK_INTERVAL_MS = 30_000;
const POOL_CHECK_TIMEOUT_MS = 5_000;
const POOL_RESET_THRESHOLD = 3;
const POOL_EXIT_THRESHOLD = 7;
let poolCheckFailures = 0;
let poolResetCount = 0;

function getPoolStats(): Record<string, unknown> {
  try {
    const pgClient = (db as any).__pgClient;
    if (!pgClient) return { note: "no pg client ref" };
    const opts = pgClient.options || {};
    return {
      maxConnections: opts.max ?? "?",
      idleTimeout: opts.idle_timeout ?? "?",
      maxLifetime: opts.max_lifetime ?? "?",
    };
  } catch {
    return { note: "failed to read pool stats" };
  }
}

async function getRuntimeConnections(): Promise<Record<string, unknown>> {
  try {
    const [connInfo] = await healthDb.execute(sql`
      SELECT count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE state = 'idle') AS idle,
             count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
             count(*) AS total
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid != pg_backend_pid()
    `) as any;
    if (connInfo) {
      return { active: Number(connInfo.active), idle: Number(connInfo.idle), idleInTx: Number(connInfo.idle_in_tx), total: Number(connInfo.total) };
    }
  } catch { /* non-critical */ }
  return {};
}

async function resetPool(): Promise<boolean> {
  poolResetCount++;
  app.log.warn(`Attempting pool reset #${poolResetCount}...`);
  try {
    const oldDb = db;
    // Check connection headroom before creating new pool
    const conns = await getRuntimeConnections();
    const totalConns = Number(conns.total ?? 0);
    if (totalConns >= 20) {
      app.log.warn(`Near connection limit (${totalConns}/25) — closing old pool first`);
      await closeDb(oldDb).catch(() => {});
    }
    // Create new pool, then close old one
    const newDb = createDb(databaseUrl, { max: 5 });
    // Verify new pool works
    await Promise.race([
      newDb.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("new_pool_timeout")), POOL_CHECK_TIMEOUT_MS)),
    ]);
    // New pool works — swap it in.
    // dbProxy (used by all routes via app.db) automatically delegates to
    // the module-level `db`, so reassigning here propagates everywhere.
    db = newDb;
    // Close old pool in background (don't block on stuck connections)
    if (totalConns < 20) {
      closeDb(oldDb).catch(() => {});
    }
    app.log.info(`Pool reset #${poolResetCount} successful — new pool is healthy`);
    setGauge("db_pool_stuck", 0, "Whether the main DB pool is stuck (1=stuck, 0=healthy)");
    setGauge("db_pool_resets", poolResetCount, "Total number of pool resets since process start");
    return true;
  } catch (err) {
    app.log.error({ msg: `Pool reset #${poolResetCount} failed`, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

const poolMonitorInterval = setInterval(async () => {
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("pool_monitor_timeout")), POOL_CHECK_TIMEOUT_MS)
      ),
    ]);
    if (poolCheckFailures > 0) {
      app.log.info(`DB pool recovered after ${poolCheckFailures} failed checks`);
      setGauge("db_pool_stuck", 0, "Whether the main DB pool is stuck (1=stuck, 0=healthy)");
    }
    poolCheckFailures = 0;
  } catch (err) {
    poolCheckFailures++;
    setGauge("db_pool_stuck", 1, "Whether the main DB pool is stuck (1=stuck, 0=healthy)");
    const poolStats = getPoolStats();
    const runtimeConnections = await getRuntimeConnections();
    app.log.error({
      msg: `DB pool health check failed (${poolCheckFailures} consecutive).`,
      consecutiveFailures: poolCheckFailures,
      error: err instanceof Error ? err.message : String(err),
      pool: poolStats,
      connections: runtimeConnections,
    });

    // Active recovery: reset pool on threshold
    if (poolCheckFailures === POOL_RESET_THRESHOLD) {
      import("./utils/alerts.js").then(({ alerts }) => alerts.dbConnectionFailed(`${poolCheckFailures} consecutive failures — attempting pool reset. Pool: ${JSON.stringify(poolStats)}`)).catch(() => {});
      const recovered = await resetPool();
      if (recovered) {
        poolCheckFailures = 0;
        return;
      }
    }

    // Last resort: process.exit after extended failure (even after reset attempt)
    if (poolCheckFailures >= POOL_EXIT_THRESHOLD) {
      app.log.error(`DB pool stuck for ${poolCheckFailures * 30}s (after ${poolResetCount} reset attempts) — forcing process restart`);
      clearInterval(poolMonitorInterval);
      process.exit(1);
    }
  }
}, POOL_CHECK_INTERVAL_MS);

// Don't let the interval keep the process alive if it's shutting down
poolMonitorInterval.unref();

// Connection warming — keep at least 1 connection alive in the pool.
// Runs every 60s. Also serves as early failure detection.
const WARM_INTERVAL_MS = 60_000;
const warmingInterval = setInterval(async () => {
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("warming_timeout")), POOL_CHECK_TIMEOUT_MS)),
    ]);
  } catch {
    // Don't increment poolCheckFailures here — the pool monitor handles that.
    // This just ensures the pool periodically exercises a connection.
    app.log.warn("Connection warming query failed — pool monitor will handle recovery");
  }
}, WARM_INTERVAL_MS);
warmingInterval.unref();

// Graceful shutdown — finish in-flight requests, close connections
async function shutdown(signal: string) {
  log.info(`${signal} received, starting graceful shutdown...`);
  clearInterval(poolMonitorInterval);
  clearInterval(warmingInterval);
  try {
    await app.close(); // stops accepting, waits for in-flight requests
    log.info("Server closed gracefully");
  } catch (err) {
    log.error("Error during shutdown", { error: String(err) });
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
