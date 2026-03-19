import { describe, it, expect } from "vitest";
import { parseZoomCategoryPage } from "../category-parser.js";

const SAMPLE_RESPONSE = {
  total: 257,
  pageNum: 1,
  pageSize: 100,
  uniqueRequest: "abc123",
  essentialAppIntroduction: null,
  apps: [
    {
      id: "ViT60ZmbTpWGGWFt9CuUUw",
      name: "AI-generated meeting summaries by Read AI",
      displayName: "AI-generated meeting summaries by Read AI",
      icon: "/path/to/icon.png",
      description: "Live AI-generated meeting notes.",
      companyName: "Read AI",
      worksWith: ["ZOOM_MEETING"],
      usage: "USER_OPERATION",
      fedRampAuthorized: false,
      essentialApp: true,
      ratingStatistics: {
        totalRatings: 47,
        averageRating: 2.7,
        rating1Count: 25,
        rating2Count: 1,
        rating3Count: 1,
        rating4Count: 1,
        rating5Count: 19,
      },
    },
    {
      id: "XYZ123abc",
      name: "Another App",
      displayName: "Another App",
      icon: "/path/to/icon2.png",
      description: "Another app description.",
      companyName: "Some Company",
      worksWith: ["ZOOM_MEETING", "ZOOM_WEBINAR"],
      usage: "ADMIN_OPERATION",
      fedRampAuthorized: true,
      essentialApp: false,
      ratingStatistics: {
        totalRatings: 10,
        averageRating: 4.5,
      },
    },
  ],
};

describe("parseZoomCategoryPage", () => {
  it("should parse basic category page", () => {
    const result = parseZoomCategoryPage(SAMPLE_RESPONSE, "analytics", 1);

    expect(result.slug).toBe("analytics");
    expect(result.appCount).toBe(257);
    expect(result.apps).toHaveLength(2);
    expect(result.subcategoryLinks).toHaveLength(0);
  });

  it("should parse app details correctly", () => {
    const result = parseZoomCategoryPage(SAMPLE_RESPONSE, "analytics", 1);
    const app = result.apps[0];

    expect(app.slug).toBe("ViT60ZmbTpWGGWFt9CuUUw");
    expect(app.name).toBe("AI-generated meeting summaries by Read AI");
    expect(app.shortDescription).toBe("Live AI-generated meeting notes.");
    expect(app.averageRating).toBe(2.7);
    expect(app.ratingCount).toBe(47);
    expect(app.position).toBe(1);
    expect(app.isSponsored).toBe(false);
    expect(app.badges).toContain("essential_app");
    expect(app.badges).not.toContain("fedramp_authorized");
  });

  it("should parse FedRAMP badge", () => {
    const result = parseZoomCategoryPage(SAMPLE_RESPONSE, "analytics", 1);
    const app = result.apps[1];

    expect(app.badges).toContain("fedramp_authorized");
    expect(app.badges).not.toContain("essential_app");
  });

  it("should calculate positions correctly for page > 1", () => {
    const page2Response = { ...SAMPLE_RESPONSE, pageNum: 2 };
    const result = parseZoomCategoryPage(page2Response, "analytics", 2);

    expect(result.apps[0].position).toBe(101);
    expect(result.apps[1].position).toBe(102);
  });

  it("should detect hasNextPage correctly", () => {
    // 2 apps but total is 257 → has next page
    const result = parseZoomCategoryPage(SAMPLE_RESPONSE, "analytics", 1);
    // apps.length (2) < pageSize (100) → no next page
    expect(result.hasNextPage).toBe(false);

    // Simulate full page
    const fullPage = {
      ...SAMPLE_RESPONSE,
      apps: Array.from({ length: 100 }, (_, i) => ({
        ...SAMPLE_RESPONSE.apps[0],
        id: `app_${i}`,
      })),
    };
    const fullResult = parseZoomCategoryPage(fullPage, "analytics", 1);
    expect(fullResult.hasNextPage).toBe(true);
  });

  it("should handle empty response", () => {
    const empty = { total: 0, pageNum: 1, pageSize: 100, apps: [] };
    const result = parseZoomCategoryPage(empty, "analytics", 1);

    expect(result.apps).toHaveLength(0);
    expect(result.appCount).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("should build icon URLs correctly", () => {
    const result = parseZoomCategoryPage(SAMPLE_RESPONSE, "analytics", 1);
    expect(result.apps[0].logoUrl).toBe("https://marketplacecontent-cf.zoom.us/%2Fpath%2Fto%2Ficon.png");
  });
});
