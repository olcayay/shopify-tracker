import { describe, it, expect } from "vitest";
import { formatDateTime, formatDateOnly } from "@/lib/format-date";

describe("formatDateTime", () => {
  it("formats ISO date string with timezone", () => {
    const result = formatDateTime("2026-02-17T14:30:00Z", "Europe/Istanbul");
    expect(result).toMatch(/17/);
    expect(result).toMatch(/02/);
    expect(result).toMatch(/2026/);
  });

  it("formats date without Z suffix as UTC", () => {
    const result = formatDateTime("2026-02-17 14:30:00", "UTC");
    expect(result).toContain("14:30");
  });

  it("uses default timezone when not provided", () => {
    const result = formatDateTime("2026-02-17T12:00:00Z");
    expect(result).toBeTruthy();
    expect(result).toContain("2026");
  });

  it("handles date with offset", () => {
    const result = formatDateTime("2026-02-17T14:30:00+03:00", "Europe/Istanbul");
    expect(result).toContain("2026");
  });

  it("handles midnight UTC", () => {
    const result = formatDateTime("2026-01-01T00:00:00Z", "UTC");
    expect(result).toContain("00:00");
  });

  it("handles end of day", () => {
    const result = formatDateTime("2026-12-31T23:59:00Z", "UTC");
    expect(result).toContain("23:59");
  });

  it("converts space-separated datetime to T format", () => {
    const result = formatDateTime("2026-06-15 09:30:00", "UTC");
    expect(result).toContain("09:30");
  });
});

describe("formatDateOnly", () => {
  it("formats to date-only string", () => {
    const result = formatDateOnly("2026-02-17T14:30:00Z", "UTC");
    expect(result).toContain("17");
    expect(result).toContain("02");
    expect(result).toContain("2026");
  });

  it("does not include time", () => {
    const result = formatDateOnly("2026-02-17T14:30:00Z", "UTC");
    expect(result).not.toContain("14:30");
  });

  it("uses default timezone when not provided", () => {
    const result = formatDateOnly("2026-02-17T12:00:00Z");
    expect(result).toBeTruthy();
  });

  it("handles date without Z suffix", () => {
    const result = formatDateOnly("2026-03-25 10:00:00", "UTC");
    expect(result).toContain("25");
    expect(result).toContain("03");
    expect(result).toContain("2026");
  });

  it("formats different months correctly", () => {
    const jan = formatDateOnly("2026-01-15T00:00:00Z", "UTC");
    const dec = formatDateOnly("2026-12-25T00:00:00Z", "UTC");
    expect(jan).toContain("01");
    expect(dec).toContain("12");
  });

  it("handles leap year dates", () => {
    // 2028 is a leap year
    const result = formatDateOnly("2028-02-29T12:00:00Z", "UTC");
    expect(result).toContain("29");
  });
});
