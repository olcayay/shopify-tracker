import { describe, it, expect } from "vitest";
import { buildRankingAlertSubject, buildRankingAlertHtml, type RankingAlertData } from "../ranking-alert-template.js";

function makeAlertData(overrides: Partial<RankingAlertData> = {}): RankingAlertData {
  return {
    accountName: "Test Account",
    appName: "AKEYI Forms",
    appSlug: "akeyi-forms",
    platform: "shopify",
    alertType: "significant_change",
    keyword: "form builder",
    keywordSlug: "form-builder",
    previousPosition: 10,
    currentPosition: 5,
    change: 5,
    ...overrides,
  };
}

describe("buildRankingAlertSubject", () => {
  it("uses keyword for regular ranking changes", () => {
    const subject = buildRankingAlertSubject(makeAlertData());
    expect(subject).toContain("form builder");
    expect(subject).not.toContain("undefined");
  });

  it("uses categoryName when keyword is undefined (category_change)", () => {
    const subject = buildRankingAlertSubject(makeAlertData({
      keyword: undefined as any,
      categoryName: "workflow-automation",
      alertType: "significant_change",
      change: -255,
    }));
    expect(subject).toContain("workflow-automation");
    expect(subject).not.toContain("undefined");
  });

  it("uses categoryName when keyword is empty string", () => {
    const subject = buildRankingAlertSubject(makeAlertData({
      keyword: "",
      categoryName: "marketing",
    }));
    expect(subject).toContain("marketing");
    expect(subject).not.toContain('""');
  });

  it("shows aggregated subject for multiple changes", () => {
    const subject = buildRankingAlertSubject(makeAlertData({
      otherChanges: [
        { keyword: "crm", position: 3, change: 2 },
        { keyword: "email", position: 7, change: -1 },
      ],
    }));
    expect(subject).toContain("3 ranking changes");
    expect(subject).toContain("AKEYI Forms");
  });

  it("handles top3_entry with category change", () => {
    const subject = buildRankingAlertSubject(makeAlertData({
      alertType: "top3_entry",
      keyword: undefined as any,
      categoryName: "analytics",
      currentPosition: 2,
    }));
    expect(subject).toContain("analytics");
    expect(subject).toContain("#2");
    expect(subject).not.toContain("undefined");
  });
});

describe("buildRankingAlertHtml", () => {
  it("does not contain 'undefined' for category change events", () => {
    const html = buildRankingAlertHtml(makeAlertData({
      keyword: undefined as any,
      categoryName: "workflow-automation",
      keywordSlug: "workflow-automation",
    }));
    expect(html).not.toContain('"undefined"');
    expect(html).toContain("workflow-automation");
  });

  it("CTA link uses categories path for category changes", () => {
    const html = buildRankingAlertHtml(makeAlertData({
      keyword: undefined as any,
      categoryName: "marketing",
      keywordSlug: "marketing",
    }));
    expect(html).toContain("/shopify/categories/marketing");
    expect(html).not.toContain("/shopify/keywords/undefined");
  });

  it("CTA link uses keywords path for keyword changes", () => {
    const html = buildRankingAlertHtml(makeAlertData());
    expect(html).toContain("/shopify/keywords/form-builder");
  });
});
