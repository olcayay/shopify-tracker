import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react cache
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: (fn: any) => fn,
  };
});

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => ({ value: "test-token" }),
  }),
}));

describe("API functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchApi internals", () => {
    it("sends Authorization header with token", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { getApps } = await import("@/lib/api");
      await getApps();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("throws error on non-ok response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal Server Error" }),
      });

      const { getApps } = await import("@/lib/api");
      await expect(getApps()).rejects.toThrow("Internal Server Error");
    });

    it("throws generic error when no error message in response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      const { getApps } = await import("@/lib/api");
      await expect(getApps()).rejects.toThrow("API error: 404");
    });
  });

  describe("Category API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getCategories fetches with tree format by default", async () => {
      const { getCategories } = await import("@/lib/api");
      await getCategories();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/categories?format=tree"),
        expect.any(Object)
      );
    });

    it("getCategories supports flat format", async () => {
      const { getCategories } = await import("@/lib/api");
      await getCategories("flat");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/categories?format=flat"),
        expect.any(Object)
      );
    });

    it("getCategory fetches by slug", async () => {
      const { getCategory } = await import("@/lib/api");
      await getCategory("analytics");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/categories/analytics"),
        expect.any(Object)
      );
    });

    it("getCategoryHistory fetches with limit", async () => {
      const { getCategoryHistory } = await import("@/lib/api");
      await getCategoryHistory("analytics", 10);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/categories/analytics/history?limit=10"),
        expect.any(Object)
      );
    });
  });

  describe("Apps API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getApps fetches all apps", async () => {
      const { getApps } = await import("@/lib/api");
      await getApps();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps"),
        expect.any(Object)
      );
    });

    it("getApp fetches by slug", async () => {
      const { getApp } = await import("@/lib/api");
      await getApp("my-app");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/my-app"),
        expect.any(Object)
      );
    });

    it("getAppReviews fetches with pagination", async () => {
      const { getAppReviews } = await import("@/lib/api");
      await getAppReviews("my-app", 10, 20, "newest");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/my-app/reviews?limit=10&offset=20&sort=newest"),
        expect.any(Object)
      );
    });

    it("getAppRankings fetches with days", async () => {
      const { getAppRankings } = await import("@/lib/api");
      await getAppRankings("my-app", 60);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/my-app/rankings?days=60"),
        expect.any(Object)
      );
    });

    it("getAppChanges fetches changes", async () => {
      const { getAppChanges } = await import("@/lib/api");
      await getAppChanges("my-app", 25);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/my-app/changes?limit=25"),
        expect.any(Object)
      );
    });

    it("searchApps encodes query", async () => {
      const { searchApps } = await import("@/lib/api");
      await searchApps("hello world");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/search?q=hello%20world"),
        expect.any(Object)
      );
    });
  });

  describe("Batch API functions", () => {
    it("getAppsLastChanges returns empty for empty slugs", async () => {
      const { getAppsLastChanges } = await import("@/lib/api");
      const result = await getAppsLastChanges([]);
      expect(result).toEqual({});
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("getAppsLastChanges sends POST with slugs", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "app-1": "2026-01-01" }),
      });

      const { getAppsLastChanges } = await import("@/lib/api");
      await getAppsLastChanges(["app-1"]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/last-changes"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ slugs: ["app-1"] }),
        })
      );
    });

    it("getAppsMinPaidPrices returns empty for empty slugs", async () => {
      const { getAppsMinPaidPrices } = await import("@/lib/api");
      const result = await getAppsMinPaidPrices([]);
      expect(result).toEqual({});
    });

    it("getAppsReviewVelocity returns empty for empty slugs", async () => {
      const { getAppsReviewVelocity } = await import("@/lib/api");
      const result = await getAppsReviewVelocity([]);
      expect(result).toEqual({});
    });

    it("getAppsReverseSimilarCounts returns empty for empty slugs", async () => {
      const { getAppsReverseSimilarCounts } = await import("@/lib/api");
      const result = await getAppsReverseSimilarCounts([]);
      expect(result).toEqual({});
    });

    it("getAppsCategories returns empty for empty slugs", async () => {
      const { getAppsCategories } = await import("@/lib/api");
      const result = await getAppsCategories([]);
      expect(result).toEqual({});
    });

    it("getAppsLaunchedDates returns empty for empty slugs", async () => {
      const { getAppsLaunchedDates } = await import("@/lib/api");
      const result = await getAppsLaunchedDates([]);
      expect(result).toEqual({});
    });

    it("getAppsFeaturedSectionCounts returns empty for empty slugs", async () => {
      const { getAppsFeaturedSectionCounts } = await import("@/lib/api");
      const result = await getAppsFeaturedSectionCounts([]);
      expect(result).toEqual({});
    });

    it("getAppsAdKeywordCounts returns empty for empty slugs", async () => {
      const { getAppsAdKeywordCounts } = await import("@/lib/api");
      const result = await getAppsAdKeywordCounts([]);
      expect(result).toEqual({});
    });
  });

  describe("Keywords API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getKeywords fetches all keywords", async () => {
      const { getKeywords } = await import("@/lib/api");
      await getKeywords();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keywords"),
        expect.any(Object)
      );
    });

    it("getKeyword fetches by slug", async () => {
      const { getKeyword } = await import("@/lib/api");
      await getKeyword("shopify-app");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keywords/shopify-app"),
        expect.any(Object)
      );
    });

    it("getKeywordRankings fetches with days and scope", async () => {
      const { getKeywordRankings } = await import("@/lib/api");
      await getKeywordRankings("shopify-app", 60, "account");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("days=60"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("scope=account"),
        expect.any(Object)
      );
    });

    it("searchKeywords encodes query", async () => {
      const { searchKeywords } = await import("@/lib/api");
      await searchKeywords("shopify analytics");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keywords/search?q=shopify%20analytics"),
        expect.any(Object)
      );
    });
  });

  describe("Featured Apps API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getFeaturedApps fetches with default params", async () => {
      const { getFeaturedApps } = await import("@/lib/api");
      await getFeaturedApps();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/featured-apps?days=30"),
        expect.any(Object)
      );
    });

    it("getFeaturedApps fetches with surface filter", async () => {
      const { getFeaturedApps } = await import("@/lib/api");
      await getFeaturedApps(30, "category", "analytics");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("surface=category"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("surfaceDetail=analytics"),
        expect.any(Object)
      );
    });

    it("getFeaturedSections fetches sections", async () => {
      const { getFeaturedSections } = await import("@/lib/api");
      await getFeaturedSections(60);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/featured-apps/sections?days=60"),
        expect.any(Object)
      );
    });
  });

  describe("System Admin API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getSystemAccounts fetches accounts", async () => {
      const { getSystemAccounts } = await import("@/lib/api");
      await getSystemAccounts();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/system-admin/accounts"),
        expect.any(Object)
      );
    });

    it("getSystemAccount fetches by id", async () => {
      const { getSystemAccount } = await import("@/lib/api");
      await getSystemAccount("acc-123");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/system-admin/accounts/acc-123"),
        expect.any(Object)
      );
    });

    it("getSystemUsers fetches users", async () => {
      const { getSystemUsers } = await import("@/lib/api");
      await getSystemUsers();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/system-admin/users"),
        expect.any(Object)
      );
    });

    it("getSystemStats fetches stats", async () => {
      const { getSystemStats } = await import("@/lib/api");
      await getSystemStats();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/system-admin/stats"),
        expect.any(Object)
      );
    });

    it("getScraperRuns fetches with limit", async () => {
      const { getScraperRuns } = await import("@/lib/api");
      await getScraperRuns(10);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/system-admin/scraper/runs?limit=10"),
        expect.any(Object)
      );
    });
  });

  describe("Account API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getAccountInfo fetches account", async () => {
      const { getAccountInfo } = await import("@/lib/api");
      await getAccountInfo();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account"),
        expect.any(Object)
      );
    });

    it("getAccountMembers fetches members", async () => {
      const { getAccountMembers } = await import("@/lib/api");
      await getAccountMembers();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/members"),
        expect.any(Object)
      );
    });

    it("getAccountTrackedApps fetches tracked apps", async () => {
      const { getAccountTrackedApps } = await import("@/lib/api");
      await getAccountTrackedApps();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/tracked-apps"),
        expect.any(Object)
      );
    });

    it("getAccountTrackedKeywords fetches tracked keywords", async () => {
      const { getAccountTrackedKeywords } = await import("@/lib/api");
      await getAccountTrackedKeywords();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/tracked-keywords"),
        expect.any(Object)
      );
    });

    it("getAccountCompetitors fetches competitors", async () => {
      const { getAccountCompetitors } = await import("@/lib/api");
      await getAccountCompetitors();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/competitors"),
        expect.any(Object)
      );
    });

    it("getAppCompetitors fetches by slug", async () => {
      const { getAppCompetitors } = await import("@/lib/api");
      await getAppCompetitors("my-app");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/tracked-apps/my-app/competitors"),
        expect.any(Object)
      );
    });

    it("getAppKeywords fetches by slug", async () => {
      const { getAppKeywords } = await import("@/lib/api");
      await getAppKeywords("my-app");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/tracked-apps/my-app/keywords"),
        expect.any(Object)
      );
    });

    it("getAccountStarredFeatures fetches starred features", async () => {
      const { getAccountStarredFeatures } = await import("@/lib/api");
      await getAccountStarredFeatures();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/starred-features"),
        expect.any(Object)
      );
    });

    it("getAccountStarredCategories fetches starred categories", async () => {
      const { getAccountStarredCategories } = await import("@/lib/api");
      await getAccountStarredCategories();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/starred-categories"),
        expect.any(Object)
      );
    });
  });

  describe("Features API", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("getFeature fetches by handle", async () => {
      const { getFeature } = await import("@/lib/api");
      await getFeature("analytics-feature");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/features/analytics-feature"),
        expect.any(Object)
      );
    });

    it("searchFeatures encodes query", async () => {
      const { searchFeatures } = await import("@/lib/api");
      await searchFeatures("analytics tool");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/features/search?q=analytics%20tool"),
        expect.any(Object)
      );
    });

    it("getFeaturesByCategory fetches with params", async () => {
      const { getFeaturesByCategory } = await import("@/lib/api");
      await getFeaturesByCategory("analytics", "reports");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("category=analytics"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("subcategory=reports"),
        expect.any(Object)
      );
    });
  });

  describe("Integrations API", () => {
    it("getIntegration fetches by name", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { getIntegration } = await import("@/lib/api");
      await getIntegration("google-analytics");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/integrations/google-analytics"),
        expect.any(Object)
      );
    });
  });
});
