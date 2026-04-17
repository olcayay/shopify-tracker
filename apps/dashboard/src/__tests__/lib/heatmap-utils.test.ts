import { describe, it, expect } from "vitest";
import { buildDateRange, formatShortDate, formatDateRangeLabel, intensityClass } from "@/lib/heatmap-utils";

describe("buildDateRange", () => {
  it("generates 30 dates by default", () => {
    const dates = buildDateRange();
    expect(dates).toHaveLength(30);
  });

  it("last date is today when offset is 0", () => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = buildDateRange(30, 0);
    expect(dates[dates.length - 1]).toBe(today);
  });

  it("shifts dates back by offset", () => {
    const dates0 = buildDateRange(30, 0);
    const dates30 = buildDateRange(30, 30);
    // Windows are adjacent: dates30 ends 1 day before dates0 starts
    const lastOf30 = new Date(dates30[dates30.length - 1] + "T00:00:00");
    const firstOf0 = new Date(dates0[0] + "T00:00:00");
    const diffMs = firstOf0.getTime() - lastOf30.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000); // exactly 1 day apart
    expect(dates30).toHaveLength(30);
  });

  it("generates correct number of dates", () => {
    expect(buildDateRange(7)).toHaveLength(7);
    expect(buildDateRange(1)).toHaveLength(1);
    expect(buildDateRange(60)).toHaveLength(60);
  });

  it("dates are in chronological order", () => {
    const dates = buildDateRange(5, 0);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });
});

describe("formatShortDate", () => {
  it("formats date as 'D Mon'", () => {
    expect(formatShortDate("2026-03-15")).toBe("15 Mar");
    expect(formatShortDate("2026-01-01")).toBe("1 Jan");
    expect(formatShortDate("2026-12-31")).toBe("31 Dec");
  });
});

describe("formatDateRangeLabel", () => {
  it("returns range label from first to last date", () => {
    const dates = ["2026-03-01", "2026-03-15", "2026-03-30"];
    const label = formatDateRangeLabel(dates);
    expect(label).toBe("1 Mar — 30 Mar 2026");
  });

  it("returns empty string for empty array", () => {
    expect(formatDateRangeLabel([])).toBe("");
  });
});

describe("intensityClass", () => {
  it("returns muted for 0", () => {
    expect(intensityClass(0)).toBe("bg-muted/40");
  });

  it("returns flat primary for any count > 0", () => {
    expect(intensityClass(1)).toBe("bg-primary/60");
    expect(intensityClass(2)).toBe("bg-primary/60");
    expect(intensityClass(5)).toBe("bg-primary/60");
    expect(intensityClass(100)).toBe("bg-primary/60");
  });
});
