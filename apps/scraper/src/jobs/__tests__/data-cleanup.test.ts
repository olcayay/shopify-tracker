import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataCleanup } from "../data-cleanup.js";

function createMockDb(rowCount: number = 0) {
  return {
    execute: vi.fn(async () => ({ rowCount })),
  } as any;
}

describe("dataCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs cleanup on all configured tables", async () => {
    const db = createMockDb(50);
    const results = await dataCleanup(db, "test-job");

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ table: "app_snapshots", deletedRows: 50 });
    expect(results[1]).toEqual({ table: "keyword_snapshots", deletedRows: 50 });
    expect(results[2]).toEqual({ table: "scrape_runs", deletedRows: 50 });
    expect(results[3]).toEqual({ table: "dead_letter_jobs", deletedRows: 50 });
  });

  it("calls db.execute for each table (DELETE + VACUUM)", async () => {
    const db = createMockDb(10);
    await dataCleanup(db);

    // 4 DELETE + 4 VACUUM = 8 execute calls
    expect(db.execute).toHaveBeenCalledTimes(8);
  });

  it("returns zero deleted rows when nothing to delete", async () => {
    const db = createMockDb(0);
    const results = await dataCleanup(db);

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.deletedRows).toBe(0);
    }

    // Only 4 DELETE calls, no VACUUM when nothing deleted
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it("continues cleanup even if one table fails", async () => {
    let callCount = 0;
    const db = {
      execute: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error("table locked");
        return { rowCount: 0 };
      }),
    } as any;

    const results = await dataCleanup(db);

    // First table failed so no result for it, remaining 3 succeed
    expect(results.length).toBe(3);
  });

  it("handles VACUUM failure gracefully", async () => {
    let callCount = 0;
    const db = {
      execute: vi.fn(async () => {
        callCount++;
        // DELETE calls succeed (odd calls), VACUUM calls fail (even calls)
        if (callCount % 2 === 0) throw new Error("VACUUM cannot run inside transaction");
        return { rowCount: 5 };
      }),
    } as any;

    const results = await dataCleanup(db);

    // All 4 tables should have results despite VACUUM failures
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.deletedRows).toBe(5);
    }
  });
});
