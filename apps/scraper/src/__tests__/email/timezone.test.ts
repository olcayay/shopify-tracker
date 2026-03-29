import { describe, it, expect } from "vitest";
import {
  getLocalTime,
  isInDeliveryWindow,
  alreadySentToday,
  getLocalDayBoundaries,
  DEFAULT_TIMEZONE,
  DEFAULT_TARGET_HOUR,
} from "../../email/timezone.js";

describe("getLocalTime", () => {
  it("returns correct local time for UTC", () => {
    const date = new Date("2026-03-29T14:30:00Z");
    const result = getLocalTime(date, "UTC");
    expect(result.hour).toBe(14);
    expect(result.minute).toBe(30);
    expect(result.dateStr).toBe("2026-03-29");
  });

  it("returns correct local time for Europe/Istanbul (UTC+3)", () => {
    const date = new Date("2026-03-29T05:00:00Z");
    const result = getLocalTime(date, "Europe/Istanbul");
    expect(result.hour).toBe(8); // 5 UTC + 3 = 8
    expect(result.minute).toBe(0);
  });

  it("returns correct local time for America/New_York (UTC-4 in DST)", () => {
    // March 29, 2026 is in DST for New York (EDT = UTC-4)
    const date = new Date("2026-03-29T12:00:00Z");
    const result = getLocalTime(date, "America/New_York");
    expect(result.hour).toBe(8); // 12 UTC - 4 = 8
    expect(result.minute).toBe(0);
  });

  it("returns correct local time for Asia/Tokyo (UTC+9)", () => {
    const date = new Date("2026-03-28T23:00:00Z");
    const result = getLocalTime(date, "Asia/Tokyo");
    expect(result.hour).toBe(8); // 23 UTC + 9 = 32 = next day 8
    expect(result.dateStr).toBe("2026-03-29"); // crossed midnight
  });

  it("returns correct local time for Pacific/Auckland (UTC+12/+13)", () => {
    const date = new Date("2026-03-28T20:00:00Z");
    const result = getLocalTime(date, "Pacific/Auckland");
    expect(result.hour).toBe(9); // NZDT = UTC+13 in March
  });

  it("falls back to default timezone for invalid timezone", () => {
    const date = new Date("2026-03-29T05:00:00Z");
    const result = getLocalTime(date, "Invalid/Timezone");
    const expected = getLocalTime(date, DEFAULT_TIMEZONE);
    expect(result.hour).toBe(expected.hour);
    expect(result.minute).toBe(expected.minute);
  });

  it("handles date at midnight UTC", () => {
    const date = new Date("2026-03-29T00:00:00Z");
    const result = getLocalTime(date, "UTC");
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
  });
});

describe("isInDeliveryWindow", () => {
  it("returns true when local time is exactly target hour", () => {
    // 5 AM UTC = 8 AM Istanbul (UTC+3)
    const now = new Date("2026-03-29T05:00:00Z");
    expect(isInDeliveryWindow(now, "Europe/Istanbul")).toBe(true);
  });

  it("returns true within 15 minute window", () => {
    const now = new Date("2026-03-29T05:10:00Z"); // 8:10 AM Istanbul
    expect(isInDeliveryWindow(now, "Europe/Istanbul")).toBe(true);
  });

  it("returns false at minute 15 (outside window)", () => {
    const now = new Date("2026-03-29T05:15:00Z"); // 8:15 AM Istanbul
    expect(isInDeliveryWindow(now, "Europe/Istanbul")).toBe(false);
  });

  it("returns false at wrong hour", () => {
    const now = new Date("2026-03-29T06:00:00Z"); // 9 AM Istanbul
    expect(isInDeliveryWindow(now, "Europe/Istanbul")).toBe(false);
  });

  it("works with custom target hour", () => {
    const now = new Date("2026-03-29T06:00:00Z"); // 9 AM Istanbul
    expect(isInDeliveryWindow(now, "Europe/Istanbul", 9)).toBe(true);
  });

  it("works for UTC-12 (Baker Island)", () => {
    // When UTC is 20:00, Baker Island (UTC-12) is 8:00
    const now = new Date("2026-03-29T20:00:00Z");
    expect(isInDeliveryWindow(now, "Etc/GMT+12")).toBe(true);
  });

  it("works for UTC+14 (Line Islands)", () => {
    // When UTC is 18:00 March 28, Line Islands (UTC+14) is 8:00 March 29
    const now = new Date("2026-03-28T18:00:00Z");
    expect(isInDeliveryWindow(now, "Pacific/Kiritimati")).toBe(true);
  });
});

