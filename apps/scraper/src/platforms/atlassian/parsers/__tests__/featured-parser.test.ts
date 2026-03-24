import { describe, it, expect } from "vitest";
import { parseAtlassianFeaturedSections } from "../featured-parser.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFeaturedResponse(addons: Array<{ key: string; name: string; logoHref?: string }>) {
  return {
    _embedded: {
      addons: addons.map((a) => ({
        key: a.key,
        name: a.name,
        _embedded: {
          logo: {
            _links: { image: { href: a.logoHref || `https://cdn.atlassian.com/${a.key}.png` } },
          },
        },
      })),
    },
  };
}

const SPOTLIGHT_RESPONSE = makeFeaturedResponse([
  { key: "com.spotlight.one", name: "Spotlight One" },
  { key: "com.spotlight.two", name: "Spotlight Two" },
]);

const BESTSELLER_RESPONSE = makeFeaturedResponse([
  { key: "com.best.one", name: "Bestseller One" },
  { key: "com.best.two", name: "Bestseller Two" },
  { key: "com.best.three", name: "Bestseller Three" },
]);

const RISINGSTAR_RESPONSE = makeFeaturedResponse([
  { key: "com.rising.one", name: "Rising Star One" },
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseAtlassianFeaturedSections", () => {
  it("parses all three featured sections from response map", () => {
    const responses = new Map<string, Record<string, any>>([
      ["Spotlight", SPOTLIGHT_RESPONSE],
      ["Bestseller", BESTSELLER_RESPONSE],
      ["Rising Star", RISINGSTAR_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections).toHaveLength(3);
  });

  it("parses Spotlight section with correct handle and title", () => {
    const responses = new Map<string, Record<string, any>>([
      ["Spotlight", SPOTLIGHT_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections).toHaveLength(1);
    expect(sections[0].sectionHandle).toBe("_collection_spotlight");
    expect(sections[0].sectionTitle).toBe("Spotlight");
    expect(sections[0].surface).toBe("home");
    expect(sections[0].surfaceDetail).toBe("marketing_label_spotlight");
  });

  it("parses Bestseller section apps with correct positions", () => {
    const responses = new Map<string, Record<string, any>>([
      ["Bestseller", BESTSELLER_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections[0].apps).toHaveLength(3);
    expect(sections[0].apps[0].position).toBe(1);
    expect(sections[0].apps[1].position).toBe(2);
    expect(sections[0].apps[2].position).toBe(3);
  });

  it("extracts app slug, name, and iconUrl from each addon", () => {
    const responses = new Map<string, Record<string, any>>([
      ["Rising Star", RISINGSTAR_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    const app = sections[0].apps[0];
    expect(app.slug).toBe("com.rising.one");
    expect(app.name).toBe("Rising Star One");
    expect(app.iconUrl).toBe("https://cdn.atlassian.com/com.rising.one.png");
  });

  it("builds surfaceDetail with normalized marketingLabel", () => {
    const responses = new Map<string, Record<string, any>>([
      ["Rising Star", RISINGSTAR_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections[0].surfaceDetail).toBe("marketing_label_rising star");
  });

  it("skips sections with empty addons array", () => {
    const emptyResponse = { _embedded: { addons: [] } };
    const responses = new Map<string, Record<string, any>>([
      ["Spotlight", SPOTLIGHT_RESPONSE],
      ["Bestseller", emptyResponse],
      ["Rising Star", RISINGSTAR_RESPONSE],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.sectionHandle)).toEqual([
      "_collection_spotlight",
      "_collection_risingstar",
    ]);
  });

  it("returns empty array when no responses provided", () => {
    const responses = new Map<string, Record<string, any>>();
    const sections = parseAtlassianFeaturedSections(responses);
    expect(sections).toHaveLength(0);
  });

  it("handles missing _embedded in response gracefully", () => {
    const badResponse = {} as Record<string, any>;
    const responses = new Map<string, Record<string, any>>([
      ["Spotlight", badResponse],
    ]);
    const sections = parseAtlassianFeaturedSections(responses);
    // No addons => empty apps => section is skipped
    expect(sections).toHaveLength(0);
  });
});
