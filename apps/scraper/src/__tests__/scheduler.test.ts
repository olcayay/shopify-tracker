import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import cron from "node-cron";
import { SCRAPER_SCHEDULES } from "@appranks/shared";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock node-cron: capture all scheduled callbacks
const scheduledJobs: { expression: string; callback: () => Promise<void>; task: ReturnType<typeof createMockTask> }[] = [];

function createMockTask() {
  return {
    stop: vi.fn(),
    start: vi.fn(),
    now: vi.fn(),
  };
}

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn((expression: string, callback: () => Promise<void>) => {
      const task = createMockTask();
      scheduledJobs.push({ expression, callback, task });
      return task;
    }),
    validate: vi.fn((expr: string) => {
      // Basic cron validation: 5 parts, numeric or wildcards
      const parts = expr.split(" ");
      return parts.length === 5;
    }),
  },
}));

// Mock queue module
const mockEnqueueScraperJob = vi.fn().mockResolvedValue("mock-job-id-123");
const mockCloseQueue = vi.fn().mockResolvedValue(undefined);

vi.mock("../queue.js", () => ({
  enqueueScraperJob: (...args: unknown[]) => mockEnqueueScraperJob(...args),
  closeQueue: (...args: unknown[]) => mockCloseQueue(...args),
}));

// Mock circuit breaker
const mockIsCircuitOpen = vi.fn().mockResolvedValue(false);

vi.mock("../circuit-breaker.js", () => ({
  isCircuitOpen: (...args: unknown[]) => mockIsCircuitOpen(...args),
}));