describe("alreadySentToday", () => {
  it("returns false when never sent", () => {
    const now = new Date("2026-03-29T08:00:00Z");
    expect(alreadySentToday(null, now, "Europe/Istanbul")).toBe(false);
  });

  it("returns true when sent today in user timezone", () => {
    const now = new Date("2026-03-29T10:00:00Z"); // 1 PM Istanbul
    const sentAt = new Date("2026-03-29T05:00:00Z"); // 8 AM Istanbul (same day)
    expect(alreadySentToday(sentAt, now, "Europe/Istanbul")).toBe(true);
  });

  it("returns false when sent yesterday in user timezone", () => {
    const now = new Date("2026-03-29T05:00:00Z"); // 8 AM Istanbul March 29
    const sentAt = new Date("2026-03-28T05:00:00Z"); // 8 AM Istanbul March 28
    expect(alreadySentToday(sentAt, now, "Europe/Istanbul")).toBe(false);
  });

  it("handles timezone crossing midnight correctly", () => {
    // UTC March 29 01:00 = Tokyo March 29 10:00
    const now = new Date("2026-03-29T01:00:00Z");
    // Sent at UTC March 28 22:00 = Tokyo March 29 07:00 (same local day!)
    const sentAt = new Date("2026-03-28T22:00:00Z");
    expect(alreadySentToday(sentAt, now, "Asia/Tokyo")).toBe(true);
  });

  it("handles timezone crossing midnight — different local days", () => {
    // UTC March 29 01:00 = Tokyo March 29 10:00
    const now = new Date("2026-03-29T01:00:00Z");
    // Sent at UTC March 28 14:00 = Tokyo March 28 23:00 (different local day)
    const sentAt = new Date("2026-03-28T14:00:00Z");
    expect(alreadySentToday(sentAt, now, "Asia/Tokyo")).toBe(false);
  });
});

describe("getLocalDayBoundaries", () => {
  it("returns UTC day boundaries for UTC timezone", () => {
    const now = new Date("2026-03-29T14:30:00Z");
    const { todayStart, yesterdayStart } = getLocalDayBoundaries(now, "UTC");

    // todayStart should be close to 2026-03-29T00:00:00Z
    expect(todayStart.getUTCFullYear()).toBe(2026);
    expect(todayStart.getUTCMonth()).toBe(2); // March = 2
    expect(todayStart.getUTCDate()).toBe(29);

    // yesterdayStart should be ~24h before todayStart
    expect(yesterdayStart.getTime()).toBe(todayStart.getTime() - 86400000);
  });

  it("returns timezone-adjusted boundaries for Istanbul", () => {
    // At 5:30 AM UTC, it's 8:30 AM in Istanbul (March 29)
    const now = new Date("2026-03-29T05:30:00Z");
    const { todayStart, yesterdayStart } = getLocalDayBoundaries(now, "Europe/Istanbul");

    // Istanbul midnight = 21:00 UTC previous day
    // todayStart should be around 2026-03-28T21:00:00Z (midnight Istanbul = UTC-3)
    const todayLocalTime = getLocalTime(todayStart, "Europe/Istanbul");
    expect(todayLocalTime.hour).toBe(0);
  });

  it("yesterday is exactly 24 hours before today", () => {
    const now = new Date("2026-03-29T12:00:00Z");
    const { todayStart, yesterdayStart } = getLocalDayBoundaries(now, "America/Los_Angeles");
    expect(todayStart.getTime() - yesterdayStart.getTime()).toBe(86400000);
  });
});

describe("constants", () => {
  it("default timezone is Europe/Istanbul", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Istanbul");
  });

  it("default target hour is 8", () => {
    expect(DEFAULT_TARGET_HOUR).toBe(8);
  });
});
