import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupStaleRuns } from "../../jobs/cleanup-stale-runs.js";

function createMockDb(runningCount: number, pendingCount: number) {
  const mockChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 0 }),
  };

  // First call = smoke-test stale, second = running cleanup, third = pending cleanup
  let callIndex = 0;
  mockChain.where.mockImplementation(() => {
    let count = 0;
    if (callIndex === 1) count = runningCount;
    else if (callIndex === 2) count = pendingCount;
    callIndex++;
    return Promise.resolve({ rowCount: count });
  });

  return {
    update: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  } as any;
}

describe("cleanupStaleRuns", () => {
  it("returns counts of cleaned up runs", async () => {
    const db = createMockDb(3, 1);
    const result = await cleanupStaleRuns(db);

    expect(result).toEqual({ running: 3, pending: 1 });
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it("returns zero counts when nothing to clean", async () => {
    const db = createMockDb(0, 0);
    const result = await cleanupStaleRuns(db);

    expect(result).toEqual({ running: 0, pending: 0 });
  });

  it("sets status to failed with error message", async () => {
    const db = createMockDb(1, 0);
    await cleanupStaleRuns(db);

    // All 3 calls should set status to "failed" with a Date
    for (const call of db._chain.set.mock.calls) {
      expect(call[0].status).toBe("failed");
      expect(call[0].completedAt).toBeInstanceOf(Date);
    }
  });
});
