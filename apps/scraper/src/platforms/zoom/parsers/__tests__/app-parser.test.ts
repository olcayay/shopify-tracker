import { describe, it, expect } from "vitest";
import { parseZoomApp } from "../app-parser.js";

const SAMPLE_APP = {
  id: "VG_p3Bb_TwWe_bgZmPUaXw",
  name: "Calendly",
  displayName: "Calendly - Scheduling Automation",
  icon: "apps/images/calendly-icon.png",
  description: "Schedule meetings directly from Zoom.",
  companyName: "Calendly LLC",
  worksWith: ["ZOOM_MEETING", "ZOOM_WEBINAR"],
  usage: "USER_OPERATION",
  fedRampAuthorized: false,
  essentialApp: true,
  ratingStatistics: {
    totalRatings: 245,
    averageRating: 4.6,
  },
};

describe("parseZoomApp", () => {
  it("parses basic app data (name, slug, ratings)", () => {
    const result = parseZoomApp(SAMPLE_APP);

    expect(result.name).toBe("Calendly - Scheduling Automation");
    expect(result.slug).toBe("VG_p3Bb_TwWe_bgZmPUaXw");
    expect(result.averageRating).toBe(4.6);
    expect(result.ratingCount).toBe(245);
  });

  it("constructs icon URL from relative path via CDN", () => {
    const result = parseZoomApp(SAMPLE_APP);

    expect(result.iconUrl).toBe(
      "https://marketplacecontent-cf.zoom.us/apps%2Fimages%2Fcalendly-icon.png",
    );
  });

  it("returns absolute icon URL unchanged when icon starts with http", () => {
    const app = { ...SAMPLE_APP, icon: "https://cdn.example.com/icon.png" };
    const result = parseZoomApp(app);

    expect(result.iconUrl).toBe("https://cdn.example.com/icon.png");
  });

  it("parses developer info from companyName", () => {
    const result = parseZoomApp(SAMPLE_APP);

    expect(result.developer).toEqual({ name: "Calendly LLC" });
  });

  it("returns null developer when companyName is missing", () => {
    const app = { ...SAMPLE_APP, companyName: "" };
    const result = parseZoomApp(app);

    expect(result.developer).toBeNull();
  });

  it("parses essential_app badge", () => {
    const result = parseZoomApp(SAMPLE_APP);

    expect(result.badges).toContain("essential_app");
    expect(result.badges).not.toContain("fedramp_authorized");
  });

  it("parses fedramp_authorized badge", () => {
    const app = { ...SAMPLE_APP, fedRampAuthorized: true, essentialApp: false };
    const result = parseZoomApp(app);

    expect(result.badges).toContain("fedramp_authorized");
    expect(result.badges).not.toContain("essential_app");
  });

  it("parses both badges when both flags are true", () => {
    const app = { ...SAMPLE_APP, fedRampAuthorized: true, essentialApp: true };
    const result = parseZoomApp(app);

    expect(result.badges).toEqual(["fedramp_authorized", "essential_app"]);
  });

  it("handles missing/null fields gracefully", () => {
    const minimal: Record<string, any> = {};
    const result = parseZoomApp(minimal);

    expect(result.name).toBe("");
    expect(result.slug).toBe("");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.iconUrl).toBeNull();
    expect(result.developer).toBeNull();
    expect(result.pricingHint).toBeNull();
    expect(result.badges).toEqual([]);
  });

  it("falls back to name when displayName is missing", () => {
    const app = { ...SAMPLE_APP, displayName: undefined };
    const result = parseZoomApp(app);

    expect(result.name).toBe("Calendly");
  });

  it("populates platformData with expected fields", () => {
    const result = parseZoomApp(SAMPLE_APP);
    const pd = result.platformData as Record<string, unknown>;

    expect(pd.description).toBe("Schedule meetings directly from Zoom.");
    expect(pd.companyName).toBe("Calendly LLC");
    expect(pd.worksWith).toEqual(["ZOOM_MEETING", "ZOOM_WEBINAR"]);
    expect(pd.usage).toBe("USER_OPERATION");
    expect(pd.fedRampAuthorized).toBe(false);
    expect(pd.essentialApp).toBe(true);
    expect(pd.ratingStatistics).toEqual({
      totalRatings: 245,
      averageRating: 4.6,
    });
  });
});
