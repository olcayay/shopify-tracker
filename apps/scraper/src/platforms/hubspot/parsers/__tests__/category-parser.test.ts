import { describe, it, expect } from "vitest";
import { parseHubSpotCategoryPage } from "../category-parser.js";
import { makeChirpSearchResponse } from "./fixtures.js";

describe("parseHubSpotCategoryPage", () => {
  const url = "https://ecosystem.hubspot.com/marketplace/apps/sales";

  it("parses apps from CHIRP search response", () => {
    const json = makeChirpSearchResponse();
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps).toHaveLength(3);
  });

  it("assigns sequential positions", () => {
    const json = makeChirpSearchResponse();
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[2].position).toBe(3);
  });

  it("extracts app slug", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "my-app", listingName: "My App" }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].slug).toBe("my-app");
  });

  it("extracts app name", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "slack", listingName: "Slack" }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].name).toBe("Slack");
  });

  it("extracts short description", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "app", listingName: "App", description: "A great app" }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].shortDescription).toBe("A great app");
  });

  it("extracts icon URL", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "app", listingName: "App", iconUrl: "https://example.com/icon.png" }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].logoUrl).toBe("https://example.com/icon.png");
  });

  it("extracts total app count", () => {
    const json = makeChirpSearchResponse({ total: 2158 });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.appCount).toBe(2158);
  });

  it("sets hasNextPage true when full page received", () => {
    const cards = Array.from({ length: 50 }, (_, i) => ({
      slug: `app-${i}`,
      listingName: `App ${i}`,
    }));
    const json = makeChirpSearchResponse({ cards, total: 2158 });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.hasNextPage).toBe(true);
  });

  it("sets hasNextPage false when partial page", () => {
    const json = makeChirpSearchResponse({ total: 3 });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.hasNextPage).toBe(false);
  });

  it("builds title from category slug", () => {
    const json = makeChirpSearchResponse({ cards: [] });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.title).toBe("Sales");
  });

  it("builds compound title from compound slug", () => {
    const json = makeChirpSearchResponse({ cards: [] });
    const result = parseHubSpotCategoryPage(json, "marketing--email", "https://ecosystem.hubspot.com/marketplace/apps/marketing/email");
    expect(result.title).toBe("Marketing > Email");
  });

  it("returns empty page for invalid JSON", () => {
    const result = parseHubSpotCategoryPage("not json", "sales", url);
    expect(result.apps).toEqual([]);
    expect(result.appCount).toBe(0);
  });

  it("extracts badges from card products", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "app", listingName: "App", certified: true, builtByHubSpot: true }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].badges).toContain("Certified");
    expect(result.apps[0].badges).toContain("Built by HubSpot");
  });

  it("stores install count in extra", () => {
    const json = makeChirpSearchResponse({
      cards: [{ slug: "app", listingName: "App", installCount: 100000 }],
    });
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.apps[0].extra?.installCount).toBe(100000);
  });

  it("sets category slug and URL pass-through", () => {
    const json = makeChirpSearchResponse({ cards: [] });
    const result = parseHubSpotCategoryPage(json, "marketing", "https://example.com/marketplace/apps/marketing");
    expect(result.slug).toBe("marketing");
    expect(result.url).toBe("https://example.com/marketplace/apps/marketing");
  });

  it("returns empty subcategoryLinks", () => {
    const json = makeChirpSearchResponse();
    const result = parseHubSpotCategoryPage(json, "sales", url);
    expect(result.subcategoryLinks).toEqual([]);
  });
});
