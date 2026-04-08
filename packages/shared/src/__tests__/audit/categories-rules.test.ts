import { describe, it, expect } from "vitest";
import { computeCategoriesSection } from "../../audit/rules/categories.js";

describe("computeCategoriesSection", () => {
  it("passes with multiple categories and features", () => {
    const snapshot = {
      categories: [{ name: "Marketing" }, { name: "Sales" }],
      platformData: { features: ["Email", "SMS", "Push", "Automation", "Segmentation"] },
      integrations: ["Klaviyo", "Mailchimp"],
    };
    const result = computeCategoriesSection(snapshot, {}, "shopify");
    expect(result.score).toBe(100);
  });

  it("fails with no categories", () => {
    const result = computeCategoriesSection({}, {}, "shopify");
    const countCheck = result.checks.find((c) => c.id === "cat-count");
    expect(countCheck?.status).toBe("fail");
  });

  it("warns with only 1 category", () => {
    const snapshot = { categories: [{ name: "Marketing" }] };
    const result = computeCategoriesSection(snapshot, {}, "shopify");
    const countCheck = result.checks.find((c) => c.id === "cat-count");
    expect(countCheck?.status).toBe("warning");
  });

  it("warns about no integrations", () => {
    const result = computeCategoriesSection({}, {}, "shopify");
    const intCheck = result.checks.find((c) => c.id === "cat-integrations");
    expect(intCheck?.status).toBe("warning");
  });

  it("warns about insufficient feature tags", () => {
    const snapshot = { platformData: { features: ["Email", "SMS"] } };
    const result = computeCategoriesSection(snapshot, {}, "shopify");
    const featCheck = result.checks.find((c) => c.id === "cat-features");
    expect(featCheck?.status).toBe("warning");
  });
});
