import { describe, it, expect } from "vitest";
import { computeContentSection } from "../../audit/rules/content.js";

describe("computeContentSection", () => {
  it("scores well for a complete listing", () => {
    const snapshot = {
      appIntroduction: "A powerful email marketing platform that helps you grow your business with automated campaigns.",
      appDetails: "This app provides comprehensive email marketing tools including drag-and-drop editor, automated workflows, segmentation, A/B testing, and analytics dashboard. Perfect for e-commerce stores looking to boost revenue through targeted email campaigns and customer retention strategies.",
      features: ["Drag & drop editor", "Automated workflows", "Customer segmentation", "A/B testing", "Analytics"],
      seoTitle: "Best Email Marketing App for Shopify",
      seoMetaDescription: "Grow your store revenue with automated email campaigns, smart segmentation, and beautiful templates.",
      demoStoreUrl: "https://demo.example.com",
    };

    const result = computeContentSection(snapshot, {}, "shopify");
    expect(result.id).toBe("content");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("fails for a completely empty listing", () => {
    const result = computeContentSection({}, {}, "shopify");
    expect(result.score).toBeLessThan(50);

    const introCheck = result.checks.find((c) => c.id === "content-intro");
    expect(introCheck?.status).toBe("fail");

    const descCheck = result.checks.find((c) => c.id === "content-description");
    expect(descCheck?.status).toBe("fail");
  });

  it("warns about too-short introduction", () => {
    const snapshot = { appIntroduction: "Short" };
    const result = computeContentSection(snapshot, {}, "shopify");

    const introCheck = result.checks.find((c) => c.id === "content-intro");
    expect(introCheck?.status).toBe("warning");
    expect(introCheck?.detail).toContain("too short");
  });

  it("warns about insufficient features", () => {
    const snapshot = { features: ["Feature 1", "Feature 2"] };
    const result = computeContentSection(snapshot, {}, "shopify");

    const featCheck = result.checks.find((c) => c.id === "content-features");
    expect(featCheck?.status).toBe("fail");
  });

  it("passes feature clarity when all under limit", () => {
    const snapshot = { features: ["Short", "Also short", "Yep", "Fine", "Good"] };
    const result = computeContentSection(snapshot, {}, "shopify");

    const clarityCheck = result.checks.find((c) => c.id === "content-feature-clarity");
    expect(clarityCheck?.status).toBe("pass");
  });

  it("skips SEO checks for platforms with 0 SEO limits", () => {
    const result = computeContentSection({}, {}, "wordpress"); // seoTitle: 0
    const seoCheck = result.checks.find((c) => c.id === "content-seo-title");
    expect(seoCheck).toBeUndefined();
  });

  it("warns about missing demo store", () => {
    const result = computeContentSection({}, {}, "shopify");
    const demoCheck = result.checks.find((c) => c.id === "content-demo");
    expect(demoCheck?.status).toBe("warning");
  });
});
