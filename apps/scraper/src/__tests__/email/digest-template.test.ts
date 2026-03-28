import { describe, it, expect } from "vitest";
import { buildDigestHtml, buildDigestSubject } from "../../email/digest-template.js";
import type { DigestData } from "../../email/digest-builder.js";

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    accountName: "Test Account",
    date: "03/28/2026",
    rankingChanges: [],
    competitorSummaries: [],
    summary: { improved: 0, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    ...overrides,
  };
}

describe("buildDigestHtml", () => {
  it("returns valid HTML with DOCTYPE", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });

  it("contains account name and date", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("Test Account");
    expect(html).toContain("03/28/2026");
  });

  it("shows 'No ranking changes today' when no changes", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("No ranking changes today");
  });

  it("shows improved/dropped/new counts in summary when present", () => {
    const html = buildDigestHtml(
      makeDigestData({
        summary: { improved: 3, dropped: 2, newEntries: 1, droppedOut: 0, unchanged: 5 },
      }),
    );
    expect(html).toContain("3 improved");
    expect(html).toContain("2 dropped");
    expect(html).toContain("1 new");
    expect(html).not.toContain("No ranking changes today");
  });

  it("renders ranking change rows with keyword and app name", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          {
            keyword: "crm tools",
            keywordSlug: "crm-tools",
            appName: "Super CRM",
            appSlug: "super-crm",
            isTracked: false,
            isCompetitor: false,
            yesterdayPosition: 5,
            todayPosition: 3,
            change: 2,
            type: "improved",
          },
        ],
        summary: { improved: 1, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
      }),
    );
    expect(html).toContain("crm tools");
    expect(html).toContain("Super CRM");
    expect(html).toContain("#5");
    expect(html).toContain("#3");
  });

  it("shows tracked badge for tracked apps", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          {
            keyword: "kw",
            keywordSlug: "kw",
            appName: "My App",
            appSlug: "my-app",
            isTracked: true,
            isCompetitor: false,
            yesterdayPosition: 2,
            todayPosition: 1,
            change: 1,
            type: "improved",
          },
        ],
      }),
    );
    expect(html).toContain("tracked");
    expect(html).not.toContain("competitor");
  });

  it("shows competitor badge for competitor apps", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          {
            keyword: "kw",
            keywordSlug: "kw",
            appName: "Rival App",
            appSlug: "rival",
            isTracked: false,
            isCompetitor: true,
            yesterdayPosition: 1,
            todayPosition: 3,
            change: -2,
            type: "dropped",
          },
        ],
      }),
    );
    expect(html).toContain("competitor");
  });

  it("shows correct change icons (▲ for improved, ▼ for dropped)", () => {
    const html = buildDigestHtml(
      makeDigestData({
        rankingChanges: [
          {
            keyword: "k1",
            keywordSlug: "k1",
            appName: "A1",
            appSlug: "a1",
            isTracked: false,
            isCompetitor: false,
            yesterdayPosition: 5,
            todayPosition: 2,
            change: 3,
            type: "improved",
          },
          {
            keyword: "k2",
            keywordSlug: "k2",
            appName: "A2",
            appSlug: "a2",
            isTracked: false,
            isCompetitor: false,
            yesterdayPosition: 2,
            todayPosition: 5,
            change: -3,
            type: "dropped",
          },
        ],
      }),
    );
    // ▲ = &#9650;, ▼ = &#9660;
    expect(html).toContain("&#9650;");
    expect(html).toContain("&#9660;");
  });

  it("renders competitor section when competitorSummaries provided", () => {
    const html = buildDigestHtml(
      makeDigestData({
        competitorSummaries: [
          {
            appName: "Competitor X",
            appSlug: "competitor-x",
            todayRating: "4.2",
            yesterdayRating: "4.1",
            ratingChange: 0.1,
            todayReviews: 150,
            yesterdayReviews: 148,
            reviewsChange: 2,
            keywordPositions: [
              { keyword: "analytics", position: 3, change: 1 },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("Competitor Overview");
    expect(html).toContain("Competitor X");
    expect(html).toContain("4.2");
    expect(html).toContain("150");
  });

  it("contains manage email preferences link", () => {
    const html = buildDigestHtml(makeDigestData());
    expect(html).toContain("Manage email preferences");
    expect(html).toContain("/settings");
  });
});

describe("buildDigestSubject", () => {
  it("returns 'Ranking Report {date}' with no changes", () => {
    const subject = buildDigestSubject(makeDigestData());
    expect(subject).toBe("Ranking Report 03/28/2026");
  });

  it("includes improved count", () => {
    const subject = buildDigestSubject(
      makeDigestData({ summary: { improved: 5, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 } }),
    );
    expect(subject).toContain("5 improved");
  });

  it("includes dropped count", () => {
    const subject = buildDigestSubject(
      makeDigestData({ summary: { improved: 0, dropped: 3, newEntries: 0, droppedOut: 0, unchanged: 0 } }),
    );
    expect(subject).toContain("3 dropped");
  });

  it("includes new entries count", () => {
    const subject = buildDigestSubject(
      makeDigestData({ summary: { improved: 0, dropped: 0, newEntries: 2, droppedOut: 0, unchanged: 0 } }),
    );
    expect(subject).toContain("2 new");
  });

  it("combines multiple change types with commas", () => {
    const subject = buildDigestSubject(
      makeDigestData({ summary: { improved: 3, dropped: 2, newEntries: 1, droppedOut: 0, unchanged: 0 } }),
    );
    expect(subject).toContain("3 improved, 2 dropped, 1 new");
  });
});
