import { describe, it, expect } from "vitest";
import { buildRankingAlertHtml, buildRankingAlertSubject, type RankingAlertData } from "../../email/ranking-alert-template.js";
import { buildCompetitorAlertHtml, buildCompetitorAlertSubject, type CompetitorAlertData } from "../../email/competitor-alert-template.js";

function rankingData(overrides: Partial<RankingAlertData> = {}): RankingAlertData {
  return {
    accountName: "Test Account",
    appName: "MyApp",
    appSlug: "my-app",
    platform: "shopify",
    alertType: "top3_entry",
    keyword: "email marketing",
    keywordSlug: "email-marketing",
    previousPosition: 5,
    currentPosition: 2,
    change: 3,
    ...overrides,
  };
}

function competitorData(overrides: Partial<CompetitorAlertData> = {}): CompetitorAlertData {
  return {
    accountName: "Test Account",
    trackedAppName: "MyApp",
    trackedAppSlug: "my-app",
    platform: "shopify",
    alertType: "overtook",
    competitorName: "RivalApp",
    competitorSlug: "rival-app",
    keyword: "crm",
    keywordSlug: "crm",
    details: { competitorPosition: 2, yourPosition: 3 },
    ...overrides,
  };
}

describe("Ranking Alert", () => {
  it("buildRankingAlertHtml returns valid HTML for top3_entry", () => {
    const html = buildRankingAlertHtml(rankingData());
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("MyApp");
    expect(html).toContain("email marketing");
    expect(html).toContain("#2");
    expect(html).toContain("Ranking Alert");
  });

  it("buildRankingAlertHtml handles dropped_out", () => {
    const html = buildRankingAlertHtml(rankingData({ alertType: "dropped_out", currentPosition: null }));
    expect(html).toContain("dropped out");
  });

  it("buildRankingAlertHtml includes insight for top3_entry", () => {
    const html = buildRankingAlertHtml(rankingData());
    expect(html).toContain("Insight");
    expect(html).toContain("maintaining");
  });

  it("buildRankingAlertHtml renders other changes when provided", () => {
    const html = buildRankingAlertHtml(rankingData({
      otherChanges: [
        { keyword: "crm tools", position: 5, change: 2 },
        { keyword: "sales app", position: 8, change: -1 },
      ],
    }));
    expect(html).toContain("crm tools");
    expect(html).toContain("sales app");
  });

  it("buildRankingAlertSubject generates correct subject per type", () => {
    expect(buildRankingAlertSubject(rankingData())).toContain("reached #2");
    expect(buildRankingAlertSubject(rankingData({ alertType: "top3_exit" }))).toContain("dropped out of Top 3");
    expect(buildRankingAlertSubject(rankingData({ alertType: "new_entry" }))).toContain("appeared at #2");
    expect(buildRankingAlertSubject(rankingData({ alertType: "dropped_out" }))).toContain("dropped out of rankings");
  });

  it("buildRankingAlertHtml includes CTA with keyword link", () => {
    const html = buildRankingAlertHtml(rankingData());
    expect(html).toContain("/shopify/keywords/email-marketing");
    expect(html).toContain("View Full Rankings");
  });
});

describe("Competitor Alert", () => {
  it("buildCompetitorAlertHtml returns valid HTML for overtook", () => {
    const html = buildCompetitorAlertHtml(competitorData());
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("RivalApp");
    expect(html).toContain("overtook");
    expect(html).toContain("Competitor Alert");
  });

  it("buildCompetitorAlertHtml handles pricing_change", () => {
    const html = buildCompetitorAlertHtml(competitorData({
      alertType: "pricing_change",
      details: { pricingChange: "$9.99 → $14.99/mo" },
    }));
    expect(html).toContain("pricing");
    expect(html).toContain("RivalApp");
  });

  it("buildCompetitorAlertHtml handles review_surge", () => {
    const html = buildCompetitorAlertHtml(competitorData({
      alertType: "review_surge",
      details: { reviewCount: 25 },
    }));
    expect(html).toContain("25");
    expect(html).toContain("review");
  });

  it("buildCompetitorAlertSubject generates correct subject per type", () => {
    expect(buildCompetitorAlertSubject(competitorData())).toContain("overtook");
    expect(buildCompetitorAlertSubject(competitorData({ alertType: "pricing_change" }))).toContain("pricing");
    expect(buildCompetitorAlertSubject(competitorData({ alertType: "review_surge", details: { reviewCount: 15 } }))).toContain("15 new reviews");
    expect(buildCompetitorAlertSubject(competitorData({ alertType: "featured", details: { featuredSurface: "Homepage" } }))).toContain("featured");
  });

  it("buildCompetitorAlertHtml includes insight and CTA", () => {
    const html = buildCompetitorAlertHtml(competitorData());
    expect(html).toContain("Insight");
    expect(html).toContain("View Competitor Details");
    expect(html).toContain("/shopify/apps/rival-app");
  });
});
