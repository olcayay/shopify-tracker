import { describe, it, expect } from "vitest";
import {
  stripCorporateSuffix,
  developerNameToSlug,
  normalizeDeveloperName,
} from "../developer-name.js";

describe("stripCorporateSuffix", () => {
  it("strips common English suffixes", () => {
    expect(stripCorporateSuffix("Acme Inc")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Inc.")).toBe("Acme");
    expect(stripCorporateSuffix("Acme LLC")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Ltd")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Ltd.")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Corp")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Corporation")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Co")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Limited")).toBe("Acme");
  });

  it("strips German suffixes", () => {
    expect(stripCorporateSuffix("Acme GmbH")).toBe("Acme");
    expect(stripCorporateSuffix("Acme AG")).toBe("Acme");
    expect(stripCorporateSuffix("Acme UG")).toBe("Acme");
  });

  it("strips Turkish suffixes", () => {
    expect(stripCorporateSuffix("Jotform A.Ş.")).toBe("Jotform");
    expect(stripCorporateSuffix("Jotform AŞ")).toBe("Jotform");
    expect(stripCorporateSuffix("Jotform A.S.")).toBe("Jotform");
  });

  it("strips French suffixes", () => {
    expect(stripCorporateSuffix("Acme SAS")).toBe("Acme");
    expect(stripCorporateSuffix("Acme SARL")).toBe("Acme");
  });

  it("strips Dutch suffixes", () => {
    expect(stripCorporateSuffix("Acme BV")).toBe("Acme");
    expect(stripCorporateSuffix("Acme NV")).toBe("Acme");
  });

  it("strips comma-separated suffixes", () => {
    expect(stripCorporateSuffix("Acme, Inc")).toBe("Acme");
    expect(stripCorporateSuffix("Acme, Inc.")).toBe("Acme");
    expect(stripCorporateSuffix("Acme, LLC")).toBe("Acme");
  });

  it("strips multiple stacked suffixes", () => {
    expect(stripCorporateSuffix("Acme Ltd Inc")).toBe("Acme");
    expect(stripCorporateSuffix("Acme Pvt Ltd")).toBe("Acme");
  });

  it("preserves names without suffixes", () => {
    expect(stripCorporateSuffix("Jotform")).toBe("Jotform");
    expect(stripCorporateSuffix("Bold Commerce")).toBe("Bold Commerce");
    expect(stripCorporateSuffix("PageFly")).toBe("PageFly");
  });

  it("handles edge cases", () => {
    expect(stripCorporateSuffix("  Acme Inc  ")).toBe("Acme");
    expect(stripCorporateSuffix("Acme")).toBe("Acme");
  });
});

describe("developerNameToSlug", () => {
  it("produces clean slugs from simple names", () => {
    expect(developerNameToSlug("Jotform")).toBe("jotform");
    expect(developerNameToSlug("Bold Commerce")).toBe("bold-commerce");
    expect(developerNameToSlug("PageFly")).toBe("pagefly");
  });

  it("strips suffixes before slugifying", () => {
    expect(developerNameToSlug("Jotform A.Ş.")).toBe("jotform");
    expect(developerNameToSlug("Acme Inc")).toBe("acme");
    expect(developerNameToSlug("Bold Commerce Ltd")).toBe("bold-commerce");
  });

  it("handles special characters", () => {
    expect(developerNameToSlug("O'Brien & Associates")).toBe(
      "o-brien-associates"
    );
    expect(developerNameToSlug("Über Apps")).toBe("ber-apps");
  });

  it("collapses multiple hyphens", () => {
    expect(developerNameToSlug("Acme -- Test")).toBe("acme-test");
    expect(developerNameToSlug("Acme   Corp")).toBe("acme");
  });

  it("trims leading/trailing hyphens", () => {
    expect(developerNameToSlug("-Acme-")).toBe("acme");
    expect(developerNameToSlug("  Acme  ")).toBe("acme");
  });
});

describe("normalizeDeveloperName", () => {
  it("strips suffixes and preserves casing", () => {
    expect(normalizeDeveloperName("Jotform A.Ş.")).toBe("Jotform");
    expect(normalizeDeveloperName("Bold Commerce Inc")).toBe("Bold Commerce");
    expect(normalizeDeveloperName("Acme, LLC")).toBe("Acme");
  });

  it("trims whitespace", () => {
    expect(normalizeDeveloperName("  Jotform Inc  ")).toBe("Jotform");
  });

  it("preserves names without suffixes", () => {
    expect(normalizeDeveloperName("PageFly")).toBe("PageFly");
    expect(normalizeDeveloperName("Shopify")).toBe("Shopify");
  });
});
