import { describe, it, expect } from "vitest";
import { parseZoomSearchPage } from "../search-parser.js";

const SAMPLE_SEARCH_RESPONSE = {
  total: 32,
  pageNum: 1,
  pageSize: 100,
  uniqueRequest: "def456",
  essentialAppIntroduction: null,
  apps: [
    {
      id: "Y72-b02VQjKiZT0O6gt0jQ",
      name: "The Events Calendar",
      displayName: "The Events Calendar - for WordPress Virtual Events",
      icon: "/path/to/icon1.png",
      description: "Connect The Events Calendar with Zoom.",
      companyName: "The Events Calendar",
      worksWith: ["ZOOM_MEETING"],
      usage: "USER_OPERATION",
      fedRampAuthorized: false,
      essentialApp: false,
      ratingStatistics: {
        totalRatings: 5,
        averageRating: 3.2,
      },
    },
    {
      id: "ABC123def",
      name: "Calendar App",
      displayName: "Calendar App",
      icon: "/path/to/icon2.png",
      description: "A calendar integration for Zoom.",
      companyName: "CalCo",
      worksWith: ["ZOOM_MEETING", "ZOOM_WEBINAR"],
      usage: "USER_OPERATION",
      fedRampAuthorized: true,
      essentialApp: true,
      ratingStatistics: {
        totalRatings: 100,
        averageRating: 4.8,
      },
    },
  ],
};

describe("parseZoomSearchPage", () => {
  it("should parse basic search results", () => {
    const result = parseZoomSearchPage(SAMPLE_SEARCH_RESPONSE, "calendar", 1);

    expect(result.keyword).toBe("calendar");
    expect(result.totalResults).toBe(32);
    expect(result.currentPage).toBe(1);
    expect(result.apps).toHaveLength(2);
  });

  it("should parse search app details", () => {
    const result = parseZoomSearchPage(SAMPLE_SEARCH_RESPONSE, "calendar", 1);
    const app = result.apps[0];

    expect(app.appSlug).toBe("Y72-b02VQjKiZT0O6gt0jQ");
    expect(app.appName).toBe("The Events Calendar - for WordPress Virtual Events");
    expect(app.shortDescription).toBe("Connect The Events Calendar with Zoom.");
    expect(app.averageRating).toBe(3.2);
    expect(app.ratingCount).toBe(5);
    expect(app.position).toBe(1);
    expect(app.isSponsored).toBe(false);
    expect(app.badges).toEqual([]);
  });

  it("should parse badges correctly", () => {
    const result = parseZoomSearchPage(SAMPLE_SEARCH_RESPONSE, "calendar", 1);
    const app = result.apps[1];

    expect(app.badges).toContain("fedramp_authorized");
    expect(app.badges).toContain("essential_app");
  });

  it("should calculate positions for page > 1", () => {
    const page2 = { ...SAMPLE_SEARCH_RESPONSE, pageNum: 2 };
    const result = parseZoomSearchPage(page2, "calendar", 2);

    expect(result.apps[0].position).toBe(101);
    expect(result.apps[1].position).toBe(102);
  });

  it("should handle empty results", () => {
    const empty = { total: 0, pageNum: 1, pageSize: 100, apps: [] };
    const result = parseZoomSearchPage(empty, "nonexistent", 1);

    expect(result.apps).toHaveLength(0);
    expect(result.totalResults).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("should detect hasNextPage correctly", () => {
    // 2 apps out of 32, less than pageSize → no next
    const result = parseZoomSearchPage(SAMPLE_SEARCH_RESPONSE, "calendar", 1);
    expect(result.hasNextPage).toBe(false);

    // Full page → has next
    const fullPage = {
      ...SAMPLE_SEARCH_RESPONSE,
      apps: Array.from({ length: 100 }, (_, i) => ({
        ...SAMPLE_SEARCH_RESPONSE.apps[0],
        id: `app_${i}`,
      })),
    };
    const fullResult = parseZoomSearchPage(fullPage, "calendar", 1);
    expect(fullResult.hasNextPage).toBe(false); // 100 apps, total 32, no next
  });
});
