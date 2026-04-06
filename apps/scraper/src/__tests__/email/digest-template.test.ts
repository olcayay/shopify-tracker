import { describe, it, expect } from "vitest";
import { buildDigestHtml, buildDigestSubject } from "../../email/digest-template.js";
import type { DigestData, TrackedAppDigest, RankingChange } from "../../email/digest-builder.js";

function makeRankingChange(overrides: Partial<RankingChange> = {}): RankingChange {
  return {
    keyword: "email",
    keywordSlug: "email",
    appName: "App",
    appSlug: "app",
    yesterdayPosition: 5,
    todayPosition: 3,
    change: 2,
    type: "improved",
    ...overrides,
  };
}

function makeTrackedApp(overrides: Partial<TrackedAppDigest> = {}): TrackedAppDigest {
  return {
    appId: 1,
    appName: "App",
    appSlug: "app",
    platform: "shopify",
    keywordChanges: [],
    categoryChanges: [],
    ratingToday: null,
    ratingYesterday: null,
    ratingChange: null,
    reviewCountToday: null,
    reviewCountYesterday: null,
    reviewCountChange: null,
    ...overrides,
  };
}

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    accountName: "Test Account",
    date: "03/29/2026",
    trackedApps: [],
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
    const kwChange = makeRankingChange({
      keyword: "crm tools", keywordSlug: "crm-tools",
      appName: "Super CRM", appSlug: "super-crm",
      yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved",
    });
    const html = buildDigestHtml(
      makeDigestData({
        trackedApps: [makeTrackedApp({ appName: "Super CRM", appSlug: "super-crm", keywordChanges: [kwChange] })],
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("Super CRM");
    expect(html).toContain("crm tools");
  });

  it("renders per-app keyword rankings with wins and drops", () => {
    const kw1 = makeRankingChange({ keyword: "k1", keywordSlug: "k1", appName: "A1", appSlug: "a1", yesterdayPosition: 5, todayPosition: 2, change: 3, type: "improved" });
    const kw2 = makeRankingChange({ keyword: "k2", keywordSlug: "k2", appName: "A1", appSlug: "a1", yesterdayPosition: 2, todayPosition: 5, change: -3, type: "dropped" });
    const html = buildDigestHtml(
      makeDigestData({
        trackedApps: [makeTrackedApp({ appName: "A1", appSlug: "a1", keywordChanges: [kw1, kw2] })],
        summary: { improved: 1, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("Keyword Rankings");
    expect(html).toContain("k1");
    expect(html).toContain("k2");
  });

  it("shows change icons (▲ for improved, ▼ for dropped)", () => {
    const kw1 = makeRankingChange({ keyword: "k1", keywordSlug: "k1", change: 3, type: "improved" });
    const kw2 = makeRankingChange({ keyword: "k2", keywordSlug: "k2", change: -3, type: "dropped", todayPosition: 8, yesterdayPosition: 5 });
    const html = buildDigestHtml(
      makeDigestData({
        trackedApps: [makeTrackedApp({ keywordChanges: [kw1, kw2] })],
      }),
    );
    expect(html).toContain("&#9650;"); // ▲
    expect(html).toContain("&#9660;"); // ▼
  });

  it("renders Competitor Watch section", () => {
    const html = buildDigestHtml(
      makeDigestData({
        trackedApps: [makeTrackedApp({ keywordChanges: [makeRankingChange()] })],
        competitorSummaries: [
          {
            appName: "Competitor X", appSlug: "competitor-x",
            todayRating: "4.2", yesterdayRating: "4.1", ratingChange: 0.1,
            todayReviews: 150, yesterdayReviews: 148, reviewsChange: 2,
            keywordPositions: [{ keyword: "analytics", position: 3, change: 1 }],
          },
        ],
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("Competitor Watch");
    expect(html).toContain("Competitor X");
  });

  it("generates insight for strong momentum", () => {
    const kws = Array.from({ length: 5 }, (_, i) =>
      makeRankingChange({ keyword: `kw${i}`, keywordSlug: `kw${i}`, change: 5, type: "improved" })
    );
    const html = buildDigestHtml(
      makeDigestData({
        summary: { improved: 5, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
        trackedApps: [makeTrackedApp({ keywordChanges: kws })],
      }),
    );
    expect(html).toContain("Insight");
    expect(html).toContain("momentum");
  });

  it("includes deep links to keyword pages", () => {
    const kw = makeRankingChange({ keyword: "email", keywordSlug: "email", todayPosition: 3, change: 2 });
    const html = buildDigestHtml(
      makeDigestData({
        platform: "shopify",
        trackedApps: [makeTrackedApp({ keywordChanges: [kw] })],
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
  it("returns subject with app name for keyword improvements", () => {
    const kw = makeRankingChange({ keyword: "email", appName: "Klaviyo", appSlug: "klaviyo", todayPosition: 2, change: 5 });
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
        trackedApps: [makeTrackedApp({ appName: "Klaviyo", appSlug: "klaviyo", keywordChanges: [kw] })],
      }),
    );
    expect(subject).toContain("Klaviyo");
    expect(subject).toContain("jumped");
  });

  it("returns mixed subject for mixed day", () => {
    const kw1 = makeRankingChange({ change: 1, todayPosition: 15, yesterdayPosition: 16 });
    const kw2 = makeRankingChange({ keyword: "kw2", change: -2, type: "dropped", todayPosition: 20, yesterdayPosition: 18 });
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 2, dropped: 2, newEntries: 0, droppedOut: 0, unchanged: 0 },
        trackedApps: [makeTrackedApp({ keywordChanges: [kw1, kw2] })],
      }),
    );
    expect(subject).toContain("keywords");
  });

  it("returns stable subject for no changes", () => {
    const subject = buildDigestSubject(
      makeDigestData({
        trackedApps: [makeTrackedApp({ appName: "App" })],
      }),
    );
    expect(subject).toContain("stable");
  });

  it("references app name in subject", () => {
    const kw = makeRankingChange({ keyword: "email", todayPosition: 3, yesterdayPosition: 7, change: 4 });
    const subject = buildDigestSubject(
      makeDigestData({
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
        trackedApps: [makeTrackedApp({ appName: "MyApp", keywordChanges: [kw] })],
      }),
    );
    expect(subject).toContain("MyApp");
  });
});
