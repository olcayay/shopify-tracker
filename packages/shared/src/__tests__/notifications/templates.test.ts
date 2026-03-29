import { describe, it, expect } from "vitest";
import { buildNotificationContent } from "../../notifications/templates.js";
import { NOTIFICATION_TYPE_IDS } from "../../notification-types.js";

describe("buildNotificationContent", () => {
  it("builds ranking_top3_entry content", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "Klaviyo",
      keyword: "email marketing",
      position: 2,
      categoryName: "Marketing",
      platform: "shopify",
      appSlug: "klaviyo",
    });

    expect(content.title).toContain("Klaviyo");
    expect(content.title).toContain("Top 3");
    expect(content.body).toContain("position 2");
    expect(content.priority).toBe("high");
    expect(content.url).toContain("/shopify/apps/klaviyo");
  });

  it("builds competitor_overtook content", () => {
    const content = buildNotificationContent("competitor_overtook", {
      appName: "MyApp",
      competitorName: "RivalApp",
      keyword: "crm",
      position: 3,
      platform: "shopify",
      competitorSlug: "rival-app",
    });

    expect(content.title).toContain("RivalApp");
    expect(content.title).toContain("overtook");
    expect(content.priority).toBe("high");
  });

  it("builds review_new_negative content with high priority", () => {
    const content = buildNotificationContent("review_new_negative", {
      appName: "TestApp",
      rating: 1,
      platform: "shopify",
      appSlug: "test-app",
    });

    expect(content.title).toContain("1★");
    expect(content.priority).toBe("high");
  });

  it("builds system_scrape_failed with urgent priority", () => {
    const content = buildNotificationContent("system_scrape_failed", {
      scraperType: "app_details",
      platform: "shopify",
      errorMessage: "Connection timeout after 30s",
    });

    expect(content.priority).toBe("urgent");
    expect(content.body).toContain("Connection timeout");
  });

  it("builds account_limit_reached content", () => {
    const content = buildNotificationContent("account_limit_reached", {
      limitType: "tracked apps",
      current: 50,
      max: 50,
    });

    expect(content.title).toContain("limit reached");
    expect(content.priority).toBe("urgent");
    expect(content.url).toBe("/settings");
  });

  it("truncates long titles to 65 characters", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "A Very Long Application Name That Exceeds Sixty Five Characters Limit",
      keyword: "another very long keyword phrase",
      position: 1,
    });

    expect(content.title.length).toBeLessThanOrEqual(65);
    expect(content.title.endsWith("…")).toBe(true);
  });

  it("all notification types have templates", () => {
    for (const type of NOTIFICATION_TYPE_IDS) {
      const content = buildNotificationContent(type, { appName: "Test", keyword: "test" });
      expect(content.title).toBeTruthy();
      expect(content.priority).toMatch(/^(low|normal|high|urgent)$/);
    }
  });
});
