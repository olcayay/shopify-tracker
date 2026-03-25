import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for cleanupStaleRuns logic.
 * We test the SQL conditions by mocking the DB layer.
 */

// Mock the shared logger
vi.mock("@appranks/shared", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// Mock the DB module
vi.mock("@appranks/db", () => ({
  scrapeRuns: {
    status: "status",
    startedAt: "started_at",
    createdAt: "created_at",
  },
}));

// Mock drizzle-orm
const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
const mockDb = { update: mockUpdate };

describe("cleanupStaleRuns", () => {
  it("calls update for both running and pending stale runs", async () => {
    // Reset mocks
    mockWhere.mockResolvedValue({ rowCount: 0 });

    const { cleanupStaleRuns } = await import("../cleanup-stale-runs.js");
    const result = await cleanupStaleRuns(mockDb as any);

    // Should call update twice (once for running, once for pending)
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ running: 0, pending: 0 });
  });

  it("returns counts from DB rowCount", async () => {
    // Reset
    mockUpdate.mockClear();
    mockSet.mockClear();
    mockWhere.mockClear();

    // First call (running) returns 5 rows, second call (pending) returns 3
    mockWhere
      .mockResolvedValueOnce({ rowCount: 5 })
      .mockResolvedValueOnce({ rowCount: 3 });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const { cleanupStaleRuns } = await import("../cleanup-stale-runs.js");
    const result = await cleanupStaleRuns(mockDb as any);

    expect(result).toEqual({ running: 5, pending: 3 });
  });

  it("sets status to failed with error message", async () => {
    mockUpdate.mockClear();
    mockSet.mockClear();
    mockWhere.mockClear();
    mockWhere.mockResolvedValue({ rowCount: 0 });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const { cleanupStaleRuns } = await import("../cleanup-stale-runs.js");
    await cleanupStaleRuns(mockDb as any);

    // Both calls should set status to "failed"
    const firstSetCall = mockSet.mock.calls[0][0];
    expect(firstSetCall.status).toBe("failed");
    expect(firstSetCall.error).toContain("stale run");
    expect(firstSetCall.completedAt).toBeInstanceOf(Date);

    const secondSetCall = mockSet.mock.calls[1][0];
    expect(secondSetCall.status).toBe("failed");
    expect(secondSetCall.error).toContain("stale run");
  });
});
