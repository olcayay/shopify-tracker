import { describe, it, expect } from "vitest";
import {
  getLocalTime,
  isInDeliveryWindow,
  alreadySentToday,
  getLocalDayBoundaries,
  DEFAULT_TIMEZONE,
  DEFAULT_TARGET_HOUR,
} from "../timezone.js";

describe("timezone", () => {
  describe("getLocalTime", () => {
    it("converts UTC date to local time for a known timezone", () => {
      // 2026-04-03T12:00:00Z is 15:00 in Europe/Istanbul (UTC+3)
      const utcDate = new Date("2026-04-03T12:00:00Z");
      const result = getLocalTime(utcDate, "Europe/Istanbul");
      expect(result.hour).toBe(15);
      expect(result.minute).toBe(0);
      expect(result.dateStr).toBe("2026-04-03");
    });

    it("handles negative UTC offsets correctly", () => {
      // 2026-04-03T05:30:00Z is 01:30 EDT in America/New_York (UTC-4 in April, DST)
      const utcDate = new Date("2026-04-03T05:30:00Z");
      const result = getLocalTime(utcDate, "America/New_York");
      expect(result.hour).toBe(1);
      expect(result.minute).toBe(30);
    });

    it("handles date boundary crossing (UTC date rolls to next day locally)", () => {
      // 2026-04-03T23:00:00Z is 2026-04-04T02:00 in Europe/Istanbul
      const utcDate = new Date("2026-04-03T23:00:00Z");
      const result = getLocalTime(utcDate, "Europe/Istanbul");
      expect(result.hour).toBe(2);
      expect(result.dateStr).toBe("2026-04-04");
    });

    it("falls back to default timezone for invalid timezone string", () => {
      const utcDate = new Date("2026-04-03T12:00:00Z");
      const result = getLocalTime(utcDate, "Invalid/Timezone");
      // Should fall back to Europe/Istanbul (UTC+3)
      const expected = getLocalTime(utcDate, DEFAULT_TIMEZONE);
      expect(result.hour).toBe(expected.hour);
      expect(result.minute).toBe(expected.minute);
    });

    it("returns correct dateStr format (YYYY-MM-DD)", () => {
      const utcDate = new Date("2026-01-15T10:00:00Z");
      const result = getLocalTime(utcDate, "UTC");
      expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateStr).toBe("2026-01-15");
    });
  });

  describe("isInDeliveryWindow", () => {
    it("returns true when local time is at target hour within 15 min", () => {
      // 2026-04-03T05:10:00Z is 08:10 in Europe/Istanbul (UTC+3)
      const utcDate = new Date("2026-04-03T05:10:00Z");
      const result = isInDeliveryWindow(utcDate, "Europe/Istanbul", 8);
      expect(result).toBe(true);
    });

    it("returns false when local minute is 15 or later", () => {
      // 2026-04-03T05:15:00Z is 08:15 in Europe/Istanbul
      const utcDate = new Date("2026-04-03T05:15:00Z");
      const result = isInDeliveryWindow(utcDate, "Europe/Istanbul", 8);
      expect(result).toBe(false);
    });

    it("returns false when local hour does not match target", () => {
      // 2026-04-03T06:05:00Z is 09:05 in Europe/Istanbul
      const utcDate = new Date("2026-04-03T06:05:00Z");
      const result = isInDeliveryWindow(utcDate, "Europe/Istanbul", 8);
      expect(result).toBe(false);
    });

    it("uses default target hour (8) when not specified", () => {
      expect(DEFAULT_TARGET_HOUR).toBe(8);
      // 2026-04-03T05:05:00Z is 08:05 in Europe/Istanbul
      const utcDate = new Date("2026-04-03T05:05:00Z");
      const result = isInDeliveryWindow(utcDate, "Europe/Istanbul");
      expect(result).toBe(true);
    });
  });

  describe("alreadySentToday", () => {
    it("returns false when lastSentAt is null", () => {
      const result = alreadySentToday(null, new Date(), "UTC");
      expect(result).toBe(false);
    });

    it("returns true when last sent on the same local day", () => {
      const now = new Date("2026-04-03T15:00:00Z");
      const lastSent = new Date("2026-04-03T08:00:00Z");
      const result = alreadySentToday(lastSent, now, "Europe/Istanbul");
      expect(result).toBe(true);
    });

    it("returns false when last sent on a different local day", () => {
      const now = new Date("2026-04-03T15:00:00Z");
      const lastSent = new Date("2026-04-02T08:00:00Z");
      const result = alreadySentToday(lastSent, now, "Europe/Istanbul");
      expect(result).toBe(false);
    });

    it("handles timezone-aware day boundary correctly", () => {
      // 2026-04-03T22:00:00Z is Apr 4 01:00 in Istanbul
      // 2026-04-04T03:00:00Z is Apr 4 06:00 in Istanbul — same local day
      const lastSent = new Date("2026-04-03T22:00:00Z");
      const now = new Date("2026-04-04T03:00:00Z");
      const result = alreadySentToday(lastSent, now, "Europe/Istanbul");
      expect(result).toBe(true);
    });
  });

  describe("getLocalDayBoundaries", () => {
    it("returns todayStart before yesterdayStart", () => {
      const now = new Date("2026-04-03T12:00:00Z");
      const { todayStart, yesterdayStart } = getLocalDayBoundaries(now, "UTC");
      expect(todayStart.getTime()).toBeGreaterThan(yesterdayStart.getTime());
    });

    it("returns boundaries 24 hours apart", () => {
      const now = new Date("2026-04-03T12:00:00Z");
      const { todayStart, yesterdayStart } = getLocalDayBoundaries(now, "Europe/Istanbul");
      const diffMs = todayStart.getTime() - yesterdayStart.getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});
