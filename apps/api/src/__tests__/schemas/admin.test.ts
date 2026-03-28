import { describe, it, expect } from "vitest";
import {
  addTrackedAppSchema,
  addTrackedKeywordSchema,
  triggerScraperSchema,
} from "../../schemas/admin.js";

describe("admin addTrackedAppSchema", () => {
  it("accepts valid slug", () => {
    expect(addTrackedAppSchema.parse({ slug: "my-app" }).slug).toBe("my-app");
  });

  it("trims whitespace", () => {
    expect(addTrackedAppSchema.parse({ slug: "  my-app  " }).slug).toBe("my-app");
  });

  it("rejects empty slug", () => {
    expect(() => addTrackedAppSchema.parse({ slug: "" })).toThrow();
  });

  it("rejects whitespace-only slug (after trim)", () => {
    expect(() => addTrackedAppSchema.parse({ slug: "   " })).toThrow();
  });

  it("rejects slug over 200 chars", () => {
    expect(() => addTrackedAppSchema.parse({ slug: "x".repeat(201) })).toThrow();
  });
});

describe("admin addTrackedKeywordSchema", () => {
  it("accepts valid keyword", () => {
    expect(addTrackedKeywordSchema.parse({ keyword: "seo tools" }).keyword).toBe("seo tools");
  });

  it("trims whitespace", () => {
    expect(addTrackedKeywordSchema.parse({ keyword: "  seo  " }).keyword).toBe("seo");
  });

  it("rejects empty keyword", () => {
    expect(() => addTrackedKeywordSchema.parse({ keyword: "" })).toThrow();
  });
});

describe("triggerScraperSchema", () => {
  it("accepts valid type: category", () => {
    expect(triggerScraperSchema.parse({ type: "category" }).type).toBe("category");
  });

  it("accepts valid type: app_details", () => {
    expect(triggerScraperSchema.parse({ type: "app_details" }).type).toBe("app_details");
  });

  it("accepts valid type: keyword_search", () => {
    expect(triggerScraperSchema.parse({ type: "keyword_search" }).type).toBe("keyword_search");
  });

  it("accepts valid type: reviews", () => {
    expect(triggerScraperSchema.parse({ type: "reviews" }).type).toBe("reviews");
  });

  it("accepts optional platform", () => {
    const result = triggerScraperSchema.parse({ type: "category", platform: "shopify" });
    expect(result.platform).toBe("shopify");
  });

  it("rejects invalid type", () => {
    expect(() => triggerScraperSchema.parse({ type: "invalid" })).toThrow(/must be one of/);
  });

  it("rejects empty type", () => {
    expect(() => triggerScraperSchema.parse({ type: "" })).toThrow();
  });
});
