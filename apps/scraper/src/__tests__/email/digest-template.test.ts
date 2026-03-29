import { describe, it, expect } from "vitest";
import { buildDigestHtml, buildDigestSubject } from "../../email/digest-template.js";
import type { DigestData } from "../../email/digest-builder.js";

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    accountName: "Test Account",
    date: "03/29/2026",
    rankingChanges: [],
    competitorSummaries: [],
    summary: { improved: 0, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    ...overrides,
  };
}

describe("buildDigestHtml", () => {
  it("returns valid HTML with DOCTYPE", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("</html>");
  });

  it("contains account name and date", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("Test Account");
    expect(html).toContain("03/29/2026");
  });

  it("contains Daily Ranking Report header", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("Daily Ranking Report");
  });

  it("shows summary badges when changes exist", () => {
    const html = buildDigestHtml(
      makeDigestData({
        summary: { improved: 3, dropped: 2, newEntries: 1, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("3 improved");
    expect(html).toContain("2 dropped");
    expect(html).toContain("1 new");
  });

  it("renders hero stat highlight for improvements", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          {
            keyword: "crm tools", keywordSlug: "crm-tools",
            appName: "Super CRM", appSlug: "super-crm",
            isTracked: true, isCompetitor: false,
            yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved",
          },
        ],
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("Super CRM");
    expect(html).toContain("crm tools");
  });

  it("splits ranking changes into Biggest Wins and Needs Attention", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          { keyword: "k1", keywordSlug: "k1", appName: "A1", appSlug: "a1", isTracked: true, isCompetitor: false, yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved" },
          { keyword: "k2", keywordSlug: "k2", appName: "A2", appSlug: "a2", isTracked: true, isCompetitor: false, yesterdayPosition: 2, todayPosition: 5, change: -3, type: "dropped" },
        ],
        summary: { improved: 1, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("Biggest Wins");
    expect(html).toContain("Needs Attention");
  });

  it("shows change icons (▲ for improved, ▼ for dropped)", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          { keyword: "k1", keywordSlug: "k1", appName: "A1", appSlug: "a1", isTracked: false, isCompetitor: false, yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved" },
          { keyword: "k2", keywordSlug: "k2", appName: "A2", appSlug: "a2", isTracked: false, isCompetitor: false, yesterdayPosition: 2, todayPosition: 5, change: -3, type: "dropped" },
        ],
      }),
    );
    expect(html).toContain("&#9650;"); // ▲
    expect(html).toContain("&#9660;"); // ▼
  });

  it("renders Competitor Watch section", () => {
    const html = buildDigestHtml(
      makeDigestData({
        competitorSummaries: [
          {
            appName: "Competitor X", appSlug: "competitor-x",
            todayRating: "4.2", yesterdayRating: "4.1", ratingChange: 0.1,
            todayReviews: 150, yesterdayReviews: 148, reviewsChange: 2,
            keywordPositions: [{ keyword: "analytics", position: 3, change: 1 }],
          },
        ],
      }),
    );
    expect(html).toContain("Competitor Watch");
    expect(html).toContain("Competitor X");
  });

  it("generates insight for strong momentum", () => {
    const html = buildDigestHtml(
      makeDigestData({
        summary: { improved: 5, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
        rankingChanges: Array.from({ length: 5 }, (_, i) => ({
          keyword: `kw${i}`, keywordSlug: `kw${i}`, appName: "App", appSlug: "app",
          isTracked: true, isCompetitor: false,
          yesterdayPosition: 10, todayPosition: 5, change: 5, type: "improved" as const,
        })),
      }),
    );
    expect(html).toContain("Insight");
    expect(html).toContain("momentum");
  });

  it("includes deep links to keyword pages", () => {
    const html = buildDigestHtml(
      makeDigestData({
        platform: "shopify",
        rankingChanges: [
          { keyword: "email", keywordSlug: "email", appName: "A1", appSlug: "a1", isTracked: true, isCompetitor: false, yesterdayPosition: 5, todayPosition: 3, change: 2, type: "improved" },
        ],
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("/shopify/keywords/email");
  });

  it("includes footer with unsubscribe when URL provided", () => {
    const html = buildDigestHtml(makeDigestData(), "https://api.appranks.io/unsubscribe/token");
    expect(html).toContain("Unsubscribe");
  });
});

describe("buildDigestSubject", () => {
  it("returns win subject when improvements dominate", () => {
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 5, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
        rankingChanges: [
          { keyword: "email", keywordSlug: "email", appName: "Klaviyo", appSlug: "klaviyo", isTracked: true, isCompetitor: false, yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved" },
        ],
      }),
    );
    expect(subject).toContain("Klaviyo");
  });

  it("returns alert subject when drops dominate", () => {
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 0, dropped: 3, newEntries: 0, droppedOut: 0, unchanged: 0 },
        rankingChanges: [
          { keyword: "crm", keywordSlug: "crm", appName: "MyCRM", appSlug: "my-crm", isTracked: true, isCompetitor: false, yesterdayPosition: 3, todayPosition: 8, change: -5, type: "dropped" },
        ],
      }),
    );
    expect(subject).toContain("Heads up");
    expect(subject).toContain("MyCRM");
  });

  it("returns mixed subject for mixed day", () => {
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 2, dropped: 2, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(subject).toContain("2 keywords up");
    expect(subject).toContain("2 down");
  });

  it("returns default subject for no changes", () => {
    const subject = buildDigestSubject(makeDigestData());
    expect(subject).toContain("Daily Ranking Report");
  });

  it("highlights top position for win day with top 5 entry", () => {
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 3, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
        rankingChanges: [
          { keyword: "email", keywordSlug: "email", appName: "App", appSlug: "app", isTracked: true, isCompetitor: false, yesterdayPosition: 7, todayPosition: 3, change: 4, type: "improved" },
        ],
      }),
    );
    expect(subject).toContain("climbed to #3");
  });
});
