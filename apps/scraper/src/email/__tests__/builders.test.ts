import { describe, it, expect, vi } from "vitest";
import { buildRankingAlertData, type RankingAlertInput } from "../builders/ranking-alert-builder.js";
import { buildCompetitorAlertData, type CompetitorAlertInput } from "../builders/competitor-alert-builder.js";
import { buildReviewAlertData, type ReviewAlertInput } from "../builders/review-alert-builder.js";
import { buildWinCelebrationData, type WinCelebrationInput } from "../builders/win-celebration-builder.js";

// Mock DB that returns configurable results
function mockDb(selectResults: Record<number, any[]> = {}, executeResult: any[] = []) {
  let selectCallCount = 0;
  const mockChain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const result = selectResults[selectCallCount] || [];
      selectCallCount++;
      return Promise.resolve(result);
    }),
    execute: vi.fn().mockResolvedValue(executeResult),
  };
  return mockChain as any;
}

describe("buildRankingAlertData", () => {
  it("builds ranking alert with all data", async () => {
    const db = mockDb({
      0: [{ name: "Acme Corp" }],           // account
      1: [{ name: "My App", slug: "my-app" }], // app
      2: [{ keyword: "crm tools", slug: "crm-tools" }], // keyword
    });

    const input: RankingAlertInput = {
      accountId: "acc-1",
      appId: 1,
      keywordId: 1,
      oldPosition: 8,
      newPosition: 2,
      platform: "shopify",
    };

    const result = await buildRankingAlertData(db, input);

    expect(result.accountName).toBe("Acme Corp");
    expect(result.appName).toBe("My App");
    expect(result.appSlug).toBe("my-app");
    expect(result.keyword).toBe("crm tools");
    expect(result.alertType).toBe("top3_entry");
    expect(result.change).toBe(6);
    expect(result.previousPosition).toBe(8);
    expect(result.currentPosition).toBe(2);
  });

  it("detects top3_exit alert type", async () => {
    const db = mockDb({
      0: [{ name: "Test" }],
      1: [{ name: "App", slug: "app" }],
      2: [{ keyword: "kw", slug: "kw" }],
    });

    const result = await buildRankingAlertData(db, {
      accountId: "acc-1",
      appId: 1,
      keywordId: 1,
      oldPosition: 2,
      newPosition: 5,
      platform: "shopify",
    });

    expect(result.alertType).toBe("top3_exit");
  });

  it("detects new_entry alert type", async () => {
    const db = mockDb({
      0: [{ name: "Test" }],
      1: [{ name: "App", slug: "app" }],
      2: [{ keyword: "kw", slug: "kw" }],
    });

    const result = await buildRankingAlertData(db, {
      accountId: "acc-1",
      appId: 1,
      keywordId: 1,
      oldPosition: null,
      newPosition: 5,
      platform: "shopify",
    });

    expect(result.alertType).toBe("new_entry");
  });

  it("detects dropped_out alert type", async () => {
    const db = mockDb({
      0: [{ name: "Test" }],
      1: [{ name: "App", slug: "app" }],
      2: [{ keyword: "kw", slug: "kw" }],
    });

    const result = await buildRankingAlertData(db, {
      accountId: "acc-1",
      appId: 1,
      keywordId: 1,
      oldPosition: 5,
      newPosition: null,
      platform: "shopify",
    });

    expect(result.alertType).toBe("dropped_out");
  });

  it("handles missing DB records gracefully", async () => {
    const db = mockDb({
      0: [],
      1: [],
      2: [],
    });

    const result = await buildRankingAlertData(db, {
      accountId: "acc-1",
      appId: 999,
      keywordId: 999,
      oldPosition: 5,
      newPosition: 10,
      platform: "shopify",
    });

    expect(result.accountName).toBe("Your Account");
    expect(result.appName).toBe("Unknown App");
    expect(result.keyword).toBe("");
  });
});

