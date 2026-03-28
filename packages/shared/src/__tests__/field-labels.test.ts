import { describe, it, expect } from "vitest";
import { getFieldLabels } from "../constants/field-labels";
import { PLATFORM_IDS } from "../constants/platforms";

describe("getFieldLabels", () => {
  it("returns default labels for shopify", () => {
    const labels = getFieldLabels("shopify");
    expect(labels.appIntroduction).toBe("Introduction");
    expect(labels.appDetails).toBe("Details");
    expect(labels.appCardSubtitle).toBe("Subtitle");
  });

  it("returns overridden labels for canva", () => {
    const labels = getFieldLabels("canva");
    expect(labels.appIntroduction).toBe("Short Description");
    expect(labels.appDetails).toBe("Description");
    expect(labels.appCardSubtitle).toBe("Tagline");
  });

  it("returns overridden labels for atlassian", () => {
    const labels = getFieldLabels("atlassian");
    expect(labels.appIntroduction).toBe("Summary");
    expect(labels.appDetails).toBe("Description");
    expect(labels.appCardSubtitle).toBe("Tag Line");
  });

  it("returns all required fields for every platform", () => {
    const requiredFields = [
      "name", "appIntroduction", "appDetails", "features",
      "pricingPlans", "seoTitle", "seoMetaDescription", "appCardSubtitle",
    ];
    for (const platform of PLATFORM_IDS) {
      const labels = getFieldLabels(platform);
      for (const field of requiredFields) {
        expect(labels[field as keyof typeof labels], `${platform}.${field}`).toBeTruthy();
      }
    }
  });

  it("returns defaults for unknown platform", () => {
    const labels = getFieldLabels("unknown");
    expect(labels.appIntroduction).toBe("Introduction");
    expect(labels.appDetails).toBe("Details");
  });
});
