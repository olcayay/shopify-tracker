import { describe, it, expect } from "vitest";
import { buildDigestHtml, buildDigestSubject } from "../digest-template.js";
import type { DigestData, TrackedAppDigest, RankingChange, CategoryRankingChange, CompetitorSummary } from "../digest-builder.js";

function makeRankingChange(overrides: Partial<RankingChange> = {}): RankingChange {
  return {
    keyword: "email marketing",
    keywordSlug: "email-marketing",
    appName: "My App",
    appSlug: "my-app",
    yesterdayPosition: 5,
    todayPosition: 3,
    change: 2,
    type: "improved",
    ...overrides,
  };
}

function makeCategoryChange(overrides: Partial<CategoryRankingChange> = {}): CategoryRankingChange {
  return {
    categorySlug: "marketing",
    categoryName: "Marketing",
    yesterdayPosition: 10,
    todayPosition: 5,
    change: 5,
    type: "improved",
    ...overrides,
  };
}

function makeTrackedApp(overrides: Partial<TrackedAppDigest> = {}): TrackedAppDigest {
  return {
    appId: 1,
    appName: "My App",
    appSlug: "my-app",
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

function makeDigest(overrides: Partial<DigestData> = {}): DigestData {
  return {
    accountName: "Test Account",
    date: "04/06/2026",
    platform: "shopify",
    trackedApps: [],
    competitorSummaries: [],
    summary: { improved: 0, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    ...overrides,
  };
}

describe("buildDigestHtml", () => {
  it("renders per-app sections with app name and platform badge", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "Klaviyo",
          appSlug: "klaviyo",
          platform: "shopify",
          keywordChanges: [makeRankingChange({ keyword: "email automation", todayPosition: 2, change: 3 })],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("Klaviyo");
    expect(html).toContain("shopify");
    expect(html).toContain("email automation");
    expect(html).toContain("/shopify/apps/klaviyo");
  });

  it("renders overview card with rating and review data", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          ratingToday: 4.8,
          ratingChange: 0.1,
          reviewCountToday: 350,
          reviewCountChange: 5,
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("4.8");
    expect(html).toContain("350");
    expect(html).toContain("+0.1");
    expect(html).toContain("+5");
  });

  it("renders category rankings section", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          categoryChanges: [
            makeCategoryChange({ categoryName: "Marketing", todayPosition: 2, change: 3, type: "improved" }),
            makeCategoryChange({ categoryName: "Sales", categorySlug: "sales", todayPosition: 15, yesterdayPosition: 10, change: -5, type: "dropped" }),
          ],
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("Category Rankings");
    expect(html).toContain("Marketing");
    expect(html).toContain("Sales");
  });

  it("renders keyword rankings section with links", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          keywordChanges: [
            makeRankingChange({ keyword: "email marketing", keywordSlug: "email-marketing", todayPosition: 2, change: 5 }),
            makeRankingChange({ keyword: "newsletter", keywordSlug: "newsletter", todayPosition: 10, change: -3, type: "dropped" }),
          ],
        }),
      ],
      summary: { improved: 1, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("Keyword Rankings");
    expect(html).toContain("/shopify/keywords/email-marketing");
    expect(html).toContain("/shopify/keywords/newsletter");
  });

  it("renders multiple tracked apps as separate sections", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({ appName: "App Alpha", appSlug: "app-alpha", keywordChanges: [makeRankingChange()] }),
        makeTrackedApp({ appName: "App Beta", appSlug: "app-beta", appId: 2, keywordChanges: [makeRankingChange({ appName: "App Beta", appSlug: "app-beta" })] }),
      ],
      summary: { improved: 2, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("App Alpha");
    expect(html).toContain("App Beta");
  });

  it("renders competitor watch section (unchanged from before)", () => {
    const data = makeDigest({
      trackedApps: [makeTrackedApp({ keywordChanges: [makeRankingChange()] })],
      competitorSummaries: [{
        appName: "Rival App",
        appSlug: "rival-app",
        todayRating: "4.5",
        yesterdayRating: "4.4",
        ratingChange: 0.1,
        todayReviews: 200,
        yesterdayReviews: 195,
        reviewsChange: 5,
        keywordPositions: [{ keyword: "email", position: 4, change: 1 }],
      }],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("Competitor Watch");
    expect(html).toContain("Rival App");
  });

  it("renders insight block when insight is generated", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          keywordChanges: [
            makeRankingChange({ keyword: "kw1", change: 3 }),
            makeRankingChange({ keyword: "kw2", change: 2 }),
            makeRankingChange({ keyword: "kw3", change: 1 }),
          ],
        }),
      ],
      summary: { improved: 3, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("Insight");
    expect(html).toContain("Strong momentum");
  });

  it("skips app section when app has no content", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({ appName: "Empty App" }),
        makeTrackedApp({ appName: "Active App", appId: 2, keywordChanges: [makeRankingChange()] }),
      ],
      competitorSummaries: [{
        appName: "Comp", appSlug: "comp", todayRating: "4.0", yesterdayRating: "3.9",
        ratingChange: 0.1, todayReviews: 10, yesterdayReviews: 9, reviewsChange: 1,
        keywordPositions: [],
      }],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    // Empty app has no keyword/category/rating changes, so no section
    expect(html).not.toContain("Empty App");
    expect(html).toContain("Active App");
  });

  it("uses correct hero highlight for category milestone (#1)", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "Top App",
          categoryChanges: [makeCategoryChange({ categoryName: "Marketing", todayPosition: 1, yesterdayPosition: 3, change: 2, type: "improved" })],
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);

    expect(html).toContain("reached #1 in Marketing");
  });
});

