import { describe, it, expect } from "vitest";
import { parseAppHtml, parseSearchHtml } from "../../../platforms/atlassian/parsers/html-parser.js";

const stateHtml = `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
  apollo: {
    cache: {
      "addon:test-app": {
        __typename: "Addon",
        addonKey: "test-app",
        name: "Test App",
        rating: { stars: 4.5, count: 200 },
        pricing: { summary: "$10/month" },
        logo: { url: "https://example.com/logo.png" },
        vendor: { name: "Test Vendor", links: { base: "/vendor/test" } },
        isCloudFortified: true,
        isTopVendor: false,
        categories: ["devops"],
        summary: "A test app",
        description: "Full description",
        hostingOptions: ["cloud"],
        installCount: 5000,
      },
    },
  },
})}</script></html>`;

const domHtml = `<html>
  <body>
    <h1>DOM Parsed App</h1>
    <span data-testid="rating-count">4.3 (120)</span>
    <span data-testid="vendor-name">DOM Vendor</span>
    <img data-testid="app-logo" src="https://example.com/dom-logo.png" />
    <span data-testid="pricing">Free</span>
    <span>Cloud Fortified</span>
  </body>
</html>`;

describe("parseAppHtml", () => {
  it("parses from __INITIAL_STATE__ Apollo cache data", () => {
    const result = parseAppHtml(stateHtml, "test-app");
    expect(result.name).toBe("Test App");
    expect(result.slug).toBe("test-app");
    expect(result.averageRating).toBe(4.5);
    expect(result.ratingCount).toBe(200);
    expect(result.pricingHint).toBe("$10/month");
    expect(result.iconUrl).toBe("https://example.com/logo.png");
  });

  it("falls back to DOM parsing when no __INITIAL_STATE__", () => {
    const result = parseAppHtml(domHtml, "dom-app");
    expect(result.name).toBe("DOM Parsed App");
    expect(result.slug).toBe("dom-app");
    expect(result.averageRating).toBe(4.3);
    expect(result.ratingCount).toBe(120);
  });

  it("returns empty result when app not found in state", () => {
    const emptyState = `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
      apollo: { cache: {} },
    })}</script></html>`;
    const result = parseAppHtml(emptyState, "nonexistent-app");
    expect(result.name).toBe("nonexistent-app");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.badges).toEqual([]);
  });

  it("extracts badges (cloud_fortified, top_vendor)", () => {
    const result = parseAppHtml(stateHtml, "test-app");
    expect(result.badges).toContain("cloud_fortified");
    expect(result.badges).not.toContain("top_vendor");

    // Both badges
    const bothHtml = `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
      apollo: {
        cache: {
          "addon:both-app": {
            __typename: "Addon",
            addonKey: "both-app",
            name: "Both Badges",
            isCloudFortified: true,
            isTopVendor: true,
          },
        },
      },
    })}</script></html>`;
    const bothResult = parseAppHtml(bothHtml, "both-app");
    expect(bothResult.badges).toContain("cloud_fortified");
    expect(bothResult.badges).toContain("top_vendor");
  });

  it("extracts developer info from vendor field", () => {
    const result = parseAppHtml(stateHtml, "test-app");
    expect(result.developer).toEqual({
      name: "Test Vendor",
      url: "/vendor/test",
    });
  });

  it("extracts rating from cache data", () => {
    const result = parseAppHtml(stateHtml, "test-app");
    expect(result.averageRating).toBe(4.5);
    expect(result.ratingCount).toBe(200);
  });
});

describe("parseSearchHtml", () => {
  const searchStateHtml = `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    apollo: {
      cache: {
        "addon:app-one": {
          __typename: "Addon",
          addonKey: "app-one",
          name: "App One",
          summary: "First app",
          rating: { stars: 4.0, count: 50 },
          logo: { url: "https://example.com/one.png" },
        },
        "addon:app-two": {
          __typename: "Addon",
          addonKey: "app-two",
          name: "App Two",
          summary: "Second app",
          rating: { stars: 3.5, count: 30 },
          logo: { url: "https://example.com/two.png" },
        },
      },
    },
  })}</script></html>`;

  it("parses search results from Apollo cache", () => {
    const result = parseSearchHtml(searchStateHtml, "test query", 1, 0);
    expect(result.keyword).toBe("test query");
    expect(result.apps.length).toBe(2);
    expect(result.apps[0]!.appSlug).toBe("app-one");
    expect(result.apps[0]!.appName).toBe("App One");
    expect(result.apps[1]!.appSlug).toBe("app-two");
    expect(result.apps[1]!.appName).toBe("App Two");
  });

  it("returns empty apps when no cache data", () => {
    const emptyHtml = "<html><body>No results</body></html>";
    const result = parseSearchHtml(emptyHtml, "empty query", 1, 0);
    expect(result.apps).toEqual([]);
    expect(result.keyword).toBe("empty query");
  });

  it("sets position correctly with offset", () => {
    const result = parseSearchHtml(searchStateHtml, "test", 2, 10);
    expect(result.apps[0]!.position).toBe(11);
    expect(result.apps[1]!.position).toBe(12);
  });
});
