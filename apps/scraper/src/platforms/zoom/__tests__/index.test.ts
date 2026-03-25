import { describe, it, expect, vi } from "vitest";
import { ZoomModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";

describe("ZoomModule", () => {
  const mod = new ZoomModule();

  describe("platformId", () => {
    it("returns 'zoom'", () => {
      expect(mod.platformId).toBe("zoom");
    });
  });

  describe("capabilities", () => {
    it("has keyword search", () => {
      expect(mod.capabilities.hasKeywordSearch).toBe(true);
    });

    it("has featured sections", () => {
      expect(mod.capabilities.hasFeaturedSections).toBe(true);
    });

    it("has no reviews (requires auth)", () => {
      expect(mod.capabilities.hasReviews).toBe(false);
    });

    it("has no ad tracking", () => {
      expect(mod.capabilities.hasAdTracking).toBe(false);
    });

    it("has no similar apps", () => {
      expect(mod.capabilities.hasSimilarApps).toBe(false);
    });

    it("has no auto suggestions", () => {
      expect(mod.capabilities.hasAutoSuggestions).toBe(false);
    });

    it("has no feature taxonomy", () => {
      expect(mod.capabilities.hasFeatureTaxonomy).toBe(false);
    });

    it("has no pricing (requires auth)", () => {
      expect(mod.capabilities.hasPricing).toBe(false);
    });

    it("has no launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(false);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct marketplace URL", () => {
      expect(mod.buildAppUrl("VG_p3Bb_TwWe_bgZmPUaXw")).toBe(
        "https://marketplace.zoom.us/apps/VG_p3Bb_TwWe_bgZmPUaXw",
      );
    });

    it("buildCategoryUrl returns correct category URL", () => {
      expect(mod.buildCategoryUrl("productivity")).toBe(
        "https://marketplace.zoom.us/apps?category=productivity",
      );
    });

    it("buildSearchUrl returns correct search URL with encoded keyword", () => {
      expect(mod.buildSearchUrl("project management")).toBe(
        "https://marketplace.zoom.us/apps?q=project%20management",
      );
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.zoom.us/apps/VG_p3Bb_TwWe_bgZmPUaXw"),
      ).toBe("VG_p3Bb_TwWe_bgZmPUaXw");
    });

    it("extracts slug from URL with query params", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.zoom.us/apps/ABC123?ref=search"),
      ).toBe("ABC123");
    });

    it("falls back to last path segment for non-standard URLs", () => {
      expect(
        mod.extractSlugFromUrl("https://example.com/some-path/my-app"),
      ).toBe("my-app");
    });
  });

  describe("fetchAppPage", () => {
    function makePage(apps: { id: string; name: string }[]) {
      return JSON.stringify({ apps, total: 200 });
    }

    it("finds app on first page", async () => {
      const httpClient = new HttpClient();
      vi.spyOn(httpClient, "fetchPage").mockResolvedValueOnce(
        makePage([
          { id: "abc", name: "App A" },
          { id: "target-id", name: "Target App" },
        ]),
      );
      const mod2 = new ZoomModule(httpClient);
      const result = await mod2.fetchAppPage("target-id");
      expect(JSON.parse(result)).toEqual({ id: "target-id", name: "Target App" });
      expect(httpClient.fetchPage).toHaveBeenCalledTimes(1);
    });

    it("finds app on second page (pagination)", async () => {
      const httpClient = new HttpClient();
      const page1Apps = Array.from({ length: 100 }, (_, i) => ({
        id: `app-${i}`,
        name: `App ${i}`,
      }));
      vi.spyOn(httpClient, "fetchPage")
        .mockResolvedValueOnce(makePage(page1Apps))
        .mockResolvedValueOnce(
          makePage([{ id: "deep-app", name: "Deep App" }]),
        );
      const mod2 = new ZoomModule(httpClient);
      const result = await mod2.fetchAppPage("deep-app");
      expect(JSON.parse(result)).toEqual({ id: "deep-app", name: "Deep App" });
      expect(httpClient.fetchPage).toHaveBeenCalledTimes(2);
    });

    it("throws when app not found after all pages", async () => {
      const httpClient = new HttpClient();
      // Return a page with fewer than 100 apps → signals last page
      vi.spyOn(httpClient, "fetchPage").mockResolvedValueOnce(
        makePage([{ id: "other", name: "Other App" }]),
      );
      const mod2 = new ZoomModule(httpClient);
      await expect(mod2.fetchAppPage("nonexistent")).rejects.toThrow(
        "Zoom app not found after paginating filter API: nonexistent",
      );
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const pd = {
        categories: [
          { slug: "productivity" },
          { slug: "project-management" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual([
        "productivity",
        "project-management",
      ]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("returns empty array when categories is not an array", () => {
      expect(mod.extractCategorySlugs({ categories: "invalid" })).toEqual([]);
    });

    it("filters out entries without slug", () => {
      const pd = {
        categories: [
          { slug: "analytics" },
          { name: "No Slug" },
          { slug: "crm" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual(["analytics", "crm"]);
    });
  });
});