describe("buildDigestSubject", () => {
  it("returns category milestone subject when app reaches #1", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "Klaviyo",
          categoryChanges: [makeCategoryChange({ categoryName: "Marketing", todayPosition: 1, yesterdayPosition: 3, change: 2, type: "improved" })],
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const subject = buildDigestSubject(data);
    expect(subject).toContain("Klaviyo");
    expect(subject).toContain("reached #1");
    expect(subject).toContain("Marketing");
  });

  it("returns big keyword jump subject (+3 or more)", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          keywordChanges: [
            makeRankingChange({ keyword: "email marketing", todayPosition: 3, change: 5 }),
          ],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const subject = buildDigestSubject(data);
    expect(subject).toContain("My App");
    expect(subject).toContain("jumped +5");
    expect(subject).toContain("email marketing");
  });

  it("returns review milestone subject when crossing threshold", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          ratingToday: 4.8,
          ratingChange: 0,
          reviewCountToday: 502,
          reviewCountYesterday: 498,
          reviewCountChange: 4,
          keywordChanges: [],
        }),
      ],
    });

    const subject = buildDigestSubject(data);
    expect(subject).toContain("hit 500 reviews");
    expect(subject).toContain("4.8");
  });

  it("returns mixed summary subject with app name", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          keywordChanges: [
            makeRankingChange({ change: 1, todayPosition: 15, yesterdayPosition: 16 }),
            makeRankingChange({ keyword: "kw2", change: -2, type: "dropped", todayPosition: 20, yesterdayPosition: 18 }),
          ],
        }),
      ],
      summary: { improved: 1, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const subject = buildDigestSubject(data);
    expect(subject).toContain("My App");
    expect(subject).toContain("keywords");
  });

  it("returns quiet-day subject when no changes", () => {
    const data = makeDigest({
      trackedApps: [makeTrackedApp({ appName: "My App" })],
    });
    const subject = buildDigestSubject(data);
    expect(subject).toContain("My App");
    expect(subject).toContain("stable");
  });

  it("picks app with biggest change when multiple tracked apps", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({ appName: "Small App", keywordChanges: [makeRankingChange({ change: 1 })] }),
        makeTrackedApp({ appName: "Big App", appId: 2, keywordChanges: [makeRankingChange({ appName: "Big App", change: 10 })] }),
      ],
      summary: { improved: 2, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const subject = buildDigestSubject(data);
    expect(subject).toContain("Big App");
  });
});

describe("generateInsight (via buildDigestHtml)", () => {
  it("generates category insight when app reaches top 3 in a category", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          categoryChanges: [makeCategoryChange({ categoryName: "Sales", todayPosition: 2, change: 3, type: "improved" })],
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);
    expect(html).toContain("Insight");
    expect(html).toContain("My App");
    expect(html).toContain("Sales");
  });

  it("generates review velocity insight", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          reviewCountToday: 105,
          reviewCountYesterday: 100,
          reviewCountChange: 5,
          keywordChanges: [makeRankingChange()],
        }),
      ],
      summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);
    expect(html).toContain("Insight");
    expect(html).toContain("5 reviews");
  });

  it("generates rating improvement insight", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          appName: "My App",
          ratingToday: 4.6,
          ratingYesterday: 4.4,
          ratingChange: 0.2,
          keywordChanges: [],
          categoryChanges: [],
          reviewCountToday: 50,
          reviewCountYesterday: 50,
          reviewCountChange: 0,
        }),
      ],
    });

    const html = buildDigestHtml(data);
    expect(html).toContain("Insight");
    expect(html).toContain("rating improved");
  });

  it("mentions competitor in drop insight when competitor gained", () => {
    const data = makeDigest({
      trackedApps: [
        makeTrackedApp({
          keywordChanges: [
            makeRankingChange({ keyword: "kw1", change: -3, type: "dropped" }),
            makeRankingChange({ keyword: "kw2", change: -4, type: "dropped" }),
            makeRankingChange({ keyword: "kw3", change: -2, type: "dropped" }),
          ],
        }),
      ],
      competitorSummaries: [{
        appName: "Rival", appSlug: "rival",
        todayRating: "4.5", yesterdayRating: "4.5", ratingChange: 0,
        todayReviews: 100, yesterdayReviews: 100, reviewsChange: 0,
        keywordPositions: [{ keyword: "kw1", position: 2, change: 3 }],
      }],
      summary: { improved: 0, dropped: 3, newEntries: 0, droppedOut: 0, unchanged: 0 },
    });

    const html = buildDigestHtml(data);
    expect(html).toContain("Insight");
    expect(html).toContain("Rival");
  });
});
