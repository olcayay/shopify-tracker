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
    triggeredBy: "triggered_by",
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

    // Should call update 3 times (smoke-test stale, running stale, pending stale)
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ running: 0, pending: 0 });
  });

  it("returns counts from DB rowCount", async () => {
    // Reset
    mockUpdate.mockClear();
    mockSet.mockClear();
    mockWhere.mockClear();

    // First call (smoke-test stale), second (running) returns 5 rows, third (pending) returns 3
    mockWhere
      .mockResolvedValueOnce({ rowCount: 0 })
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

    // All calls should set status to "failed"
    for (const call of mockSet.mock.calls) {
      expect(call[0].status).toBe("failed");
      expect(call[0].completedAt).toBeInstanceOf(Date);
    }
  });
});
