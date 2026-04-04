import { describe, it, expect } from "vitest";
import { getNotificationPriority } from "../../notifications/priority-queue.js";

describe("getNotificationPriority", () => {
  it("returns 'urgent' for scrape_failed", () => {
    expect(getNotificationPriority("system_scrape_failed")).toBe("urgent");
  });

  it("returns 'urgent' for limit_reached", () => {
    expect(getNotificationPriority("account_limit_reached")).toBe("urgent");
  });

  it("returns 'high' for ranking top3 entry", () => {
    expect(getNotificationPriority("ranking_top3_entry")).toBe("high");
  });

  it("returns 'high' for competitor overtook", () => {
    expect(getNotificationPriority("competitor_overtook")).toBe("high");
  });

  it("returns 'high' for negative review", () => {
    expect(getNotificationPriority("review_new_negative")).toBe("high");
  });

  it("returns 'low' for scrape_complete", () => {
    expect(getNotificationPriority("system_scrape_complete")).toBe("low");
  });

  it("returns 'low' for member_joined", () => {
    expect(getNotificationPriority("account_member_joined")).toBe("low");
  });

  it("returns 'normal' for unknown types", () => {
    expect(getNotificationPriority("some_unknown_type")).toBe("normal");
  });

  it("returns 'normal' for review_new_positive", () => {
    expect(getNotificationPriority("review_new_positive")).toBe("normal");
  });

  it("returns 'high' for ranking_dropped_out", () => {
    expect(getNotificationPriority("ranking_dropped_out")).toBe("high");
  });
});
