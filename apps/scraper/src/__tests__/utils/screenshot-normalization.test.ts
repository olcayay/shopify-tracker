import { describe, it, expect } from "vitest";

/**
 * Tests for the screenshot normalization logic used in app-details-scraper.
 * This mirrors the extraction code in app-details-scraper.ts.
 */

function normalizeScreenshots(platformData: any): string[] {
  const rawScreenshots = platformData?.screenshots;
  const screenshots: string[] = Array.isArray(rawScreenshots)
    ? rawScreenshots
        .map((s: any) => (typeof s === "string" ? s : s?.src || s?.url || null))
        .filter((url: string | null): url is string => typeof url === "string" && url.startsWith("http"))
    : [];
  return screenshots;
}

describe("screenshot normalization", () => {
  it("returns empty array when no screenshots", () => {
    expect(normalizeScreenshots({})).toEqual([]);
    expect(normalizeScreenshots(null)).toEqual([]);
    expect(normalizeScreenshots(undefined)).toEqual([]);
  });

  it("handles string array (Wix, Google Workspace, Canva format)", () => {
    const result = normalizeScreenshots({
      screenshots: [
        "https://example.com/ss1.png",
        "https://example.com/ss2.png",
      ],
    });
    expect(result).toEqual([
      "https://example.com/ss1.png",
      "https://example.com/ss2.png",
    ]);
  });

  it("handles WordPress object format with src field", () => {
    const result = normalizeScreenshots({
      screenshots: {
        1: { src: "https://ps.w.org/plugin/ss1.png", caption: "Screenshot 1" },
        2: { src: "https://ps.w.org/plugin/ss2.png", caption: "Screenshot 2" },
      },
    });
    // WordPress returns an object, not an array — Array.isArray returns false
    expect(result).toEqual([]);
  });

  it("handles array of objects with src field", () => {
    const result = normalizeScreenshots({
      screenshots: [
        { src: "https://example.com/ss1.png", caption: "Screenshot 1" },
        { src: "https://example.com/ss2.png", caption: "Screenshot 2" },
      ],
    });
    expect(result).toEqual([
      "https://example.com/ss1.png",
      "https://example.com/ss2.png",
    ]);
  });

  it("handles array of objects with url field", () => {
    const result = normalizeScreenshots({
      screenshots: [
        { url: "https://example.com/ss1.png" },
        { url: "https://example.com/ss2.png" },
      ],
    });
    expect(result).toEqual([
      "https://example.com/ss1.png",
      "https://example.com/ss2.png",
    ]);
  });

  it("filters out non-HTTP URLs", () => {
    const result = normalizeScreenshots({
      screenshots: [
        "https://example.com/valid.png",
        "data:image/png;base64,abc",
        "/relative/path.png",
        "",
      ],
    });
    expect(result).toEqual(["https://example.com/valid.png"]);
  });

  it("filters out null and undefined entries", () => {
    const result = normalizeScreenshots({
      screenshots: [
        "https://example.com/ss1.png",
        null,
        undefined,
        { src: null },
      ],
    });
    expect(result).toEqual(["https://example.com/ss1.png"]);
  });

  it("handles mixed string and object entries", () => {
    const result = normalizeScreenshots({
      screenshots: [
        "https://example.com/ss1.png",
        { src: "https://example.com/ss2.png" },
        { url: "https://example.com/ss3.png" },
      ],
    });
    expect(result).toEqual([
      "https://example.com/ss1.png",
      "https://example.com/ss2.png",
      "https://example.com/ss3.png",
    ]);
  });
});
