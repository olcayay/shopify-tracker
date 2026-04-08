import { describe, it, expect } from "vitest";
import { computeVisualsSection } from "../../audit/rules/visuals.js";

describe("computeVisualsSection", () => {
  it("scores well with full visuals", () => {
    const snapshot = {
      screenshots: ["s1.png", "s2.png", "s3.png", "s4.png", "s5.png"],
    };
    const app = { iconUrl: "https://example.com/icon.png" };

    const result = computeVisualsSection(snapshot, app, "shopify");
    expect(result.id).toBe("visuals");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("fails for no screenshots", () => {
    const result = computeVisualsSection({}, { iconUrl: "icon.png" }, "shopify");

    const ssCheck = result.checks.find((c) => c.id === "visuals-screenshots");
    expect(ssCheck?.status).toBe("fail");
    expect(ssCheck?.detail).toContain("No screenshots");
  });

  it("fails for missing icon", () => {
    const result = computeVisualsSection({}, {}, "shopify");

    const iconCheck = result.checks.find((c) => c.id === "visuals-icon");
    expect(iconCheck?.status).toBe("fail");
  });

  it("detects video content", () => {
    const snapshot = {
      screenshots: ["s1.png", "https://youtube.com/watch?v=abc", "s3.png"],
    };
    const result = computeVisualsSection(snapshot, {}, "shopify");

    const videoCheck = result.checks.find((c) => c.id === "visuals-video");
    expect(videoCheck?.status).toBe("pass");
  });

  it("warns about no video", () => {
    const snapshot = {
      screenshots: ["s1.png", "s2.png", "s3.png"],
    };
    const result = computeVisualsSection(snapshot, {}, "shopify");

    const videoCheck = result.checks.find((c) => c.id === "visuals-video");
    expect(videoCheck?.status).toBe("warning");
  });

  it("detects duplicate screenshots", () => {
    const snapshot = {
      screenshots: ["s1.png", "s1.png", "s2.png"],
    };
    const result = computeVisualsSection(snapshot, {}, "shopify");

    const varietyCheck = result.checks.find((c) => c.id === "visuals-variety");
    expect(varietyCheck?.status).toBe("warning");
    expect(varietyCheck?.detail).toContain("duplicate");
  });
});
