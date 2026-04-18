/**
 * Test helper for API route testing.
 *
 * Creates a Fastify instance with mocked DB and JWT auth,
 * allowing HTTP-level testing via .inject().
 */
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../middleware/auth.js";

const TEST_JWT_SECRET = "test-secret-key-for-testing-only";
process.env.JWT_SECRET = TEST_JWT_SECRET;

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

/** Creates a chainable mock that resolves to the given value */
function chainable(resolveValue: any = []) {
  const chain: any = {};
  const methods = [
    "select", "selectDistinctOn", "from", "where", "leftJoin", "innerJoin", "rightJoin",
    "orderBy", "groupBy", "limit", "offset", "as", "having",
    "insert", "values", "returning", "onConflictDoUpdate", "onConflictDoNothing",
    "update", "set", "delete",
  ];
  for (const m of methods) {
    chain[m] = (..._args: any[]) => chain;
  }
  // Make it thenable so `await db.select()...` resolves
  chain.then = (resolve: any, reject?: any) => {
    return Promise.resolve(resolveValue).then(resolve, reject);
  };
  return chain;
}

export interface MockDbOverrides {
  /** Default result for select chains */
  selectResult?: any;
  /** Sequential results for select chains — each call shifts the next result */
  selectResults?: any[];
  /** Default result for insert().values().returning() chains */
  insertResult?: any;
  /** Custom handler per table (keyed by table symbol name) */
  tables?: Record<string, {
    select?: any;
    insert?: any;
    update?: any;
    delete?: any;
  }>;
  /** Override execute() for raw SQL */
  executeResult?: any;
}

function makeSelectFn(overrides: MockDbOverrides) {
  if (overrides.selectResults) {
    const queue = [...overrides.selectResults];
    return () => chainable(queue.length > 0 ? queue.shift() : overrides.selectResult ?? []);
  }
  return () => chainable(overrides.selectResult ?? []);
}

export function createMockDb(overrides: MockDbOverrides = {}) {
  const selectFn = makeSelectFn(overrides);
  const db: any = {
    select: (...args: any[]) => selectFn(),
    selectDistinct: (...args: any[]) => selectFn(),
    selectDistinctOn: (...args: any[]) => selectFn(),
    insert: (...args: any[]) => chainable(overrides.insertResult ?? []),
    update: (...args: any[]) => chainable([]),
    delete: (...args: any[]) => chainable([]),
    execute: (...args: any[]) => Promise.resolve(overrides.executeResult ?? []),
    // For raw SQL template tag
    query: (...args: any[]) => Promise.resolve([]),
    // Transaction support: the callback receives a tx object with the same
    // chainable interface, then returns whatever the callback returns.
    transaction: async (fn: (tx: any) => Promise<any>) => {
      const txSelectFn = makeSelectFn(overrides);
      const tx: any = {
        select: (...args: any[]) => txSelectFn(),
        selectDistinct: (...args: any[]) => txSelectFn(),
        selectDistinctOn: (...args: any[]) => txSelectFn(),
        insert: (...args: any[]) => chainable(overrides.insertResult ?? []),
        update: (...args: any[]) => chainable([]),
        delete: (...args: any[]) => chainable([]),
        execute: (...args: any[]) => Promise.resolve(overrides.executeResult ?? []),
        query: (...args: any[]) => Promise.resolve([]),
      };
      return fn(tx);
    },
  };
  return db;
}

// ---------------------------------------------------------------------------
// JWT Token generation
// ---------------------------------------------------------------------------

export function generateTestToken(payload: Partial<JwtPayload> = {}): string {
  const defaultPayload: JwtPayload = {
    userId: "user-001",
    email: "user@test.com",
    accountId: "account-001",
    role: "owner",
    isSystemAdmin: false,
    ...payload,
  };
  return jwt.sign(defaultPayload, TEST_JWT_SECRET, { expiresIn: "15m" });
}

export function adminToken(overrides: Partial<JwtPayload> = {}): string {
  return generateTestToken({
    userId: "admin-001",
    email: "admin@test.com",
    accountId: "account-admin",
    role: "owner",
    isSystemAdmin: true,
    ...overrides,
  });
}

export function userToken(overrides: Partial<JwtPayload> = {}): string {
  return generateTestToken({
    userId: "user-001",
    email: "user@test.com",
    accountId: "account-001",
    role: "editor",
    isSystemAdmin: false,
    ...overrides,
  });
}

export function viewerToken(overrides: Partial<JwtPayload> = {}): string {
  return generateTestToken({
    userId: "viewer-001",
    email: "viewer@test.com",
    accountId: "account-001",
    role: "viewer",
    isSystemAdmin: false,
    ...overrides,
  });
}

export function impersonationToken(overrides: Partial<JwtPayload> = {}): string {
  return generateTestToken({
    userId: "user-001",
    email: "user@test.com",
    accountId: "account-001",
    role: "editor",
    isSystemAdmin: true,
    realAdmin: {
      userId: "admin-001",
      email: "admin@test.com",
      accountId: "account-admin",
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Test app builder
// ---------------------------------------------------------------------------

export interface TestAppOptions {
  /** Route plugin to register */
  routes: (app: FastifyInstance) => Promise<void>;
  /** Route prefix */
  prefix: string;
  /** Mock DB overrides */
  db?: MockDbOverrides;
}

export async function buildTestApp(options: TestAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Global error handler (mirrors production in src/index.ts)
  app.setErrorHandler((error, _request, reply) => {
    // ApiError — standardized error responses
    if (error.name === "ApiError" && "toJSON" in error) {
      const apiError = error as import("../../utils/api-error.js").ApiError;
      return reply.code(apiError.statusCode).send(apiError.toJSON());
    }

    if (error.name === "ZodError" && "issues" in error) {
      const zodError = error as import("zod").ZodError;
      const fieldErrors = zodError.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return reply.code(400).send({
        error: "Validation failed",
        details: fieldErrors,
      });
    }
    reply.code(error.statusCode ?? 500).send({
      error: error.message || "Internal Server Error",
    });
  });

  const mockDb = createMockDb(options.db);
  app.decorate("db", mockDb);
  app.decorate("writeDb", mockDb);

  // Register auth middleware
  const { registerAuthMiddleware } = await import("../../middleware/auth.js");

  // Override the DB-dependent parts of the middleware
  // by patching the onRequest hook to skip DB calls
  app.decorateRequest("user", null as unknown as JwtPayload);
  app.decorateRequest("isImpersonating", false);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const publicPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/verify-email", "/api/invitations/", "/api/billing/webhook"];
    const fullUrl = request.url;
    if (publicPaths.some((p) => fullUrl.startsWith(p))) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET) as JwtPayload;
      request.user = payload;
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    request.isImpersonating = !!request.user.realAdmin;

    // System admin route check
    if (request.url.startsWith("/api/system-admin") && !request.user.isSystemAdmin) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  });

  // Register the routes
  await app.register(
    async (instance) => {
      // Make db accessible to routes
      instance.db = mockDb;
      instance.writeDb = mockDb;
      await options.routes(instance);
    },
    { prefix: options.prefix }
  );

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Injection helpers
// ---------------------------------------------------------------------------

export function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}
