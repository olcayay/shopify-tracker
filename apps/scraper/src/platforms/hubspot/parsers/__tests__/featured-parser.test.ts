import { describe, it, expect } from "vitest";
import { parseHubSpotFeaturedSections } from "../featured-parser.js";
import { makeChirpFeaturedResponse } from "./fixtures.js";

describe("parseHubSpotFeaturedSections", () => {
  it("parses collections with preview items", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        {
          title: "Top Apps",
          slug: "top-apps",
          previewItems: [
            { slug: "gmail", name: "Gmail" },
            { slug: "slack", name: "Slack" },
          ],
        },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Top Apps");
    expect(result[0].sectionHandle).toBe("top-apps");
    expect(result[0].surface).toBe("collection");
    expect(result[0].apps).toHaveLength(2);
  });

  it("parses suggestion sections with cards", () => {
    const json = makeChirpFeaturedResponse({
      collections: [],
      suggestions: [
        {
          title: "Most popular",
          cards: [
            { slug: "gmail", listingName: "Gmail" },
            { slug: "slack", listingName: "Slack" },
          ],
        },
      ],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Most popular");
    expect(result[0].sectionHandle).toBe("most-popular");
    expect(result[0].surface).toBe("homepage");
    expect(result[0].apps).toHaveLength(2);
  });

  it("combines collections and suggestions", () => {
    const json = makeChirpFeaturedResponse();
    const result = parseHubSpotFeaturedSections(json);
    // Default: 2 collections + 2 suggestions = 4 sections
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it("assigns sequential positions within sections", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        {
          title: "Test",
          slug: "test",
          previewItems: [
            { slug: "a", name: "A" },
            { slug: "b", name: "B" },
            { slug: "c", name: "C" },
          ],
        },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].apps[0].position).toBe(1);
    expect(result[0].apps[1].position).toBe(2);
    expect(result[0].apps[2].position).toBe(3);
  });

  it("extracts app slug and name from collections", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        {
          title: "Featured",
          slug: "featured",
          previewItems: [{ slug: "zapier", name: "Zapier", iconUrl: "https://example.com/zap.png" }],
        },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].apps[0].slug).toBe("zapier");
    expect(result[0].apps[0].name).toBe("Zapier");
    expect(result[0].apps[0].iconUrl).toBe("https://example.com/zap.png");
  });

  it("extracts app slug and name from suggestions", () => {
    const json = makeChirpFeaturedResponse({
      collections: [],
      suggestions: [
        {
          title: "New",
          cards: [{ slug: "new-app", listingName: "New App", iconUrl: "https://example.com/new.png" }],
        },
      ],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].apps[0].slug).toBe("new-app");
    expect(result[0].apps[0].name).toBe("New App");
    expect(result[0].apps[0].iconUrl).toBe("https://example.com/new.png");
  });

  it("skips collections with no preview items", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        { title: "Empty", slug: "empty", previewItems: [] },
        {
          title: "Has Items",
          slug: "has-items",
          previewItems: [{ slug: "app", name: "App" }],
        },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result).toHaveLength(1);
    expect(result[0].sectionHandle).toBe("has-items");
  });

  it("skips suggestion sections with no cards", () => {
    const json = makeChirpFeaturedResponse({
      collections: [],
      suggestions: [
        { title: "Empty", cards: [] },
        { title: "Has Cards", cards: [{ slug: "app", listingName: "App" }] },
      ],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Has Cards");
  });

  it("sets surfaceDetail for collections", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        { title: "Test", slug: "my-collection", previewItems: [{ slug: "a", name: "A" }] },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].surfaceDetail).toBe("hubspot-collection-my-collection");
  });

  it("sets surfaceDetail for suggestions", () => {
    const json = makeChirpFeaturedResponse({
      collections: [],
      suggestions: [
        { title: "Popular", cards: [{ slug: "a", listingName: "A" }] },
      ],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].surfaceDetail).toBe("hubspot-marketplace-homepage");
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseHubSpotFeaturedSections("bad json");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty data", () => {
    const result = parseHubSpotFeaturedSections(JSON.stringify({}));
    expect(result).toEqual([]);
  });

  it("uses collection id as fallback handle", () => {
    const json = makeChirpFeaturedResponse({
      collections: [
        { id: 12345, title: "Test", previewItems: [{ slug: "a", name: "A" }] },
      ],
      suggestions: [],
    });
    const result = parseHubSpotFeaturedSections(json);
    expect(result[0].sectionHandle).toBe("12345");
  });
});
