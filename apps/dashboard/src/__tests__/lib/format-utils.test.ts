import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDuration, timeAgo, formatNumber, formatCurrency, formatPercent, formatShortDate, formatFullDate, formatMonthYear } from "@/lib/format-utils";

describe("formatNumber", () => {
  it("formats integers with grouping separators", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats small numbers without separators", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats with compact notation", () => {
    expect(formatNumber(1234, { compact: true })).toBe("1.2K");
    expect(formatNumber(1234567, { compact: true })).toBe("1.2M");
    expect(formatNumber(1500000000, { compact: true })).toBe("1.5B");
  });

  it("formats with custom decimals", () => {
    expect(formatNumber(3.14159, { decimals: 2 })).toBe("3.14");
    expect(formatNumber(3.14159, { decimals: 0 })).toBe("3");
  });

  it("formats compact with custom decimals", () => {
    expect(formatNumber(1234, { compact: true, decimals: 0 })).toBe("1K");
    expect(formatNumber(1234, { compact: true, decimals: 2 })).toBe("1.23K");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-1234)).toBe("-1,234");
    expect(formatNumber(-1234, { compact: true })).toBe("-1.2K");
  });

  it("formats with maximumFractionDigits for decimals", () => {
    expect(formatNumber(1234.5, { decimals: 1 })).toBe("1,234.5");
  });
});

describe("formatCurrency", () => {
  it("formats integer amounts without decimal places", () => {
    expect(formatCurrency(4200)).toBe("$4,200");
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats decimal amounts with 2 decimal places", () => {
    expect(formatCurrency(42.5)).toBe("$42.50");
    expect(formatCurrency(9.99)).toBe("$9.99");
  });

  it("formats large numbers", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("supports different currencies", () => {
    expect(formatCurrency(100, "EUR")).toBe("€100");
    expect(formatCurrency(100, "GBP")).toBe("£100");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-42.5)).toBe("-$42.50");
  });
});

describe("formatPercent", () => {
  it("formats decimal ratios as percentages", () => {
    expect(formatPercent(0.125)).toBe("12.5%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("formats already-percentage values", () => {
    expect(formatPercent(12.5, { alreadyPercent: true })).toBe("12.5%");
    expect(formatPercent(100, { alreadyPercent: true })).toBe("100%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercent(0.12345, { decimals: 2 })).toBe("12.35%");
    expect(formatPercent(0.12345, { decimals: 0 })).toBe("12%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-0.05)).toBe("-5%");
  });
});

describe("formatShortDate", () => {
  it("formats as short month + day", () => {
    expect(formatShortDate("2026-01-05")).toBe("Jan 5");
    expect(formatShortDate("2026-12-25")).toBe("Dec 25");
  });
});

describe("formatFullDate", () => {
  it("formats as short month + day + year", () => {
    expect(formatFullDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(formatFullDate("2026-12-25")).toBe("Dec 25, 2026");
  });
});

describe("formatMonthYear", () => {
  it("formats as short month + year", () => {
    expect(formatMonthYear("2026-01-05")).toBe("Jan 2026");
    expect(formatMonthYear("2026-12-25")).toBe("Dec 2026");
  });
});

describe("formatDuration", () => {
  it('returns "500ms" for 500', () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it('returns "0ms" for 0', () => {
    expect(formatDuration(0)).toBe("0ms");
  });

  it('returns "1s" for 1000', () => {
    expect(formatDuration(1000)).toBe("1s");
  });

  it('returns "5s" for 5000', () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it('returns "1m" for 60000', () => {
    expect(formatDuration(60000)).toBe("1m");
  });

  it('returns "1m 30s" for 90000', () => {
    expect(formatDuration(90000)).toBe("1m 30s");
  });

  it('returns "5m" for 300000', () => {
    expect(formatDuration(300000)).toBe("5m");
  });

  it('returns "1h" for 3600000', () => {
    expect(formatDuration(3600000)).toBe("1h");
  });

  it('returns "1h 30m" for 5400000', () => {
    expect(formatDuration(5400000)).toBe("1h 30m");
  });

  it('returns "2h" for 7200000', () => {
    expect(formatDuration(7200000)).toBe("2h");
  });
});

describe("timeAgo", () => {
  const NOW = new Date("2026-03-28T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for a date less than a minute ago', () => {
    const date = new Date(NOW - 30_000).toISOString();
    expect(timeAgo(date)).toBe("just now");
  });

  it('returns "5m ago" for 5 minutes ago', () => {
    const date = new Date(NOW - 5 * 60_000).toISOString();
    expect(timeAgo(date)).toBe("5m ago");
  });

  it('returns "2h ago" for 2 hours ago', () => {
    const date = new Date(NOW - 2 * 3600_000).toISOString();
    expect(timeAgo(date)).toBe("2h ago");
  });

  it('returns "1d ago" for 24 hours ago', () => {
    const date = new Date(NOW - 24 * 3600_000).toISOString();
    expect(timeAgo(date)).toBe("1d ago");
  });

  it('returns "3d ago" for 3 days ago', () => {
    const date = new Date(NOW - 3 * 24 * 3600_000).toISOString();
    expect(timeAgo(date)).toBe("3d ago");
  });
});