// Mock logger
vi.mock("@appranks/shared", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

// Capture process signal handlers
const signalHandlers: Record<string, (() => void)[]> = {};
const originalProcessOn = process.on.bind(process);
const mockProcessExit = vi.fn();

describe("scheduler", () => {
  beforeEach(() => {
    scheduledJobs.length = 0;
    (cron.schedule as ReturnType<typeof vi.fn>).mockClear();
    mockEnqueueScraperJob.mockClear().mockResolvedValue("mock-job-id-123");
    mockCloseQueue.mockClear().mockResolvedValue(undefined);
    mockIsCircuitOpen.mockClear().mockResolvedValue(false);
    mockProcessExit.mockClear();

    // Capture signal handlers
    vi.spyOn(process, "on").mockImplementation((signal: string, handler: (...args: unknown[]) => void) => {
      if (!signalHandlers[signal]) signalHandlers[signal] = [];
      signalHandlers[signal].push(handler as () => void);
      return process;
    });
    vi.spyOn(process, "exit").mockImplementation(mockProcessExit as unknown as (code?: number) => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(signalHandlers)) {
      delete signalHandlers[key];
    }
  });

  /**
   * Helper: import the scheduler module fresh (it has top-level side effects).
   * Must be called AFTER mocks are set up per test.
   */
  async function loadScheduler() {
    vi.resetModules();
    await import("../scheduler.js");
  }

  // ── 1. Schedule registration ─────────────────────────────────────────────

  describe("schedule registration", () => {
    it("registers a cron job for every entry in SCRAPER_SCHEDULES", async () => {
      await loadScheduler();

      expect(cron.schedule).toHaveBeenCalledTimes(SCRAPER_SCHEDULES.length);
    });

    it("registers jobs with the correct cron expressions from SCRAPER_SCHEDULES", async () => {
      await loadScheduler();

      const registeredExpressions = scheduledJobs.map((j) => j.expression);
      for (const schedule of SCRAPER_SCHEDULES) {
        expect(registeredExpressions).toContain(schedule.cron);
      }
    });

    it("registers each schedule name exactly once (no duplicates)", async () => {
      await loadScheduler();

      // Verify cron.schedule was called with unique expressions matching the schedule list
      const callExpressions = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls.map(
        (call: unknown[]) => call[0] as string,
      );
      // Every schedule's cron should appear (some may share the same cron, so check count matches)
      expect(callExpressions.length).toBe(SCRAPER_SCHEDULES.length);
    });
  });

  // ── 2. Circuit breaker check ─────────────────────────────────────────────

  describe("circuit breaker integration", () => {
    it("checks circuit breaker before enqueuing a platform job", async () => {
      await loadScheduler();

      // Pick the first job that has a platform
      const platformJob = scheduledJobs[0];
      await platformJob.callback();

      expect(mockIsCircuitOpen).toHaveBeenCalled();
    });

    it("skips enqueue when circuit is open for a platform", async () => {
      await loadScheduler();

      mockIsCircuitOpen.mockResolvedValue(true);

      const platformJob = scheduledJobs[0];
      await platformJob.callback();

      expect(mockIsCircuitOpen).toHaveBeenCalled();
      expect(mockEnqueueScraperJob).not.toHaveBeenCalled();
    });

    it("enqueues job when circuit is closed", async () => {
      await loadScheduler();

      mockIsCircuitOpen.mockResolvedValue(false);

      const platformJob = scheduledJobs[0];
      await platformJob.callback();

      expect(mockEnqueueScraperJob).toHaveBeenCalledOnce();
    });

    it("checks circuit for the correct platform", async () => {
      await loadScheduler();

      // Find the index of a specific known schedule (salesforce category)
      const sfIdx = SCRAPER_SCHEDULES.findIndex((s) => s.name === "salesforce_category");
      expect(sfIdx).toBeGreaterThanOrEqual(0);

      await scheduledJobs[sfIdx].callback();

      expect(mockIsCircuitOpen).toHaveBeenCalledWith("salesforce");
    });
  });

  // ── 3. Job enqueue data ──────────────────────────────────────────────────

  describe("job enqueue data", () => {
    it("enqueues with correct type and triggeredBy=scheduler", async () => {
      await loadScheduler();

      // Find the shopify category schedule (index 0)
      const catIdx = SCRAPER_SCHEDULES.findIndex((s) => s.name === "category" && s.platform === "shopify");
      await scheduledJobs[catIdx].callback();

      expect(mockEnqueueScraperJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "category",
          triggeredBy: "scheduler",
          platform: "shopify",
        }),
      );
    });

    it("includes platform field in enqueue data for platform-scoped schedules", async () => {
      await loadScheduler();

      const wixIdx = SCRAPER_SCHEDULES.findIndex((s) => s.name === "wix_category");
      await scheduledJobs[wixIdx].callback();

      expect(mockEnqueueScraperJob).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "wix" }),
      );
    });

    it("enqueues all job types correctly across platforms", async () => {
      await loadScheduler();

      // Trigger a few different job types
      const types = ["category", "app_details", "keyword_search", "reviews", "compute_app_scores"];
      for (const type of types) {
        const idx = SCRAPER_SCHEDULES.findIndex((s) => s.type === type);
        if (idx >= 0) {
          mockEnqueueScraperJob.mockClear();
          await scheduledJobs[idx].callback();
          expect(mockEnqueueScraperJob).toHaveBeenCalledWith(
            expect.objectContaining({ type }),
          );
        }
      }
    });
  });

  // ── 4. Error recovery ────────────────────────────────────────────────────

  describe("error recovery", () => {
    it("does not crash when enqueueScraperJob throws", async () => {
      await loadScheduler();

      mockEnqueueScraperJob.mockRejectedValueOnce(new Error("Redis connection refused"));

      // Should not throw
      await expect(scheduledJobs[0].callback()).resolves.toBeUndefined();
    });

    it("does not crash when enqueueScraperJob rejects with non-Error", async () => {
      await loadScheduler();

      mockEnqueueScraperJob.mockRejectedValueOnce("string error");

      await expect(scheduledJobs[0].callback()).resolves.toBeUndefined();
    });

    it("continues processing subsequent cron ticks after a failure", async () => {
      await loadScheduler();

      // First call fails
      mockEnqueueScraperJob.mockRejectedValueOnce(new Error("temporary failure"));
      await scheduledJobs[0].callback();

      // Second call should succeed
      mockEnqueueScraperJob.mockResolvedValueOnce("recovered-job-id");
      await scheduledJobs[0].callback();

      expect(mockEnqueueScraperJob).toHaveBeenCalledTimes(2);
    });
  });

  // ── 5. Graceful shutdown ─────────────────────────────────────────────────

  describe("graceful shutdown", () => {
    it("registers SIGTERM handler", async () => {
      await loadScheduler();

      expect(signalHandlers["SIGTERM"]).toBeDefined();
      expect(signalHandlers["SIGTERM"].length).toBeGreaterThan(0);
    });

    it("registers SIGINT handler", async () => {
      await loadScheduler();

      expect(signalHandlers["SIGINT"]).toBeDefined();
      expect(signalHandlers["SIGINT"].length).toBeGreaterThan(0);
    });

    it("calls closeQueue on SIGTERM", async () => {
      await loadScheduler();

      const handler = signalHandlers["SIGTERM"][0];
      await handler();

      expect(mockCloseQueue).toHaveBeenCalledOnce();
    });

    it("calls process.exit(0) after closing queue", async () => {
      await loadScheduler();

      const handler = signalHandlers["SIGTERM"][0];
      await handler();

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  // ── 6. Cron expression validation ────────────────────────────────────────

  describe("cron expression validation", () => {
    it("all schedule cron expressions have 5 parts", () => {
      for (const schedule of SCRAPER_SCHEDULES) {
        const parts = schedule.cron.split(" ");
        expect(parts).toHaveLength(5);
      }
    });

    it("all minute values are in valid range (0-59 or */N)", () => {
      for (const schedule of SCRAPER_SCHEDULES) {
        const minutePart = schedule.cron.split(" ")[0];
        if (minutePart.startsWith("*/")) {
          const interval = parseInt(minutePart.slice(2), 10);
          expect(interval).toBeGreaterThan(0);
          expect(interval).toBeLessThanOrEqual(59);
        } else {
          const minute = parseInt(minutePart, 10);
          expect(minute).toBeGreaterThanOrEqual(0);
          expect(minute).toBeLessThanOrEqual(59);
        }
      }
    });

    it("all hour values are in valid range (0-23) or wildcard", () => {
      for (const schedule of SCRAPER_SCHEDULES) {
        const hourPart = schedule.cron.split(" ")[1];
        if (hourPart === "*" || hourPart.startsWith("*/")) continue; // wildcard is valid
        const hours = hourPart.split(",").map((h) => parseInt(h, 10));
        for (const h of hours) {
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThanOrEqual(23);
        }
      }
    });

    it("day-of-week is either * or 0-6", () => {
      for (const schedule of SCRAPER_SCHEDULES) {
        const dow = schedule.cron.split(" ")[4];
        expect(dow).toMatch(/^(\*|[0-6])$/);
      }
    });
  });

  // ── 7. Platform-specific schedules ───────────────────────────────────────

  describe("platform-specific schedules", () => {
    const platforms = [...new Set(SCRAPER_SCHEDULES.map((s) => s.platform))];

    it("every platform has at least a category and app_details schedule", () => {
      for (const platform of platforms) {
        const platformSchedules = SCRAPER_SCHEDULES.filter((s) => s.platform === platform);
        const types = platformSchedules.map((s) => s.type);
        expect(types).toContain("category");
        expect(types).toContain("app_details");
      }
    });

    it("every platform has a compute_app_scores schedule", () => {
      for (const platform of platforms) {
        const platformSchedules = SCRAPER_SCHEDULES.filter((s) => s.platform === platform);
        const types = platformSchedules.map((s) => s.type);
        expect(types).toContain("compute_app_scores");
      }
    });

    it("schedule names are unique across all platforms", () => {
      const names = SCRAPER_SCHEDULES.map((s) => s.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("each platform has between 3 and 8 schedules", () => {
      for (const platform of platforms) {
        const count = SCRAPER_SCHEDULES.filter((s) => s.platform === platform).length;
        expect(count).toBeGreaterThanOrEqual(3);
        expect(count).toBeLessThanOrEqual(8);
      }
    });
  });

  // ── 8. Schedule window validation (no overlapping in same 15-min window) ─

  describe("schedule window validation", () => {
    it("no more than 4 schedules start in any 15-minute window", () => {
      // Group schedules by 15-min window (ignore weekly ones for this check)
      const windows = new Map<string, string[]>();

      for (const schedule of SCRAPER_SCHEDULES) {
        const parts = schedule.cron.split(" ");
        const dow = parts[4];
        if (dow !== "*") continue; // skip weekly schedules for window check

        const minutePart = parts[0];
        const hourPart = parts[1];

        // Skip */N schedules (like daily_digest every 15 min)
        if (minutePart.startsWith("*/")) continue;

        const minute = parseInt(minutePart, 10);
        const hours = hourPart.split(",").map((h) => parseInt(h, 10));

        for (const hour of hours) {
          const windowKey = `${hour}:${Math.floor(minute / 15) * 15}`;
          if (!windows.has(windowKey)) windows.set(windowKey, []);
          windows.get(windowKey)!.push(schedule.name);
        }
      }

      for (const [window, names] of windows) {
        expect(
          names.length,
          `Window ${window} has ${names.length} schedules (max 4): ${names.join(", ")}`,
        ).toBeLessThanOrEqual(4);
      }
    });
  });

  // ── 9. Bulk enqueue (multiple jobs from a single cron tick) ──────────────

  describe("bulk enqueue behavior", () => {
    it("multiple cron callbacks can run concurrently without interference", async () => {
      await loadScheduler();

      // Simulate two cron callbacks firing at roughly the same time
      const promise1 = scheduledJobs[0].callback();
      const promise2 = scheduledJobs[1].callback();

      await Promise.all([promise1, promise2]);

      expect(mockEnqueueScraperJob).toHaveBeenCalledTimes(2);
    });

    it("each callback enqueues independently even when one fails", async () => {
      await loadScheduler();

      mockEnqueueScraperJob
        .mockRejectedValueOnce(new Error("first fails"))
        .mockResolvedValueOnce("second-job-id");

      await scheduledJobs[0].callback();
      await scheduledJobs[1].callback();

      expect(mockEnqueueScraperJob).toHaveBeenCalledTimes(2);
    });
  });

  // ── 10. Circuit breaker per-platform isolation ───────────────────────────

  describe("circuit breaker per-platform isolation", () => {
    it("open circuit on one platform does not block another", async () => {
      await loadScheduler();

      // Make circuit open only for shopify
      mockIsCircuitOpen.mockImplementation(async (platform: string) => platform === "shopify");

      const shopifyIdx = SCRAPER_SCHEDULES.findIndex((s) => s.platform === "shopify");
      const salesforceIdx = SCRAPER_SCHEDULES.findIndex((s) => s.platform === "salesforce");

      await scheduledJobs[shopifyIdx].callback();
      expect(mockEnqueueScraperJob).not.toHaveBeenCalled();

      await scheduledJobs[salesforceIdx].callback();
      expect(mockEnqueueScraperJob).toHaveBeenCalledOnce();
    });
  });

  // ── 11. Data cleanup schedule ────────────────────────────────────────────

  describe("special schedules", () => {
    it("data_cleanup runs weekly (has day-of-week set)", () => {
      const cleanup = SCRAPER_SCHEDULES.find((s) => s.type === "data_cleanup");
      expect(cleanup).toBeDefined();
      const dow = cleanup!.cron.split(" ")[4];
      expect(dow).not.toBe("*");
    });

    it("daily_digest runs every 15 minutes", () => {
      const digest = SCRAPER_SCHEDULES.find((s) => s.type === "daily_digest");
      expect(digest).toBeDefined();
      expect(digest!.cron).toContain("*/15");
    });

    it("weekly_summary runs on Monday", () => {
      const weekly = SCRAPER_SCHEDULES.find((s) => s.type === "weekly_summary");
      expect(weekly).toBeDefined();
      const dow = weekly!.cron.split(" ")[4];
      expect(dow).toBe("1"); // Monday
    });
  });
});
