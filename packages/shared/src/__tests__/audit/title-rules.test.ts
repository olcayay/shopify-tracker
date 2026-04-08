import { describe, it, expect } from "vitest";
import { computeTitleSection } from "../../audit/rules/title.js";

describe("computeTitleSection", () => {
  it("scores well for an optimal title", () => {
    const app = { name: "Privy — Pop Ups, Email, & SMS" };
    const result = computeTitleSection({}, app, "shopify");

    expect(result.id).toBe("title");
    expect(result.score).toBeGreaterThanOrEqual(75);

    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).toBe("pass");

    const keywordCheck = result.checks.find((c) => c.id === "title-keywords");
    expect(keywordCheck?.status).toBe("pass");

    const separatorCheck = result.checks.find((c) => c.id === "title-separator");
    expect(separatorCheck?.status).toBe("pass");
  });

  it("warns about too-short title", () => {
    const app = { name: "Foo" };
    const result = computeTitleSection({}, app, "shopify");

    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).toBe("warning");
    expect(lengthCheck?.detail).toContain("under 50%");
  });

  it("fails for missing title", () => {
    const result = computeTitleSection({}, {}, "shopify");

    expect(result.score).toBe(0);
    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).toBe("fail");
    expect(lengthCheck?.recommendation).toBeTruthy();
  });

  it("fails for title with no keywords", () => {
    const app = { name: "An" };
    const result = computeTitleSection({}, app, "shopify");

    const keywordCheck = result.checks.find((c) => c.id === "title-keywords");
    expect(keywordCheck?.status).toBe("fail");
  });

  it("warns about title over character limit", () => {
    const app = { name: "This Is A Very Long App Title That Exceeds Limits" };
    const result = computeTitleSection({}, app, "shopify"); // shopify limit is 30

    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).toBe("warning");
    expect(lengthCheck?.detail).toContain("over limit");
  });

  it("detects brand-first pattern", () => {
    const app = { name: "Klaviyo: Email Marketing" };
    const result = computeTitleSection({}, app, "shopify");

    const brandCheck = result.checks.find((c) => c.id === "title-brand");
    expect(brandCheck?.status).toBe("pass");
  });

  it("detects separator usage", () => {
    const app = { name: "ReConvert | Upsell & Cross Sell" };
    const result = computeTitleSection({}, app, "shopify");

    const separatorCheck = result.checks.find((c) => c.id === "title-separator");
    expect(separatorCheck?.status).toBe("pass");
  });

  it("handles different platforms with different limits", () => {
    const app = { name: "A Great Salesforce App Name Here" };
    const result = computeTitleSection({}, app, "salesforce"); // limit is 80

    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).toBe("warning"); // 31/80 = under 50%
  });

  it("falls back to snapshot name when app name missing", () => {
    const snapshot = { name: "Snapshot App — Email Marketing" };
    const result = computeTitleSection(snapshot, {}, "shopify");

    expect(result.score).toBeGreaterThan(0);
    const lengthCheck = result.checks.find((c) => c.id === "title-length");
    expect(lengthCheck?.status).not.toBe("fail");
  });

  it("returns 4 checks", () => {
    const app = { name: "Test App" };
    const result = computeTitleSection({}, app, "shopify");
    expect(result.checks).toHaveLength(4);
  });
});
