import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  updateProjectSchema,
  addKeywordSchema,
  addCompetitorSchema,
  createVirtualAppSchema,
  addCategoryFeatureSchema,
  removeCategoryFeatureSchema,
  addFeatureSchema,
  addIntegrationSchema,
} from "../../schemas/research.js";

describe("createProjectSchema", () => {
  it("accepts optional name", () => {
    const result = createProjectSchema.parse({});
    expect(result.name).toBeUndefined();
  });

  it("accepts valid name", () => {
    const result = createProjectSchema.parse({ name: "My Project" });
    expect(result.name).toBe("My Project");
  });

  it("rejects name over 200 chars", () => {
    expect(() => createProjectSchema.parse({ name: "x".repeat(201) })).toThrow();
  });
});

describe("updateProjectSchema", () => {
  it("accepts valid name", () => {
    expect(updateProjectSchema.parse({ name: "Updated" }).name).toBe("Updated");
  });

  it("trims whitespace", () => {
    expect(updateProjectSchema.parse({ name: "  Updated  " }).name).toBe("Updated");
  });

  it("rejects empty name", () => {
    expect(() => updateProjectSchema.parse({ name: "" })).toThrow();
  });

  it("rejects whitespace-only name (after trim)", () => {
    expect(() => updateProjectSchema.parse({ name: "   " })).toThrow();
  });
});

describe("addKeywordSchema", () => {
  it("accepts valid keyword", () => {
    expect(addKeywordSchema.parse({ keyword: "test" }).keyword).toBe("test");
  });

  it("trims whitespace", () => {
    expect(addKeywordSchema.parse({ keyword: "  test  " }).keyword).toBe("test");
  });

  it("rejects empty keyword", () => {
    expect(() => addKeywordSchema.parse({ keyword: "" })).toThrow();
  });
});

describe("research addCompetitorSchema", () => {
  it("accepts valid slug", () => {
    expect(addCompetitorSchema.parse({ slug: "my-app" }).slug).toBe("my-app");
  });

  it("trims whitespace", () => {
    expect(addCompetitorSchema.parse({ slug: "  my-app  " }).slug).toBe("my-app");
  });

  it("rejects empty slug", () => {
    expect(() => addCompetitorSchema.parse({ slug: "" })).toThrow();
  });
});

describe("createVirtualAppSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(() => createVirtualAppSchema.parse({})).not.toThrow();
  });

  it("accepts full virtual app data", () => {
    const result = createVirtualAppSchema.parse({
      name: "My App",
      icon: "star",
      color: "blue",
      appCardSubtitle: "Best app ever",
      features: ["Feature A", "Feature B"],
      integrations: ["Slack"],
      languages: ["en", "de"],
    });
    expect(result.name).toBe("My App");
    expect(result.features).toHaveLength(2);
  });

  it("rejects name over 200 chars", () => {
    expect(() => createVirtualAppSchema.parse({ name: "x".repeat(201) })).toThrow();
  });

  it("rejects icon over 10 chars", () => {
    expect(() => createVirtualAppSchema.parse({ icon: "x".repeat(11) })).toThrow();
  });

  it("passes through unknown fields", () => {
    const result = createVirtualAppSchema.parse({ unknownField: "value" });
    expect((result as any).unknownField).toBe("value");
  });

  it("accepts categories as array of record objects", () => {
    const result = createVirtualAppSchema.parse({
      categories: [{ title: "Marketing", slug: "marketing" }],
    });
    expect(result.categories).toEqual([{ title: "Marketing", slug: "marketing" }]);
  });

  it("accepts pricingPlans as array of record objects", () => {
    const result = createVirtualAppSchema.parse({
      pricingPlans: [{ name: "Basic", price: "9.99" }],
    });
    expect(result.pricingPlans).toEqual([{ name: "Basic", price: "9.99" }]);
  });

  it("rejects categories with non-object items", () => {
    expect(() => createVirtualAppSchema.parse({ categories: ["string-item"] })).toThrow();
  });

  it("rejects pricingPlans with non-object items", () => {
    expect(() => createVirtualAppSchema.parse({ pricingPlans: [42] })).toThrow();
  });
});

describe("addCategoryFeatureSchema", () => {
  const valid = {
    categoryTitle: "Marketing",
    subcategoryTitle: "SEO",
    featureTitle: "Backlink Checker",
    featureHandle: "backlink-checker",
  };

  it("accepts valid data", () => {
    expect(() => addCategoryFeatureSchema.parse(valid)).not.toThrow();
  });

  it("accepts optional featureUrl", () => {
    const result = addCategoryFeatureSchema.parse({ ...valid, featureUrl: "https://example.com" });
    expect(result.featureUrl).toBe("https://example.com");
  });

  it("rejects missing categoryTitle", () => {
    const { categoryTitle, ...rest } = valid;
    expect(() => addCategoryFeatureSchema.parse(rest)).toThrow();
  });

  it("rejects empty featureHandle", () => {
    expect(() => addCategoryFeatureSchema.parse({ ...valid, featureHandle: "" })).toThrow();
  });
});

describe("removeCategoryFeatureSchema", () => {
  it("accepts valid data", () => {
    expect(() =>
      removeCategoryFeatureSchema.parse({
        categoryTitle: "Marketing",
        subcategoryTitle: "SEO",
        featureHandle: "backlink-checker",
      })
    ).not.toThrow();
  });

  it("rejects missing featureHandle", () => {
    expect(() =>
      removeCategoryFeatureSchema.parse({
        categoryTitle: "Marketing",
        subcategoryTitle: "SEO",
      })
    ).toThrow();
  });
});

describe("addFeatureSchema", () => {
  it("accepts valid feature", () => {
    expect(addFeatureSchema.parse({ feature: "Dark mode" }).feature).toBe("Dark mode");
  });

  it("rejects empty feature", () => {
    expect(() => addFeatureSchema.parse({ feature: "" })).toThrow();
  });

  it("rejects feature over 500 chars", () => {
    expect(() => addFeatureSchema.parse({ feature: "x".repeat(501) })).toThrow();
  });
});

describe("addIntegrationSchema", () => {
  it("accepts valid integration", () => {
    expect(addIntegrationSchema.parse({ integration: "Slack" }).integration).toBe("Slack");
  });

  it("rejects empty integration", () => {
    expect(() => addIntegrationSchema.parse({ integration: "" })).toThrow();
  });
});