describe("buildCompetitorAlertData", () => {
  it("builds competitor alert with all data", async () => {
    const db = mockDb({
      0: [{ name: "Acme Corp" }],
      1: [{ name: "My App", slug: "my-app" }],
      2: [{ name: "Rival App", slug: "rival-app", ratingCount: 500, averageRating: "4.5", pricingHint: "Free" }],
    });

    const input: CompetitorAlertInput = {
      accountId: "acc-1",
      trackedAppId: 1,
      competitorAppId: 2,
      platform: "shopify",
      alertType: "overtook",
      keyword: "email marketing",
      keywordSlug: "email-marketing",
      details: { competitorPosition: 1, yourPosition: 3 },
    };

    const result = await buildCompetitorAlertData(db, input);

    expect(result.accountName).toBe("Acme Corp");
    expect(result.trackedAppName).toBe("My App");
    expect(result.competitorName).toBe("Rival App");
    expect(result.alertType).toBe("overtook");
    expect(result.details.competitorPosition).toBe(1);
    expect(result.details.yourPosition).toBe(3);
  });

  it("handles missing DB records gracefully", async () => {
    const db = mockDb({ 0: [], 1: [], 2: [] });

    const result = await buildCompetitorAlertData(db, {
      accountId: "acc-1",
      trackedAppId: 999,
      competitorAppId: 999,
      platform: "shopify",
      alertType: "featured",
    });

    expect(result.accountName).toBe("Your Account");
    expect(result.trackedAppName).toBe("Unknown App");
    expect(result.competitorName).toBe("Unknown Competitor");
  });
});

describe("buildReviewAlertData", () => {
  it("builds review alert with all data", async () => {
    const db = mockDb({
      0: [{ name: "Acme Corp" }],
      1: [{ name: "My App", slug: "my-app", averageRating: "4.3", ratingCount: 150 }],
    });

    const result = await buildReviewAlertData(db, {
      accountId: "acc-1",
      appId: 1,
      platform: "shopify",
      alertType: "new_positive",
      rating: 5,
      reviewerName: "Jane Doe",
      reviewBody: "Great app!",
    });

    expect(result.appName).toBe("My App");
    expect(result.rating).toBe(5);
    expect(result.reviewerName).toBe("Jane Doe");
    expect(result.currentRating).toBe(4.3);
    expect(result.currentReviewCount).toBe(150);
  });

  it("truncates long review body", async () => {
    const db = mockDb({
      0: [{ name: "Test" }],
      1: [{ name: "App", slug: "app", averageRating: null, ratingCount: null }],
    });

    const longBody = "A".repeat(300);
    const result = await buildReviewAlertData(db, {
      accountId: "acc-1",
      appId: 1,
      platform: "shopify",
      alertType: "new_negative",
      reviewBody: longBody,
    });

    expect(result.reviewBody!.length).toBeLessThan(300);
    expect(result.reviewBody!.endsWith("...")).toBe(true);
  });
});

describe("buildWinCelebrationData", () => {
  it("builds win celebration with all data", async () => {
    const db = mockDb({
      0: [{ name: "Acme Corp" }],
      1: [{ name: "My App", slug: "my-app" }],
      2: [{ keyword: "crm tools", slug: "crm-tools" }],
    });

    const result = await buildWinCelebrationData(db, {
      accountId: "acc-1",
      appId: 1,
      platform: "shopify",
      milestoneType: "top1",
      keywordId: 1,
      position: 1,
      categoryName: "Business",
    });

    expect(result.appName).toBe("My App");
    expect(result.milestoneType).toBe("top1");
    expect(result.position).toBe(1);
    expect(result.keyword).toBe("crm tools");
    expect(result.categoryName).toBe("Business");
  });

  it("works without keyword", async () => {
    const db = mockDb({
      0: [{ name: "Test" }],
      1: [{ name: "App", slug: "app" }],
    });

    const result = await buildWinCelebrationData(db, {
      accountId: "acc-1",
      appId: 1,
      platform: "shopify",
      milestoneType: "review_milestone",
      reviewCount: 1000,
    });

    expect(result.milestoneType).toBe("review_milestone");
    expect(result.reviewCount).toBe(1000);
    expect(result.keyword).toBeUndefined();
  });
});
