import { describe, it, expect } from "vitest";
import { buildWeeklyHtml, buildWeeklySubject } from "../../email/weekly-template.js";
import type { WeeklyDigestData } from "../../email/weekly-builder.js";

function makeData(overrides: Partial<WeeklyDigestData> = {}): WeeklyDigestData {
  return {
    accountName: "Test Account",
    weekRange: "Mar 22 - Mar 29, 2026",
    rankings: [],
    competitors: [],
    summary: { improved: 0, dropped: 0, unchanged: 0, totalKeywords: 10 },
    ...overrides,
  };
}

describe("buildWeeklyHtml", () => {
  it("returns valid HTML", () => {
    const html = buildWeeklyHtml(makeData());
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("Weekly Summary");
    expect(html).toContain("Test Account");
  });

  it("shows Top Movers when improvements exist", () => {
    const html = buildWeeklyHtml(makeData({
      summary: { improved: 2, dropped: 0, unchanged: 8, totalKeywords: 10 },
      rankings: [
        { keyword: "email", keywordSlug: "email", appName: "App1", appSlug: "app1", isTracked: true, startPosition: 10, endPosition: 3, netChange: 7, bestPosition: 3 },
      ],
    }));
    expect(html).toContain("Top Movers");
    expect(html).toContain("email");
  });

  it("shows Biggest Drops section", () => {
    const html = buildWeeklyHtml(makeData({
      summary: { improved: 0, dropped: 1, unchanged: 9, totalKeywords: 10 },
      rankings: [
        { keyword: "crm", keywordSlug: "crm", appName: "App1", appSlug: "app1", isTracked: true, startPosition: 3, endPosition: 15, netChange: -12, bestPosition: 15 },
      ],
    }));
    expect(html).toContain("Biggest Drops");
  });

  it("shows competitor activity", () => {
    const html = buildWeeklyHtml(makeData({
      competitors: [{
        appName: "Rival", appSlug: "rival",
        startRating: "4.0", endRating: "4.3", ratingChange: 0.3,
        startReviews: 100, endReviews: 120, reviewsChange: 20,
      }],
    }));
    expect(html).toContain("Competitor Activity");
    expect(html).toContain("Rival");
  });
});

describe("buildWeeklySubject", () => {
  it("returns win subject for good week", () => {
    const subject = buildWeeklySubject(makeData({
      summary: { improved: 5, dropped: 1, unchanged: 4, totalKeywords: 10 },
    }));
    expect(subject).toContain("Great week");
    expect(subject).toContain("5 keywords improved");
  });

  it("returns alert subject for bad week", () => {
    const subject = buildWeeklySubject(makeData({
      summary: { improved: 0, dropped: 4, unchanged: 6, totalKeywords: 10 },
    }));
    expect(subject).toContain("alert");
    expect(subject).toContain("4 keywords dropped");
  });

  it("returns mixed subject", () => {
    const subject = buildWeeklySubject(makeData({
      summary: { improved: 2, dropped: 2, unchanged: 6, totalKeywords: 10 },
    }));
    expect(subject).toContain("2 up");
    expect(subject).toContain("2 down");
  });

  it("returns default subject for no changes", () => {
    const subject = buildWeeklySubject(makeData());
    expect(subject).toContain("Weekly Ranking Summary");
  });
});
