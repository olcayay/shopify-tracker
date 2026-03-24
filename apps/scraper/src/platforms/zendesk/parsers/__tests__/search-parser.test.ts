import { describe, it, expect } from "vitest";
import { parseZendeskSearchPage } from "../search-parser.js";

/** Minimal Algolia multi-index response shape for Zendesk search. */
function makeAlgoliaResponse(overrides: Partial<{
  hits: any[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}> = {}) {
  return {
    results: [
      {
        hits: overrides.hits ?? [],
        nbHits: overrides.nbHits ?? 0,
        page: overrides.page ?? 0,
        nbPages: overrides.nbPages ?? 1,
        hitsPerPage: overrides.hitsPerPage ?? 24,
      },
    ],
  };
}

function makeHit(overrides: Partial<{
  id: number;
  name: string;
  url: string;
  icon_url: string;
  short_description: string;
  rating: { average: number; total_count: number };
}> = {}) {
  return {
    id: overrides.id ?? 100,
    name: overrides.name ?? "Test App",
    url: overrides.url ?? "/apps/support/100/test-app/",
    icon_url: overrides.icon_url ?? "https://cdn.example.com/icon.png",
    short_description: overrides.short_description ?? "A test app",
    rating: overrides.rating ?? { average: 4.5, total_count: 120 },
  };
}

describe("parseZendeskSearchPage", () => {
  it("should parse a basic Algolia search response", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({ id: 972305, name: "Slack", url: "/apps/support/972305/slack/" }),
          makeHit({ id: 849231, name: "Stylo Assist", url: "/apps/support/849231/stylo-assist/" }),
        ],
        nbHits: 42,
        page: 0,
        nbPages: 2,
      }),
    );

    const result = parseZendeskSearchPage(json, "chat", 1);

    expect(result.keyword).toBe("chat");
    expect(result.totalResults).toBe(42);
    expect(result.currentPage).toBe(1);
    expect(result.apps).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
  });

  it("should parse app slug from URL pattern /apps/{product}/{id}/{text-slug}/", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [makeHit({ id: 972305, name: "Slack", url: "/apps/support/972305/slack/" })],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskSearchPage(json, "slack", 1);
    const app = result.apps[0];

    expect(app.appSlug).toBe("972305--slack");
    expect(app.appName).toBe("Slack");
    expect(app.shortDescription).toBe("A test app");
    expect(app.averageRating).toBe(4.5);
    expect(app.ratingCount).toBe(120);
    expect(app.logoUrl).toBe("https://cdn.example.com/icon.png");
    expect(app.position).toBe(1);
    expect(app.isSponsored).toBe(false);
    expect(app.badges).toEqual([]);
  });

  it("should fall back to hit.id and name-derived slug when URL does not match pattern", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({
            id: 55555,
            name: "My Custom App",
            url: "/some/other/path",
          }),
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskSearchPage(json, "custom", 1);
    const app = result.apps[0];

    // Fallback: numericId from hit.id, textSlug from name
    expect(app.appSlug).toBe("55555--my-custom-app");
  });

  it("should assign sequential positions starting at 1", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({ id: 1, name: "First", url: "/apps/support/1/first/" }),
          makeHit({ id: 2, name: "Second", url: "/apps/support/2/second/" }),
          makeHit({ id: 3, name: "Third", url: "/apps/support/3/third/" }),
        ],
        nbHits: 3,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskSearchPage(json, "test", 1);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[2].position).toBe(3);
  });

  it("should detect hasNextPage when page < nbPages - 1", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [makeHit()],
        nbHits: 100,
        page: 0,
        nbPages: 5,
      }),
    );

    const result = parseZendeskSearchPage(json, "crm", 1);
    expect(result.hasNextPage).toBe(true);
  });

  it("should set hasNextPage false on the last page", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [makeHit()],
        nbHits: 100,
        page: 4,
        nbPages: 5,
      }),
    );

    const result = parseZendeskSearchPage(json, "crm", 5);
    expect(result.hasNextPage).toBe(false);
  });

  it("should handle empty hits array", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({ hits: [], nbHits: 0, page: 0, nbPages: 0 }),
    );

    const result = parseZendeskSearchPage(json, "nonexistent", 1);

    expect(result.apps).toHaveLength(0);
    expect(result.totalResults).toBeNull();
    expect(result.hasNextPage).toBe(false);
  });

  it("should handle invalid JSON gracefully", () => {
    const result = parseZendeskSearchPage("not-valid-json{{{", "broken", 1);

    expect(result.keyword).toBe("broken");
    expect(result.totalResults).toBeNull();
    expect(result.apps).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("should handle flat Algolia result (no results wrapper)", () => {
    // Some responses may not have the `results` wrapper
    const flat = {
      hits: [makeHit({ id: 111, name: "Direct", url: "/apps/support/111/direct/" })],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 24,
    };
    const json = JSON.stringify(flat);

    const result = parseZendeskSearchPage(json, "direct", 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appSlug).toBe("111--direct");
  });

  it("should handle missing rating fields", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          {
            id: 999,
            name: "No Rating App",
            url: "/apps/support/999/no-rating/",
            icon_url: "",
            short_description: "",
            rating: null,
          },
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskSearchPage(json, "test", 1);
    const app = result.apps[0];

    expect(app.averageRating).toBe(0);
    expect(app.ratingCount).toBe(0);
    expect(app.shortDescription).toBe("");
    expect(app.logoUrl).toBe("");
  });
});
