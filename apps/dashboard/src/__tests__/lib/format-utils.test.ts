import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDuration, timeAgo } from "@/lib/format-utils";

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
