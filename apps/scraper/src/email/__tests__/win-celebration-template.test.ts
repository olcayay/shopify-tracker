import { describe, it, expect } from "vitest";
import { buildWinCelebrationHtml, buildWinCelebrationSubject } from "../win-celebration-template.js";
import type { WinCelebrationData } from "../win-celebration-template.js";

const baseData: WinCelebrationData = {
  accountName: "Acme Inc",
  appName: "OrderFlow Pro",
  appSlug: "orderflow-pro--12345",
  platform: "shopify",
  milestoneType: "top1",
  keyword: "order management",
};

describe("buildWinCelebrationHtml", () => {
  it("renders top1 milestone without undefined", () => {
    const html = buildWinCelebrationHtml(baseData);
    expect(html).not.toContain("undefined");
    expect(html).toContain("OrderFlow Pro");
    expect(html).toContain("Acme Inc");
    expect(html).toContain("#1");
    expect(html).toContain("order management");
  });

  it("renders top3 milestone", () => {
    const html = buildWinCelebrationHtml({ ...baseData, milestoneType: "top3", position: 2 });
    expect(html).not.toContain("undefined");
    expect(html).toContain("Top 3");
    expect(html).toContain("#2");
  });

  it("renders review_milestone", () => {
    const html = buildWinCelebrationHtml({ ...baseData, milestoneType: "review_milestone", reviewCount: 100 });
    expect(html).not.toContain("undefined");
    expect(html).toContain("100");
    expect(html).toContain("reviews");
  });

  it("renders rating_milestone", () => {
    const html = buildWinCelebrationHtml({ ...baseData, milestoneType: "rating_milestone", rating: 4.8 });
    expect(html).not.toContain("undefined");
    expect(html).toContain("4.8");
  });

  it("renders install_milestone", () => {
    const html = buildWinCelebrationHtml({ ...baseData, milestoneType: "install_milestone", installCount: 10000 });
    expect(html).not.toContain("undefined");
    // toLocaleString formatting varies by locale; just check the number is present
    expect(html).toMatch(/10[.,]000/);
  });

  it("handles underscore platform slug (google_workspace)", () => {
    const html = buildWinCelebrationHtml({ ...baseData, platform: "google_workspace" });
    expect(html).not.toContain("Google_workspace");
    expect(html).toContain("Google Workspace");
  });

  it("derives milestoneType from eventType when milestoneType is missing", () => {
    const data: any = { ...baseData, milestoneType: undefined, eventType: "ranking_top1" };
    const html = buildWinCelebrationHtml(data);
    expect(html).not.toContain("undefined");
    expect(html).toContain("#1");
  });

  it("falls back gracefully with minimal data", () => {
    const data: any = {
      appName: "TestApp",
      appSlug: "test-app",
      platform: "shopify",
      eventType: "ranking_top1",
    };
    const html = buildWinCelebrationHtml(data);
    expect(html).not.toContain("undefined");
    expect(html).toContain("TestApp");
  });

  it("uses appName as accountName fallback", () => {
    const data: any = { ...baseData, accountName: undefined };
    const html = buildWinCelebrationHtml(data);
    expect(html).not.toContain("undefined");
    // accountName falls back to appName
    expect(html).toContain("OrderFlow Pro");
  });
});

describe("buildWinCelebrationSubject", () => {
  it("generates correct subject for top1", () => {
    const subject = buildWinCelebrationSubject(baseData);
    expect(subject).toContain("[Shopify]");
    expect(subject).toContain("🏆");
    expect(subject).toContain("OrderFlow Pro");
    expect(subject).toContain("#1");
    expect(subject).not.toContain("undefined");
  });

  it("generates correct subject for top3", () => {
    const subject = buildWinCelebrationSubject({ ...baseData, milestoneType: "top3", position: 2 });
    expect(subject).toContain("🥇");
    expect(subject).toContain("#2");
  });

  it("generates correct subject for review_milestone", () => {
    const subject = buildWinCelebrationSubject({ ...baseData, milestoneType: "review_milestone", reviewCount: 100 });
    expect(subject).toContain("100 reviews");
  });

  it("generates correct subject for rating_milestone", () => {
    const subject = buildWinCelebrationSubject({ ...baseData, milestoneType: "rating_milestone", rating: 4.8 });
    expect(subject).toContain("4.8★");
  });

  it("generates correct subject for install_milestone", () => {
    const subject = buildWinCelebrationSubject({ ...baseData, milestoneType: "install_milestone", installCount: 10000 });
    expect(subject).toMatch(/10[.,]000/);
  });

  it("derives milestoneType from eventType when missing", () => {
    const data: any = { ...baseData, milestoneType: undefined, eventType: "ranking_top1" };
    const subject = buildWinCelebrationSubject(data);
    expect(subject).toContain("🏆");
    expect(subject).not.toContain("undefined");
  });

  it("handles underscore platform in subject prefix", () => {
    const subject = buildWinCelebrationSubject({ ...baseData, platform: "google_workspace" });
    expect(subject).toContain("[Google Workspace]");
    expect(subject).not.toContain("Google_workspace");
  });

  it("returns fallback subject for unknown milestoneType", () => {
    const data: any = { ...baseData, milestoneType: "unknown_type" };
    const subject = buildWinCelebrationSubject(data);
    expect(subject).toContain("milestone");
    expect(subject).not.toContain("undefined");
  });
});
