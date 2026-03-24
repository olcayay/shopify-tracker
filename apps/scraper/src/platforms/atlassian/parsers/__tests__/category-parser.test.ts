import { describe, it, expect } from "vitest";
import { parseAtlassianCategoryPage } from "../category-parser.js";

// ---------------------------------------------------------------------------
// Helper: build HTML containing window.__INITIAL_STATE__
// ---------------------------------------------------------------------------

function buildHtml(state: Record<string, any>): string {
  const json = JSON.stringify(state);
  return `<html><head><script>window.__INITIAL_STATE__ = ${json};</script></head><body></body></html>`;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APOLLO_STATE = {
  apolloInitialState: {
    ROOT_QUERY: {
      'marketplaceCategory({"slug":"project-management","filters":{},"sort":"RECOMMENDED","pageNumber":1})': {
        category: { __ref: "MarketplaceStoreCategoryResponse:project-management" },
        apps: {
          edges: [
            { node: { __ref: "AppTile:101" } },
            { node: { __ref: "AppTile:102" } },
          ],
          pageInfo: {
            totalCount: 55,
            hasNextPage: true,
            totalPages: 4,
          },
        },
      },
    },
    "MarketplaceStoreCategoryResponse:project-management": {
      slug: "project-management",
      name: "Project Management",
      heroSection: { description: "Apps for managing projects" },
    },
    "AppTile:101": {
      addonKey: "com.example.first",
      addonId: 1001,
      name: "First App",
      tagLine: "The first app",
      ratings: { avgStars: 4.5, numRatings: 200 },
      logo: { highRes: "abc123" },
      distribution: { activeInstalls: 30000 },
      programs: { cloudFortified: { status: "approved" } },
      tags: { marketingLabels: ["Top Vendor"] },
      vendor: { __ref: "Vendor:10" },
    },
    "AppTile:102": {
      addonKey: "com.example.second",
      addonId: 1002,
      name: "Second App",
      tagLine: "The second app",
      ratings: { avgStars: 3.8, numRatings: 50 },
      logo: { image: "def456" },
      distribution: { totalInstalls: 5000 },
      programs: {},
      tags: { marketingLabels: [] },
      vendor: { __ref: "Vendor:20" },
    },
    "Vendor:10": { name: "Vendor Alpha" },
    "Vendor:20": { name: "Vendor Beta" },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseAtlassianCategoryPage", () => {
  it("parses apps from __INITIAL_STATE__ Apollo cache", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].slug).toBe("com.example.first");
    expect(result.apps[0].name).toBe("First App");
    expect(result.apps[1].slug).toBe("com.example.second");
  });

  it("extracts category metadata (title and description)", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.title).toBe("Project Management");
    expect(result.description).toBe("Apps for managing projects");
  });

  it("extracts page info (totalCount and hasNextPage)", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.appCount).toBe(55);
    expect(result.hasNextPage).toBe(true);
  });

  it("assigns correct position to each app in order", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
  });

  it("parses badges (cloud_fortified and top_vendor)", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps[0].badges).toContain("cloud_fortified");
    expect(result.apps[0].badges).toContain("top_vendor");
    expect(result.apps[1].badges).toEqual([]);
  });

  it("builds logo URL from CDN file ID", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps[0].logoUrl).toBe(
      "https://marketplace.atlassian.com/product-listing/files/abc123",
    );
    expect(result.apps[1].logoUrl).toBe(
      "https://marketplace.atlassian.com/product-listing/files/def456",
    );
  });

  it("resolves vendor name from __ref", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps[0].extra?.vendorName).toBe("Vendor Alpha");
    expect(result.apps[1].extra?.vendorName).toBe("Vendor Beta");
  });

  it("includes extra fields (totalInstalls, externalId)", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps[0].extra?.totalInstalls).toBe(30000);
    expect(result.apps[0].externalId).toBe("1001");
    expect(result.apps[1].extra?.totalInstalls).toBe(5000);
  });

  it("returns empty apps when HTML has no __INITIAL_STATE__", () => {
    const html = "<html><body>No state here</body></html>";
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.apps).toHaveLength(0);
    expect(result.slug).toBe("project-management");
  });

  it("returns correct url and slug fields", () => {
    const html = buildHtml(APOLLO_STATE);
    const result = parseAtlassianCategoryPage(html, "project-management");
    expect(result.slug).toBe("project-management");
    expect(result.url).toBe("https://marketplace.atlassian.com/categories/project-management");
    expect(result.subcategoryLinks).toEqual([]);
  });

  it("falls back to slug-based title when category metadata is missing", () => {
    const stateNoMeta = {
      apolloInitialState: {
        ROOT_QUERY: {},
      },
    };
    const html = buildHtml(stateNoMeta);
    const result = parseAtlassianCategoryPage(html, "admin-tools");
    expect(result.title).toBe("admin tools"); // slug with hyphens replaced
    expect(result.apps).toHaveLength(0);
  });

  it("uses fallback AppTile scan when ROOT_QUERY has no matching category", () => {
    const stateWithTilesOnly = {
      apolloInitialState: {
        ROOT_QUERY: {},
        "AppTile:201": {
          addonKey: "com.fallback.app",
          name: "Fallback App",
          tagLine: "Found by scan",
          ratings: { avgStars: 4.0, numRatings: 10 },
          logo: { highRes: "fb123" },
          programs: {},
          tags: { marketingLabels: [] },
        },
      },
    };
    const html = buildHtml(stateWithTilesOnly);
    const result = parseAtlassianCategoryPage(html, "unknown-category");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].slug).toBe("com.fallback.app");
    expect(result.apps[0].position).toBe(1);
  });
});
