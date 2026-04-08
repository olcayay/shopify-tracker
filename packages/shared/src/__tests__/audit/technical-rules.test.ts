import { describe, it, expect } from "vitest";
import { computeTechnicalSection } from "../../audit/rules/technical.js";

describe("computeTechnicalSection", () => {
  it("scores well with full support info", () => {
    const snapshot = {
      demoStoreUrl: "https://demo.example.com",
      support: { privacy: "https://privacy.com", faq: "https://faq.com", docs: "https://docs.com", tutorial: "https://tutorial.com" },
      pricingPlans: [{ name: "Free", description: "Basic plan", features: ["feature1"] }],
    };
    const app = { isBuiltForShopify: true };

    const result = computeTechnicalSection(snapshot, app, "shopify");
    expect(result.score).toBe(100);
  });

  it("warns about missing support fields", () => {
    const result = computeTechnicalSection({}, {}, "shopify");

    const privacyCheck = result.checks.find((c) => c.id === "tech-privacy");
    expect(privacyCheck?.status).toBe("fail");

    const faqCheck = result.checks.find((c) => c.id === "tech-faq");
    expect(faqCheck?.status).toBe("warning");

    const docsCheck = result.checks.find((c) => c.id === "tech-docs");
    expect(docsCheck?.status).toBe("warning");
  });

  it("includes Built for Shopify check only for shopify", () => {
    const shopifyResult = computeTechnicalSection({}, {}, "shopify");
    const bfsCheck = shopifyResult.checks.find((c) => c.id === "tech-bfs");
    expect(bfsCheck).toBeDefined();

    const canvaResult = computeTechnicalSection({}, {}, "canva");
    const canvaBfs = canvaResult.checks.find((c) => c.id === "tech-bfs");
    expect(canvaBfs).toBeUndefined();
  });

  it("passes pricing check with detailed plans", () => {
    const snapshot = {
      pricingPlans: [{ name: "Pro", price: "$9.99/mo", description: "All features" }],
    };
    const result = computeTechnicalSection(snapshot, {}, "shopify");
    const pricingCheck = result.checks.find((c) => c.id === "tech-pricing");
    expect(pricingCheck?.status).toBe("pass");
  });

  it("warns about pricing plans without details", () => {
    const snapshot = { pricingPlans: [{ name: "Basic" }] };
    const result = computeTechnicalSection(snapshot, {}, "shopify");
    const pricingCheck = result.checks.find((c) => c.id === "tech-pricing");
    expect(pricingCheck?.status).toBe("warning");
  });
});
