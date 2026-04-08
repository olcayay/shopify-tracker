import { describe, it, expect } from "vitest";
import {
  computeAudit,
  computeSectionScore,
  computeOverallScore,
  collectRecommendations,
  DEFAULT_SECTION_WEIGHTS,
} from "../../audit/index.js";
import type { AuditCheck, AuditSection } from "../../audit/types.js";

describe("computeSectionScore", () => {
  it("returns 100 for all passing checks", () => {
    const checks: AuditCheck[] = [
      { id: "a", label: "A", status: "pass", detail: "ok" },
      { id: "b", label: "B", status: "pass", detail: "ok" },
    ];
    expect(computeSectionScore(checks)).toBe(100);
  });

  it("returns 0 for all failing checks", () => {
    const checks: AuditCheck[] = [
      { id: "a", label: "A", status: "fail", detail: "bad" },
      { id: "b", label: "B", status: "fail", detail: "bad" },
    ];
    expect(computeSectionScore(checks)).toBe(0);
  });

  it("returns 50 for all warning checks", () => {
    const checks: AuditCheck[] = [
      { id: "a", label: "A", status: "warning", detail: "meh" },
      { id: "b", label: "B", status: "warning", detail: "meh" },
    ];
    expect(computeSectionScore(checks)).toBe(50);
  });

  it("computes mixed scores correctly", () => {
    const checks: AuditCheck[] = [
      { id: "a", label: "A", status: "pass", detail: "ok" },     // 100
      { id: "b", label: "B", status: "warning", detail: "meh" }, // 50
      { id: "c", label: "C", status: "fail", detail: "bad" },    // 0
    ];
    // (100 + 50 + 0) / 3 = 50
    expect(computeSectionScore(checks)).toBe(50);
  });

  it("returns 0 for empty checks", () => {
    expect(computeSectionScore([])).toBe(0);
  });
});

describe("computeOverallScore", () => {
  it("computes weighted average of section scores", () => {
    const sections: AuditSection[] = [
      { id: "title", name: "Title", icon: "T", score: 100, checks: [] },
      { id: "content", name: "Content", icon: "C", score: 80, checks: [] },
      { id: "visuals", name: "Visuals", icon: "V", score: 60, checks: [] },
      { id: "categories", name: "Categories", icon: "Ca", score: 40, checks: [] },
      { id: "technical", name: "Technical", icon: "Te", score: 20, checks: [] },
      { id: "languages", name: "Languages", icon: "L", score: 0, checks: [] },
    ];
    // 100*0.15 + 80*0.25 + 60*0.20 + 40*0.15 + 20*0.15 + 0*0.10 = 15+20+12+6+3+0 = 56
    expect(computeOverallScore(sections, DEFAULT_SECTION_WEIGHTS)).toBe(56);
  });

  it("returns 0 for no sections", () => {
    expect(computeOverallScore([])).toBe(0);
  });

  it("returns 100 when all sections score 100", () => {
    const sections: AuditSection[] = [
      { id: "title", name: "Title", icon: "T", score: 100, checks: [] },
      { id: "content", name: "Content", icon: "C", score: 100, checks: [] },
      { id: "visuals", name: "Visuals", icon: "V", score: 100, checks: [] },
      { id: "categories", name: "Categories", icon: "Ca", score: 100, checks: [] },
      { id: "technical", name: "Technical", icon: "Te", score: 100, checks: [] },
      { id: "languages", name: "Languages", icon: "L", score: 100, checks: [] },
    ];
    expect(computeOverallScore(sections)).toBe(100);
  });
});

describe("collectRecommendations", () => {
  it("collects recommendations from warning/fail checks", () => {
    const sections: AuditSection[] = [
      {
        id: "title",
        name: "Title",
        icon: "T",
        score: 50,
        checks: [
          { id: "a", label: "Title Length", status: "warning", detail: "too short", recommendation: "Make title longer" },
          { id: "b", label: "Keywords", status: "pass", detail: "ok" },
        ],
      },
      {
        id: "content",
        name: "Content",
        icon: "C",
        score: 0,
        checks: [
          { id: "c", label: "Description", status: "fail", detail: "missing", recommendation: "Add description", impact: "high" },
        ],
      },
    ];

    const recs = collectRecommendations(sections);
    expect(recs).toHaveLength(2);
    // High impact first
    expect(recs[0].title).toBe("Description");
    expect(recs[0].impact).toBe("high");
    expect(recs[0].index).toBe(1);
    expect(recs[1].title).toBe("Title Length");
    expect(recs[1].impact).toBe("medium");
    expect(recs[1].index).toBe(2);
  });

  it("returns empty array when all checks pass", () => {
    const sections: AuditSection[] = [
      {
        id: "title",
        name: "Title",
        icon: "T",
        score: 100,
        checks: [{ id: "a", label: "A", status: "pass", detail: "ok" }],
      },
    ];
    expect(collectRecommendations(sections)).toHaveLength(0);
  });

  it("skips checks without recommendations", () => {
    const sections: AuditSection[] = [
      {
        id: "title",
        name: "Title",
        icon: "T",
        score: 0,
        checks: [{ id: "a", label: "A", status: "fail", detail: "bad" }],
      },
    ];
    expect(collectRecommendations(sections)).toHaveLength(0);
  });
});

describe("DEFAULT_SECTION_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(DEFAULT_SECTION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it("has all 6 sections", () => {
    expect(Object.keys(DEFAULT_SECTION_WEIGHTS)).toHaveLength(6);
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("title");
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("content");
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("visuals");
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("categories");
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("technical");
    expect(DEFAULT_SECTION_WEIGHTS).toHaveProperty("languages");
  });
});

describe("computeAudit", () => {
  it("produces valid report structure with mock data", () => {
    const snapshot = {
      appIntroduction: "Test intro",
      appDetails: "Test details",
      features: ["Feature 1", "Feature 2"],
      screenshots: ["s1.png", "s2.png"],
      languages: ["English"],
      categories: [{ name: "Tools" }],
      support: { privacy: "https://example.com/privacy" },
      pricingPlans: [{ name: "Free" }],
    };
    const app = {
      name: "Test App",
      slug: "test-app",
      iconUrl: "https://example.com/icon.png",
      averageRating: 4.5,
      ratingCount: 100,
      pricingHint: "Free plan available",
    };

    const report = computeAudit(snapshot, app, "shopify");

    expect(report).toHaveProperty("overallScore");
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);

    expect(report.sections).toHaveLength(6);
    for (const section of report.sections) {
      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("name");
      expect(section).toHaveProperty("icon");
      expect(section).toHaveProperty("score");
      expect(section).toHaveProperty("checks");
      expect(section.score).toBeGreaterThanOrEqual(0);
      expect(section.score).toBeLessThanOrEqual(100);
    }

    expect(report.recommendations).toBeInstanceOf(Array);

    expect(report.app.name).toBe("Test App");
    expect(report.app.slug).toBe("test-app");
    expect(report.app.platform).toBe("shopify");
    expect(report.app.iconUrl).toBe("https://example.com/icon.png");

    expect(report.generatedAt).toBeTruthy();
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN();
  });

  it("handles empty/null app and snapshot", () => {
    const report = computeAudit(null, null, "shopify");
    expect(report.sections).toHaveLength(6);
    expect(report.app.name).toBe("");
    expect(report.app.platform).toBe("shopify");
  });
});
