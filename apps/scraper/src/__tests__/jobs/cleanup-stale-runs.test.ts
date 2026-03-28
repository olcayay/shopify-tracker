import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupStaleRuns } from "../../jobs/cleanup-stale-runs.js";

function createMockDb(runningCount: number, pendingCount: number) {
  const mockChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 0 }),
  };

  // First call = running cleanup, second call = pending cleanup
  let callIndex = 0;
  mockChain.where.mockImplementation(() => {
    const count = callIndex === 0 ? runningCount : pendingCount;
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
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("returns zero counts when nothing to clean", async () => {
    const db = createMockDb(0, 0);
    const result = await cleanupStaleRuns(db);

    expect(result).toEqual({ running: 0, pending: 0 });
  });

  it("sets status to failed with error message", async () => {
    const db = createMockDb(1, 0);
    await cleanupStaleRuns(db);

    const setCall = db._chain.set.mock.calls[0][0];
    expect(setCall.status).toBe("failed");
    expect(setCall.error).toContain("stale run");
    expect(setCall.completedAt).toBeInstanceOf(Date);
  });
});
