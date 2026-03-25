import { describe, it, expect } from "vitest";
import { zoomUrls } from "../urls.js";

describe("zoomUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      expect(zoomUrls.base).toBe("https://marketplace.zoom.us");
    });
  });

  describe("app", () => {
    it("builds app detail URL from slug", () => {
      expect(zoomUrls.app("VG_p3Bb_TwWe_bgZmPUaXw")).toBe(
        "https://marketplace.zoom.us/apps/VG_p3Bb_TwWe_bgZmPUaXw",
      );
    });
  });

  describe("category", () => {
    it("builds category page URL with slug as query param", () => {
      expect(zoomUrls.category("productivity")).toBe(
        "https://marketplace.zoom.us/apps?category=productivity",
      );
    });
  });

  describe("search", () => {
    it("builds search URL with encoded keyword", () => {
      expect(zoomUrls.search("project management")).toBe(
        "https://marketplace.zoom.us/apps?q=project%20management",
      );
    });

    it("encodes special characters", () => {
      expect(zoomUrls.search("email & calendar")).toBe(
        "https://marketplace.zoom.us/apps?q=email%20%26%20calendar",
      );
    });
  });

  describe("apiFilter", () => {
    it("builds filter API URL with defaults", () => {
      expect(zoomUrls.apiFilter("crm")).toBe(
        "https://marketplace.zoom.us/api/v1/apps/filter?category=crm&pageNum=1&pageSize=100",
      );
    });

    it("builds filter API URL with custom page and pageSize", () => {
      expect(zoomUrls.apiFilter("analytics", 3, 50)).toBe(
        "https://marketplace.zoom.us/api/v1/apps/filter?category=analytics&pageNum=3&pageSize=50",
      );
    });

    it("encodes category names with special characters", () => {
      expect(zoomUrls.apiFilter("health-wellness")).toBe(
        "https://marketplace.zoom.us/api/v1/apps/filter?category=health-wellness&pageNum=1&pageSize=100",
      );
    });
  });

  describe("apiFilterAll", () => {
    it("builds filter-all API URL with defaults", () => {
      expect(zoomUrls.apiFilterAll()).toBe(
        "https://marketplace.zoom.us/api/v1/apps/filter?pageNum=1&pageSize=100",
      );
    });

    it("builds filter-all API URL with custom page and pageSize", () => {
      expect(zoomUrls.apiFilterAll(3, 50)).toBe(
        "https://marketplace.zoom.us/api/v1/apps/filter?pageNum=3&pageSize=50",
      );
    });
  });

  describe("apiSearch", () => {
    it("builds search API URL with defaults", () => {
      expect(zoomUrls.apiSearch("calendar")).toBe(
        "https://marketplace.zoom.us/api/v1/apps/search?q=calendar&pageNum=1&pageSize=100",
      );
    });

    it("builds search API URL with custom page and pageSize", () => {
      expect(zoomUrls.apiSearch("meeting", 2, 25)).toBe(
        "https://marketplace.zoom.us/api/v1/apps/search?q=meeting&pageNum=2&pageSize=25",
      );
    });

    it("encodes search keywords", () => {
      expect(zoomUrls.apiSearch("form builder")).toBe(
        "https://marketplace.zoom.us/api/v1/apps/search?q=form%20builder&pageNum=1&pageSize=100",
      );
    });
  });

  describe("apiFeaturedPreview", () => {
    it("builds curated category preview URL", () => {
      expect(zoomUrls.apiFeaturedPreview()).toBe(
        "https://marketplace.zoom.us/api/v1/curatedCategory/preview/excludeBanner",
      );
    });
  });

  describe("apiCategories", () => {
    it("builds categories list API URL", () => {
      expect(zoomUrls.apiCategories()).toBe(
        "https://marketplace.zoom.us/api/v1/app_categories",
      );
    });
  });

  describe("iconUrl", () => {
    it("builds CDN URL from relative path with encoded slashes", () => {
      expect(zoomUrls.iconUrl("apps/images/icon.png")).toBe(
        "https://marketplacecontent-cf.zoom.us/apps%2Fimages%2Ficon.png",
      );
    });

    it("returns absolute URL unchanged", () => {
      expect(zoomUrls.iconUrl("https://cdn.example.com/icon.png")).toBe(
        "https://cdn.example.com/icon.png",
      );
    });
  });
});
