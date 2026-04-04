/**
 * Email scheduling route tests.
 *
 * The scheduling routes use BullMQ Queue directly, so we mock the module
 * to avoid needing a real Redis connection.
 */
import { buildTestApp, adminToken, userToken, authHeaders } from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// Mock BullMQ Queue — shared mock fns so tests can override behavior
const mockAdd = vi.fn().mockResolvedValue({ id: "job-123" });
const mockGetDelayed = vi.fn().mockResolvedValue([]);
const mockGetJob = vi.fn().mockResolvedValue(null);
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => {
  class MockQueue {
    add = mockAdd;
    getDelayed = mockGetDelayed;
    getJob = mockGetJob;
    close = mockClose;
  }
  return { Queue: MockQueue };
});

// Import after mock setup
const { emailSchedulingRoutes } = await import("../../routes/email-scheduling.js");

async function buildApp(): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailSchedulingRoutes,
    prefix: "/api/system-admin/email-scheduling",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/system-admin/email-scheduling/schedule", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("schedules an email for admin", async () => {
    app = await buildApp();
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-scheduling/schedule",
      headers: authHeaders(adminToken()),
      payload: {
        type: "daily_digest",
        to: "user@test.com",
        payload: { name: "Test User" },
        sendAt: futureDate,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jobId).toBe("job-123");
    expect(body.scheduledFor).toBeDefined();
    expect(body.queue).toBe("email-instant");
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("uses bulk queue when specified", async () => {
    app = await buildApp();
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-scheduling/schedule",
      headers: authHeaders(adminToken()),
      payload: {
        type: "weekly_summary",
        to: "user@test.com",
        payload: {},
        sendAt: futureDate,
        queue: "bulk",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().queue).toBe("email-bulk");
  });

  it("returns 400 when required fields are missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-scheduling/schedule",
      headers: authHeaders(adminToken()),
      payload: { type: "daily_digest" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("required");
  });

  it("returns 400 for invalid sendAt date", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-scheduling/schedule",
      headers: authHeaders(adminToken()),
      payload: {
        type: "daily_digest",
        to: "user@test.com",
        sendAt: "not-a-date",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Invalid sendAt");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-scheduling/schedule",
      headers: authHeaders(userToken()),
      payload: {
        type: "daily_digest",
        to: "user@test.com",
        sendAt: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-scheduling/scheduled", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns scheduled jobs for admin", async () => {
    mockGetDelayed.mockResolvedValue([
      {
        id: "job-1",
        name: "scheduled:daily_digest",
        data: { type: "daily_digest", to: "user@test.com" },
        opts: { delay: 3600000 },
        timestamp: Date.now(),
      },
    ]);
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-scheduling/scheduled",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-scheduling/scheduled",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/system-admin/email-scheduling/:jobId", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("cancels a delayed job for admin", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-1",
      getState: vi.fn().mockResolvedValue("delayed"),
      remove: vi.fn().mockResolvedValue(undefined),
    });
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/email-scheduling/job-1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Scheduled email cancelled");
  });

  it("returns 404 for non-existent job", async () => {
    mockGetJob.mockResolvedValue(null);
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/email-scheduling/nonexistent",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 409 for job that is not delayed", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-1",
      getState: vi.fn().mockResolvedValue("active"),
      remove: vi.fn(),
    });
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/email-scheduling/job-1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("not delayed");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/email-scheduling/job-1",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
