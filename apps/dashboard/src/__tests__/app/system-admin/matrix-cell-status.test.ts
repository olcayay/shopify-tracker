import { describe, it, expect } from "vitest";
import { getCellStatus, type HealthCell } from "@/app/(dashboard)/system-admin/scraper/components/matrix-cell";

function makeCell(overrides: Partial<HealthCell> = {}): HealthCell {
  return {
    platform: "shopify",
    scraperType: "keyword_search",
    lastRun: {
      status: "completed",
      completedAt: new Date().toISOString(),
      durationMs: 5000,
      itemsScraped: 50,
      itemsFailed: 0,
      error: null,
      fallbackUsed: false,
    },
    avgDurationMs: 4500,
    prevDurationMs: 4000,
    currentlyRunning: false,
    runningStartedAt: null,
    schedule: { cron: "0 0,12 * * *", nextRunAt: new Date(Date.now() + 3600000).toISOString() },
    ...overrides,
  };
}

describe("getCellStatus", () => {
  it("returns green for healthy completed run", () => {
    expect(getCellStatus(makeCell())).toBe("green");
  });

  it("returns amber when completed with failed items", () => {
    expect(
      getCellStatus(
        makeCell({
          lastRun: {
            status: "completed",
            completedAt: new Date().toISOString(),
            durationMs: 5000,
            itemsScraped: 50,
            itemsFailed: 3,
            error: null,
            fallbackUsed: false,
          },
        })
      )
    ).toBe("amber");
  });

  it("returns green when completed with zero failed items", () => {
    expect(
      getCellStatus(
        makeCell({
          lastRun: {
            status: "completed",
            completedAt: new Date().toISOString(),
            durationMs: 5000,
            itemsScraped: 50,
            itemsFailed: 0,
            error: null,
            fallbackUsed: false,
          },
        })
      )
    ).toBe("green");
  });

  it("returns red for failed run (takes priority over amber)", () => {
    expect(
      getCellStatus(
        makeCell({
          lastRun: {
            status: "failed",
            completedAt: new Date().toISOString(),
            durationMs: 5000,
            itemsScraped: 10,
            itemsFailed: 5,
            error: "Fatal error",
            fallbackUsed: false,
          },
        })
      )
    ).toBe("red");
  });

  it("returns gray when no schedule", () => {
    expect(getCellStatus(makeCell({ schedule: null }))).toBe("gray");
  });

  it("returns blue when running", () => {
    expect(getCellStatus(makeCell({ currentlyRunning: true }))).toBe("blue");
  });

  it("returns yellow when stale (even with failed items)", () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
    expect(
      getCellStatus(
        makeCell({
          lastRun: {
            status: "completed",
            completedAt: staleDate,
            durationMs: 5000,
            itemsScraped: 50,
            itemsFailed: 3,
            error: null,
            fallbackUsed: false,
          },
        })
      )
    ).toBe("yellow");
  });

  it("returns yellow when never completed", () => {
    expect(getCellStatus(makeCell({ lastRun: null }))).toBe("yellow");
  });
});
