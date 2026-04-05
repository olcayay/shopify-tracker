import { describe, it, expect } from "vitest";
import {
  SCRAPER_SCHEDULES,
  getNextRunFromCron,
  getScheduleIntervalMs,
  findSchedule,
} from "../constants/scraper-schedules.js";
import { PLATFORM_IDS } from "../constants/platforms.js";

describe("SCRAPER_SCHEDULES", () => {
  it("has entries for all 12 platforms", () => {
    const platforms = [...new Set(SCRAPER_SCHEDULES.map((s) => s.platform))];
    for (const pid of PLATFORM_IDS) {
      expect(platforms).toContain(pid);
    }
  });

  it("every schedule has valid fields", () => {
    for (const s of SCRAPER_SCHEDULES) {
      expect(s.name).toBeTruthy();
      expect(s.cron).toBeTruthy();
      expect(s.type).toBeTruthy();
      expect(s.platform).toBeTruthy();
      expect(PLATFORM_IDS).toContain(s.platform);
    }
  });

  it("all cron expressions match expected format", () => {
    for (const s of SCRAPER_SCHEDULES) {
      // Format: M H * * * (daily) or M H * * D (weekly)
      const parts = s.cron.split(" ");
      expect(parts).toHaveLength(5);
      expect(parts[2]).toBe("*");
      expect(parts[3]).toBe("*");
      // day-of-week: either * (daily) or 0-6 (weekly)
      expect(parts[4]).toMatch(/^(\*|[0-6])$/);
    }
  });

  it("unique names across all schedules", () => {
    const names = SCRAPER_SCHEDULES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("getNextRunFromCron", () => {
  it("returns a Date in the future", () => {
    const next = getNextRunFromCron("0 3 * * *");
    // The next run should be within 24 hours from now
    const diff = next.getTime() - Date.now();
    expect(diff).toBeGreaterThan(-60_000); // allow 1 min tolerance
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("handles multi-hour cron (e.g. 0 1,13 * * *)", () => {
    const next = getNextRunFromCron("0 1,13 * * *");
    const diff = next.getTime() - Date.now();
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("returns a valid Date object", () => {
    const next = getNextRunFromCron("30 8 * * *");
    expect(next).toBeInstanceOf(Date);
    expect(isNaN(next.getTime())).toBe(false);
  });
});

describe("getScheduleIntervalMs", () => {
  it("returns 24h for daily cron", () => {
    expect(getScheduleIntervalMs("0 3 * * *")).toBe(24 * 60 * 60 * 1000);
  });

  it("returns 12h for twice-daily cron", () => {
    expect(getScheduleIntervalMs("0 1,13 * * *")).toBe(12 * 60 * 60 * 1000);
  });

  it("returns correct interval for 8h cron", () => {
    expect(getScheduleIntervalMs("0 0,8,16 * * *")).toBe(8 * 60 * 60 * 1000);
  });
});

describe("findSchedule", () => {
  it("finds shopify category schedule", () => {
    const s = findSchedule("shopify", "category");
    expect(s).toBeDefined();
    expect(s!.platform).toBe("shopify");
    expect(s!.type).toBe("category");
    expect(s!.cron).toBe("0 3 * * *");
  });

  it("returns undefined for non-existent combo", () => {
    const s = findSchedule("canva", "reviews");
    expect(s).toBeUndefined();
  });

  it("finds hubspot app_details schedule", () => {
    const s = findSchedule("hubspot", "app_details");
    expect(s).toBeDefined();
    expect(s!.cron).toBe("0 13,1 * * *");
  });
});
