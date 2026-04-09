import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupStaleRuns } from "../../jobs/cleanup-stale-runs.js";

// Mock the queue module to prevent actual Redis connections
vi.mock("../../queue.js", () => ({
  enqueueScraperJob: vi.fn().mockResolvedValue("retry-job-1"),
}));

function createMockDb(
  runningCount: number,
  pendingCount: number,
  staleRuns: any[] = [],
  recentRetryCounts: any[] = [],
) {
  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 0 }),
  };

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue(recentRetryCounts),
  };

  // Track select calls: first = stale running runs, second = recent retry counts
  let selectCallIndex = 0;
  mockSelectChain.from.mockImplementation(() => {
    const callIdx = selectCallIndex++;
    return {
      where: vi.fn().mockImplementation(() => {
        if (callIdx === 0) return Promise.resolve(staleRuns);
        // Second select is the retry count query — returns a chain with groupBy
        return { groupBy: vi.fn().mockResolvedValue(recentRetryCounts) };
      }),
    };
  });

  // Update: first call = smoke-test stale, second = running cleanup, third = pending cleanup
  let updateCallIndex = 0;
  mockUpdateChain.where.mockImplementation(() => {
    let count = 0;
    if (updateCallIndex === 1) count = runningCount;
    else if (updateCallIndex === 2) count = pendingCount;
    updateCallIndex++;
    return Promise.resolve({ rowCount: count });
  });

  return {
    update: vi.fn().mockReturnValue(mockUpdateChain),
    select: vi.fn().mockReturnValue(mockSelectChain),
    _updateChain: mockUpdateChain,
    _selectChain: mockSelectChain,
  } as any;
}

describe("cleanupStaleRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns counts of cleaned up runs", async () => {
    const db = createMockDb(3, 1);
    const result = await cleanupStaleRuns(db);

    expect(result).toEqual({ running: 3, pending: 1, retried: 0 });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("returns zero counts when nothing to clean", async () => {
    const db = createMockDb(0, 0);
    const result = await cleanupStaleRuns(db);

    expect(result).toEqual({ running: 0, pending: 0, retried: 0 });
  });

  it("sets status to failed with error message", async () => {
    const db = createMockDb(1, 0);
    await cleanupStaleRuns(db);

    // All 3 update calls should set status to "failed" with a Date
    for (const call of db._updateChain.set.mock.calls) {
      expect(call[0].status).toBe("failed");
      expect(call[0].completedAt).toBeInstanceOf(Date);
    }
  });

  it("auto-retries retryable stale runs when under retry limit", async () => {
    const staleRuns = [
      { id: "run-1", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-2", scraperType: "category", platform: "shopify", metadata: {} },
    ];
    const db = createMockDb(2, 0, staleRuns, []);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(2);
    expect(enqueueScraperJob).toHaveBeenCalledTimes(2);
    expect(enqueueScraperJob).toHaveBeenCalledWith(expect.objectContaining({
      type: "reviews",
      platform: "zendesk",
      triggeredBy: "stale-run-retry",
      retryOf: "run-1",
    }));
  });

  it("does not retry non-retryable scraper types", async () => {
    const staleRuns = [
      { id: "run-1", scraperType: "compute_app_scores", platform: "shopify", metadata: {} },
    ];
    const db = createMockDb(1, 0, staleRuns, []);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(0);
    expect(enqueueScraperJob).not.toHaveBeenCalled();
  });

  it("does not retry when max retries reached for platform+type", async () => {
    const staleRuns = [
      { id: "run-1", scraperType: "reviews", platform: "zendesk", metadata: {} },
    ];
    // Simulate 3 recent retries already exist for zendesk:reviews
    const recentRetryCounts = [
      { platform: "zendesk", scraperType: "reviews", count: 3 },
    ];
    const db = createMockDb(1, 0, staleRuns, recentRetryCounts);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(0);
    expect(enqueueScraperJob).not.toHaveBeenCalled();
  });

  it("retries platform+type combos that have not yet hit max retries", async () => {
    const staleRuns = [
      { id: "run-1", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-2", scraperType: "category", platform: "shopify", metadata: {} },
    ];
    // zendesk:reviews has 3 retries (at limit), shopify:category has 1 (under limit)
    const recentRetryCounts = [
      { platform: "zendesk", scraperType: "reviews", count: 3 },
      { platform: "shopify", scraperType: "category", count: 1 },
    ];
    const db = createMockDb(2, 0, staleRuns, recentRetryCounts);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(1);
    expect(enqueueScraperJob).toHaveBeenCalledTimes(1);
    expect(enqueueScraperJob).toHaveBeenCalledWith(expect.objectContaining({
      type: "category",
      platform: "shopify",
      triggeredBy: "stale-run-retry",
      retryOf: "run-2",
    }));
  });

  it("tracks retry count within a single cleanup cycle", async () => {
    // 4 stale runs for same platform+type, 0 recent retries — should only retry 3 (MAX_RETRIES)
    const staleRuns = [
      { id: "run-1", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-2", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-3", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-4", scraperType: "reviews", platform: "zendesk", metadata: {} },
    ];
    const db = createMockDb(4, 0, staleRuns, []);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(3);
    expect(enqueueScraperJob).toHaveBeenCalledTimes(3);
  });
});
