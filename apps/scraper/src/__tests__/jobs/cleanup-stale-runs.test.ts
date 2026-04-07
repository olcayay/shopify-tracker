import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupStaleRuns } from "../../jobs/cleanup-stale-runs.js";

// Mock the queue module to prevent actual Redis connections
vi.mock("../../queue.js", () => ({
  enqueueScraperJob: vi.fn().mockResolvedValue("retry-job-1"),
}));

function createMockDb(runningCount: number, pendingCount: number, staleRuns: any[] = []) {
  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 0 }),
  };

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(staleRuns),
  };

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

  it("auto-retries retryable stale runs", async () => {
    const staleRuns = [
      { id: "run-1", scraperType: "reviews", platform: "zendesk", metadata: {} },
      { id: "run-2", scraperType: "category", platform: "shopify", metadata: {} },
    ];
    const db = createMockDb(2, 0, staleRuns);
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
    const db = createMockDb(1, 0, staleRuns);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(0);
    expect(enqueueScraperJob).not.toHaveBeenCalled();
  });

  it("does not retry runs that are already retries (prevents infinite loops)", async () => {
    const staleRuns = [
      { id: "run-retry", scraperType: "reviews", platform: "zendesk", metadata: { retryOf: "original-run-id" } },
    ];
    const db = createMockDb(1, 0, staleRuns);
    const { enqueueScraperJob } = await import("../../queue.js");

    const result = await cleanupStaleRuns(db);

    expect(result.retried).toBe(0);
    expect(enqueueScraperJob).not.toHaveBeenCalled();
  });
});
