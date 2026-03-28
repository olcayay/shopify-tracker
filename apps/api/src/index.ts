import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDb, accounts, users } from "@appranks/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { RateLimiter } from "./utils/rate-limiter.js";
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
import { crossPlatformRoutes } from "./routes/cross-platform.js";
import Redis from "ioredis";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const db = createDb(databaseUrl);

// Pre-migration: add enum values outside of transaction
// (ALTER TYPE ... ADD VALUE cannot run inside a transaction block)
try {
  await db.execute(sql`ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'compute_similarity_scores'`);
} catch (e: any) {
  // Ignore if already exists
  if (!e.message?.includes("already exists")) console.error("Pre-migration enum error:", e.message);
}

// Run pending migrations on startup
console.log("Running database migrations...");
try {
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../../../packages/db/src/migrations") });
  console.log("Database migrations complete.");
} catch (err: any) {
  console.error("Migration ERROR:", err.message || err);
  console.error("Full error:", JSON.stringify(err, null, 2));
}

// Seed admin user on first run
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const existingAccounts = await db.select().from(accounts).limit(1);
  if (existingAccounts.length === 0) {
    console.log("No accounts found, seeding admin user...");
    const [account] = await db
      .insert(accounts)
      .values({
        name: "Default Account",
        maxTrackedApps: 100,
        maxTrackedKeywords: 100,
        maxCompetitorApps: 50,
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
    console.log(`Admin user created: ${adminEmail}`);
  }
}

const app = Fastify({ logger: true });

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
});

app.decorate("db", db);

// JWT auth middleware (replaces old API key auth)
registerAuthMiddleware(app);

// Global API rate limiting (runs after auth so request.user is available)
const HEALTH_PATHS = ["/health", "/health/live", "/health/ready"];

const authenticatedLimiter = new RateLimiter({ maxAttempts: 200, windowMs: 60_000 }); // 200/min per user
const unauthenticatedLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 60_000 }); // 30/min per IP
const systemAdminLimiter = new RateLimiter({ maxAttempts: 20, windowMs: 60_000 }); // 20/min per user

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
await app.register(invitationRoutes, { prefix: "/api/invitations" });
await app.register(featureRoutes, { prefix: "/api/features" });
await app.register(integrationRoutes, { prefix: "/api/integrations" });
await app.register(liveSearchRoutes, { prefix: "/api/live-search" });
await app.register(featuredAppRoutes, { prefix: "/api/featured-apps" });
await app.register(researchRoutes, { prefix: "/api/research-projects" });
await app.register(platformRoutes, { prefix: "/api/platforms" });
await app.register(platformAttributeRoutes, { prefix: "/api/platform-attributes" });
await app.register(developerRoutes, { prefix: "/api/developers" });
await app.register(crossPlatformRoutes, { prefix: "/api/cross-platform" });

// Shallow health check — always responds (for load balancer liveness probes)
app.get("/health/live", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Deep health check — verifies DB + Redis connectivity (for readiness probes)
app.get("/health/ready", async (_request, reply) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", latencyMs: Date.now() - dbStart, error: String(err) };
  }

  // Redis check
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redisStart = Date.now();
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, { connectTimeout: 5000, lazyConnect: true });
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
app.get("/health", async (_request, reply) => {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, { connectTimeout: 5000, lazyConnect: true });
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
app.setErrorHandler((error: any, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({
    error: error.message || "Internal Server Error",
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
