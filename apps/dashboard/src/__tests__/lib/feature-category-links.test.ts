import { describe, expect, it } from "vitest";
import {
  buildFeatureCategoryPath,
  buildFeatureSubcategoryPath,
} from "@/lib/feature-category-links";

describe("feature category links", () => {
  it("builds category links with the platform prefix", () => {
    expect(buildFeatureCategoryPath("shopify", "Real Time Messaging"))
      .toBe("/shopify/features/categories/real-time-messaging");
  });

  it("builds subcategory links with the platform prefix and query params", () => {
    expect(buildFeatureSubcategoryPath("shopify", "Chat", "Live Chat"))
      .toBe("/shopify/features/category?category=Chat&subcategory=Live+Chat");
  });
});
