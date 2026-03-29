import { describe, it, expect } from "vitest";
import { buildNotificationContent } from "../../notifications/templates.js";
import { NOTIFICATION_TYPE_IDS } from "../../notification-types.js";
import type { NotificationType } from "../../notification-types.js";

describe("buildNotificationContent", () => {
  // ─── Ranking types ───────────────────────────────────────────────
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
    expect(content.url).toBe("/shopify/apps/klaviyo");
  });

  it("builds ranking_top3_exit content", () => {
    const content = buildNotificationContent("ranking_top3_exit", {
      appName: "Privy",
      keyword: "pop ups",
      position: 7,
      platform: "shopify",
      appSlug: "privy",
    });

    expect(content.title).toContain("Privy");
    expect(content.title).toContain("dropped out of Top 3");
    expect(content.body).toContain("position 7");
    expect(content.priority).toBe("high");
    expect(content.url).toBe("/shopify/apps/privy");
  });

  it("builds ranking_significant_change with upward movement", () => {
    const content = buildNotificationContent("ranking_significant_change", {
      appName: "Omnisend",
      keyword: "email",
      position: 3,
      previousPosition: 15,
      change: 12,
      platform: "shopify",
      appSlug: "omnisend",
    });

    expect(content.title).toContain("Omnisend");
    expect(content.title).toContain("↑12");
    expect(content.body).toContain("from 15 to 3");
    expect(content.priority).toBe("normal");
  });

  it("builds ranking_significant_change with downward movement", () => {
    const content = buildNotificationContent("ranking_significant_change", {
      appName: "TestApp",
      keyword: "seo",
      position: 20,
      previousPosition: 5,
      change: -15,
      platform: "shopify",
      appSlug: "test-app",
    });

    expect(content.title).toContain("↓15");
    expect(content.body).toContain("from 5 to 20");
  });

  it("builds ranking_new_entry content", () => {
    const content = buildNotificationContent("ranking_new_entry", {
      appName: "NewApp",
      categoryName: "Sales",
      position: 42,
      platform: "shopify",
      categorySlug: "sales",
    });

    expect(content.title).toContain("NewApp");
    expect(content.title).toContain("Sales");
    expect(content.body).toContain("position 42");
    expect(content.url).toBe("/shopify/categories/sales");
    expect(content.priority).toBe("normal");
  });

  it("builds ranking_dropped_out content", () => {
    const content = buildNotificationContent("ranking_dropped_out", {
      appName: "OldApp",
      categoryName: "Analytics",
      previousPosition: 30,
      platform: "shopify",
      categorySlug: "analytics",
    });

    expect(content.title).toContain("OldApp");
    expect(content.title).toContain("dropped out");
    expect(content.body).toContain("position 30");
    expect(content.priority).toBe("high");
    expect(content.url).toBe("/shopify/categories/analytics");
  });

  it("builds ranking_category_change content", () => {
    const content = buildNotificationContent("ranking_category_change", {
      appName: "MyApp",
      categoryName: "Marketing",
      position: 5,
      previousPosition: 12,
      change: 7,
      platform: "shopify",
      categorySlug: "marketing",
    });

    expect(content.title).toContain("MyApp");
    expect(content.title).toContain("Marketing");
    expect(content.body).toContain("from 12 to 5");
    expect(content.priority).toBe("normal");
  });

  // ─── Competitor types ────────────────────────────────────────────
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
    expect(content.body).toContain("crm");
    expect(content.priority).toBe("high");
    expect(content.url).toBe("/shopify/apps/rival-app");
  });

  it("builds competitor_featured content", () => {
    const content = buildNotificationContent("competitor_featured", {
      competitorName: "BigRival",
      surfaceName: "Staff Picks",
      platform: "shopify",
      competitorSlug: "big-rival",
    });

    expect(content.title).toContain("BigRival");
    expect(content.title).toContain("featured");
    expect(content.body).toContain("Staff Picks");
    expect(content.priority).toBe("normal");
  });

  it("builds competitor_featured with default surface name", () => {
    const content = buildNotificationContent("competitor_featured", {
      competitorName: "Rival",
      platform: "shopify",
      competitorSlug: "rival",
    });

    expect(content.body).toContain("featured section");
  });

  it("builds competitor_review_surge content", () => {
    const content = buildNotificationContent("competitor_review_surge", {
      competitorName: "GrowthApp",
      reviewCount: 25,
      platform: "shopify",
      competitorSlug: "growth-app",
    });

    expect(content.title).toContain("GrowthApp");
    expect(content.title).toContain("review surge");
    expect(content.body).toContain("25");
    expect(content.priority).toBe("normal");
  });

  it("builds competitor_pricing_change content", () => {
    const content = buildNotificationContent("competitor_pricing_change", {
      competitorName: "PriceyApp",
      platform: "shopify",
      competitorSlug: "pricey-app",
    });

    expect(content.title).toContain("PriceyApp");
    expect(content.title).toContain("pricing");
    expect(content.priority).toBe("high");
    expect(content.url).toBe("/shopify/apps/pricey-app");
  });

  // ─── Review types ────────────────────────────────────────────────
  it("builds review_new_positive content", () => {
    const content = buildNotificationContent("review_new_positive", {
      appName: "HappyApp",
      rating: 5,
      platform: "shopify",
      appSlug: "happy-app",
    });

    expect(content.title).toContain("5★");
    expect(content.title).toContain("HappyApp");
    expect(content.body).toContain("positive review");
    expect(content.priority).toBe("normal");
    expect(content.url).toBe("/shopify/apps/happy-app");
  });

  it("builds review_new_negative content with high priority", () => {
    const content = buildNotificationContent("review_new_negative", {
      appName: "TestApp",
      rating: 1,
      platform: "shopify",
      appSlug: "test-app",
    });

    expect(content.title).toContain("1★");
    expect(content.body).toContain("negative review");
    expect(content.priority).toBe("high");
  });

  it("builds review_velocity_spike content", () => {
    const content = buildNotificationContent("review_velocity_spike", {
      appName: "SpikyApp",
      reviewCount: 50,
      platform: "shopify",
      appSlug: "spiky-app",
    });

    expect(content.title).toContain("velocity spike");
    expect(content.title).toContain("SpikyApp");
    expect(content.body).toContain("50");
    expect(content.body).toContain("unusual activity");
    expect(content.priority).toBe("normal");
  });

  // ─── Keyword types ───────────────────────────────────────────────
  it("builds keyword_position_gained content", () => {
    const content = buildNotificationContent("keyword_position_gained", {
      appName: "SEOApp",
      keyword: "analytics",
      position: 3,
      previousPosition: 10,
      change: 7,
      platform: "shopify",
      keywordSlug: "analytics",
    });

    expect(content.title).toContain("SEOApp");
    expect(content.title).toContain("gained position");
    expect(content.body).toContain("from 10 to 3");
    expect(content.body).toContain("↑7");
    expect(content.priority).toBe("normal");
    expect(content.url).toBe("/shopify/keywords/analytics");
  });

  it("builds keyword_position_lost content", () => {
    const content = buildNotificationContent("keyword_position_lost", {
      appName: "DropApp",
      keyword: "shipping",
      position: 15,
      previousPosition: 5,
      platform: "shopify",
      keywordSlug: "shipping",
    });

    expect(content.title).toContain("DropApp");
    expect(content.title).toContain("lost position");
    expect(content.body).toContain("from 5 to 15");
    expect(content.priority).toBe("normal");
  });

  it("builds keyword_new_ranking content", () => {
    const content = buildNotificationContent("keyword_new_ranking", {
      appName: "FreshApp",
      keyword: "inventory management",
      position: 8,
      platform: "shopify",
      keywordSlug: "inventory-management",
    });

    expect(content.title).toContain("FreshApp");
    expect(content.title).toContain("ranked");
    expect(content.body).toContain("First appearance");
    expect(content.body).toContain("position 8");
    expect(content.priority).toBe("normal");
    expect(content.url).toBe("/shopify/keywords/inventory-management");
  });

  // ─── Featured types ──────────────────────────────────────────────
  it("builds featured_new_placement content", () => {
    const content = buildNotificationContent("featured_new_placement", {
      appName: "StarApp",
      surfaceName: "Trending This Week",
      platform: "shopify",
      appSlug: "star-app",
    });

    expect(content.title).toContain("StarApp");
    expect(content.title).toContain("featured");
    expect(content.body).toContain("Trending This Week");
    expect(content.priority).toBe("normal");
    expect(content.url).toBe("/shopify/apps/star-app");
  });

  it("builds featured_new_placement with default surface name", () => {
    const content = buildNotificationContent("featured_new_placement", {
      appName: "NoSurface",
      platform: "shopify",
      appSlug: "no-surface",
    });

    expect(content.body).toContain("a featured section");
  });

  it("builds featured_removed content with low priority", () => {
    const content = buildNotificationContent("featured_removed", {
      appName: "GoneApp",
      surfaceName: "Staff Picks",
      platform: "shopify",
      appSlug: "gone-app",
    });

    expect(content.title).toContain("GoneApp");
    expect(content.title).toContain("removed from featured");
    expect(content.body).toContain("Staff Picks");
    expect(content.priority).toBe("low");
  });

  // ─── System types ────────────────────────────────────────────────
  it("builds system_scrape_complete content", () => {
    const content = buildNotificationContent("system_scrape_complete", {
      scraperType: "app_details",
      platform: "shopify",
    });

    expect(content.title).toContain("Scrape completed");
    expect(content.title).toContain("app_details");
    expect(content.body).toContain("shopify");
    expect(content.body).toContain("finished successfully");
    expect(content.priority).toBe("low");
    expect(content.url).toBeNull();
  });

  it("builds system_scrape_failed with urgent priority", () => {
    const content = buildNotificationContent("system_scrape_failed", {
      scraperType: "app_details",
      platform: "shopify",
      errorMessage: "Connection timeout after 30s",
    });

    expect(content.priority).toBe("urgent");
    expect(content.body).toContain("Connection timeout");
    expect(content.url).toBeNull();
  });

  it("builds system_scrape_failed with fallback error message", () => {
    const content = buildNotificationContent("system_scrape_failed", {
      scraperType: "rankings",
      platform: "wix",
    });

    expect(content.body).toBe("Unknown error");
  });

  it("truncates long error messages in system_scrape_failed", () => {
    const longError = "A".repeat(300);
    const content = buildNotificationContent("system_scrape_failed", {
      scraperType: "reviews",
      platform: "shopify",
      errorMessage: longError,
    });

    expect(content.body.length).toBeLessThanOrEqual(200);
    expect(content.body.endsWith("…")).toBe(true);
  });

  // ─── Account types ───────────────────────────────────────────────
  it("builds account_member_joined with member name", () => {
    const content = buildNotificationContent("account_member_joined", {
      memberName: "John Doe",
      memberEmail: "john@test.com",
    });

    expect(content.title).toContain("John Doe");
    expect(content.title).toContain("joined your team");
    expect(content.body).toContain("new team member");
    expect(content.priority).toBe("normal");
    expect(content.url).toBe("/settings");
  });

  it("builds account_member_joined with email fallback", () => {
    const content = buildNotificationContent("account_member_joined", {
      memberEmail: "jane@test.com",
    });

    expect(content.title).toContain("jane@test.com");
  });

  it("builds account_limit_warning content", () => {
    const content = buildNotificationContent("account_limit_warning", {
      limitType: "tracked apps",
      current: 45,
      max: 50,
    });

    expect(content.title).toContain("tracked apps");
    expect(content.title).toContain("limit");
    expect(content.body).toContain("45");
    expect(content.body).toContain("50");
    expect(content.body).toContain("upgrading");
    expect(content.priority).toBe("high");
    expect(content.url).toBe("/settings");
  });

  it("builds account_limit_reached content", () => {
    const content = buildNotificationContent("account_limit_reached", {
      limitType: "tracked apps",
      current: 50,
      max: 50,
    });

    expect(content.title).toContain("limit reached");
    expect(content.body).toContain("50");
    expect(content.body).toContain("Upgrade");
    expect(content.priority).toBe("urgent");
    expect(content.url).toBe("/settings");
  });

  // ─── URL generation ──────────────────────────────────────────────
  it("generates null URL when platform is missing", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
      position: 1,
      appSlug: "test",
    });

    expect(content.url).toBeNull();
  });

  it("generates null URL when slug is missing", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
      position: 1,
      platform: "shopify",
    });

    expect(content.url).toBeNull();
  });

  it("generates correct URL for keyword types", () => {
    const content = buildNotificationContent("keyword_position_gained", {
      appName: "App",
      keyword: "seo tools",
      keywordSlug: "seo-tools",
      platform: "wix",
      position: 1,
      previousPosition: 3,
      change: 2,
    });

    expect(content.url).toBe("/wix/keywords/seo-tools");
  });

  it("generates correct URL for category types", () => {
    const content = buildNotificationContent("ranking_new_entry", {
      appName: "App",
      categoryName: "Marketing",
      categorySlug: "marketing",
      platform: "atlassian",
      position: 5,
    });

    expect(content.url).toBe("/atlassian/categories/marketing");
  });

  // ─── Truncation ──────────────────────────────────────────────────
  it("truncates long titles to 65 characters", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "A Very Long Application Name That Exceeds Sixty Five Characters Limit",
      keyword: "another very long keyword phrase",
      position: 1,
    });

    expect(content.title.length).toBeLessThanOrEqual(65);
    expect(content.title.endsWith("…")).toBe(true);
  });

  it("does not truncate short titles", () => {
    const content = buildNotificationContent("ranking_top3_entry", {
      appName: "App",
      keyword: "seo",
      position: 1,
    });

    expect(content.title.endsWith("…")).toBe(false);
  });

  // ─── Completeness ────────────────────────────────────────────────
  it("all notification types have templates and produce valid content", () => {
    for (const type of NOTIFICATION_TYPE_IDS) {
      const content = buildNotificationContent(type, {
        appName: "Test",
        keyword: "test",
        position: 1,
        previousPosition: 5,
        change: 4,
        rating: 5,
        reviewCount: 10,
        competitorName: "Rival",
        competitorSlug: "rival",
        surfaceName: "Featured",
        memberName: "Alice",
        memberEmail: "alice@test.com",
        limitType: "apps",
        current: 5,
        max: 10,
        scraperType: "details",
        platform: "shopify",
        errorMessage: "Error",
      });
      expect(content.title).toBeTruthy();
      expect(content.body).toBeTruthy();
      expect(content.priority).toMatch(/^(low|normal|high|urgent)$/);
    }
  });

  // ─── Priority correctness ────────────────────────────────────────
  it("assigns correct priorities across all types", () => {
    const priorityMap: Record<string, string> = {
      ranking_top3_entry: "high",
      ranking_top3_exit: "high",
      ranking_significant_change: "normal",
      ranking_new_entry: "normal",
      ranking_dropped_out: "high",
      ranking_category_change: "normal",
      competitor_overtook: "high",
      competitor_featured: "normal",
      competitor_review_surge: "normal",
      competitor_pricing_change: "high",
      review_new_positive: "normal",
      review_new_negative: "high",
      review_velocity_spike: "normal",
      keyword_position_gained: "normal",
      keyword_position_lost: "normal",
      keyword_new_ranking: "normal",
      featured_new_placement: "normal",
      featured_removed: "low",
      system_scrape_complete: "low",
      system_scrape_failed: "urgent",
      account_member_joined: "normal",
      account_limit_warning: "high",
      account_limit_reached: "urgent",
    };

    for (const [type, expectedPriority] of Object.entries(priorityMap)) {
      const content = buildNotificationContent(type as NotificationType, {
        appName: "Test", keyword: "test", position: 1, competitorName: "R",
        scraperType: "x", platform: "shopify", limitType: "apps", current: 1, max: 2,
        memberName: "A", rating: 1, reviewCount: 1, errorMessage: "err",
      });
      expect(content.priority).toBe(expectedPriority);
    }
  });
});
