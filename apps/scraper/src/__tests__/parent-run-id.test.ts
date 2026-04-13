import { describe, it, expect, vi } from "vitest";
import { resolveParentRunId } from "../utils/parent-run-id.js";

function buildDb(rows: Array<{ id: string }>): any {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

describe("resolveParentRunId (PLA-1066)", () => {
  it("returns null when jobId is missing", async () => {
    const db = buildDb([]);
    expect(await resolveParentRunId(db, "background", null)).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns null when queue is missing", async () => {
    const db = buildDb([]);
    expect(await resolveParentRunId(db, undefined, "32")).toBeNull();
  });

  it("returns null when no running row matches", async () => {
    const db = buildDb([]);
    expect(await resolveParentRunId(db, "background", "32")).toBeNull();
  });

  it("returns the matched id when a running row exists", async () => {
    const db = buildDb([{ id: "uuid-parent" }]);
    expect(await resolveParentRunId(db, "background", "32")).toBe("uuid-parent");
  });

  it("never throws — DB errors collapse to null", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => { throw new Error("db down"); },
            }),
          }),
        }),
      }),
    };
    expect(await resolveParentRunId(db as any, "background", "32")).toBeNull();
  });
});
