import { describe, it, expect } from "vitest";
import { parseZendeskCategoryPage } from "../category-parser.js";

/** Helper to build an Algolia multi-index response. */
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
  author_name: string;
  products: string[];
  categories: Array<{ id: number; name: string }>;
  rating: { total_count: number; average: number };
  display_price: string;
  tile_display_price: string;
}> = {}) {
  return {
    id: overrides.id ?? 100,
    name: overrides.name ?? "Test App",
    url: overrides.url ?? "/apps/support/100/test-app/",
    icon_url: overrides.icon_url ?? "https://cdn.example.com/icon.png",
    short_description: overrides.short_description ?? "A test app",
    author_name: overrides.author_name ?? "Test Author",
    products: overrides.products ?? ["support"],
    categories: overrides.categories ?? [{ id: 1, name: "AI and Bots" }],
    rating: overrides.rating ?? { total_count: 50, average: 4.2 },
    display_price: overrides.display_price ?? "$5/month",
    tile_display_price: overrides.tile_display_price ?? "From $5",
  };
}

const TEST_URL = "https://www.zendesk.com/marketplace/apps/?categories.name=AI+and+Bots";

describe("parseZendeskCategoryPage", () => {
  it("should parse a basic Algolia category response", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({ id: 849231, name: "Stylo Assist", url: "/apps/support/849231/stylo-assist/" }),
          makeHit({ id: 972305, name: "Slack", url: "/apps/support/972305/slack/" }),
        ],
        nbHits: 150,
        page: 0,
        nbPages: 7,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);

    expect(result.slug).toBe("ai-and-bots");
    expect(result.url).toBe(TEST_URL);
    expect(result.title).toBe("AI and Bots");
    expect(result.description).toBe("");
    expect(result.appCount).toBe(150);
    expect(result.apps).toHaveLength(2);
    expect(result.subcategoryLinks).toHaveLength(0);
    expect(result.hasNextPage).toBe(true);
  });

  it("should parse app details from category hits", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({
            id: 849231,
            name: "Stylo Assist",
            url: "/apps/support/849231/stylo-assist/",
            short_description: "AI writing assistant",
            rating: { total_count: 36, average: 4.8 },
            tile_display_price: "Free trial",
            display_price: "$10/month",
          }),
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    const app = result.apps[0];

    expect(app.slug).toBe("849231--stylo-assist");
    expect(app.name).toBe("Stylo Assist");
    expect(app.shortDescription).toBe("AI writing assistant");
    expect(app.averageRating).toBe(4.8);
    expect(app.ratingCount).toBe(36);
    expect(app.logoUrl).toBe("https://cdn.example.com/icon.png");
    expect(app.pricingHint).toBe("Free trial");
    expect(app.position).toBe(1);
    expect(app.isSponsored).toBe(false);
    expect(app.badges).toEqual([]);
    expect(app.externalId).toBe("support");
  });

  it("should extract product from URL as externalId", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({ url: "/apps/chat/111/chat-app/" }),
          makeHit({ url: "/apps/sell/222/sell-app/" }),
        ],
        nbHits: 2,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "messaging", TEST_URL);
    expect(result.apps[0].externalId).toBe("chat");
    expect(result.apps[1].externalId).toBe("sell");
  });

  it("should fall back to display_price when tile_display_price is empty", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({
            tile_display_price: "",
            display_price: "$20/month",
            url: "/apps/support/100/test-app/",
          }),
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    expect(result.apps[0].pricingHint).toBe("$20/month");
  });

  it("should set pricingHint to undefined when no pricing available", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({
            tile_display_price: "",
            display_price: "",
            url: "/apps/support/100/test-app/",
          }),
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    expect(result.apps[0].pricingHint).toBeUndefined();
  });

  it("should fall back to hit.id when URL does not match pattern", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({
            id: 77777,
            name: "Weird URL App",
            url: "/some/weird/path",
            products: ["sell"],
          }),
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    const app = result.apps[0];

    expect(app.slug).toBe("77777--weird-url-app");
    // Falls back to products[0]
    expect(app.externalId).toBe("sell");
  });

  it("should use the known display name for known category slugs", () => {
    const json = JSON.stringify(makeAlgoliaResponse({ hits: [], nbHits: 0 }));

    expect(parseZendeskCategoryPage(json, "ecommerce-and-payments", TEST_URL).title).toBe("eComm and Payments");
    expect(parseZendeskCategoryPage(json, "wem", TEST_URL).title).toBe("WEM");
    expect(parseZendeskCategoryPage(json, "agent-productivity", TEST_URL).title).toBe("Agent Productivity");
  });

  it("should fall back to categorySlug for unknown category slugs", () => {
    const json = JSON.stringify(makeAlgoliaResponse({ hits: [], nbHits: 0 }));

    const result = parseZendeskCategoryPage(json, "unknown-category", TEST_URL);
    expect(result.title).toBe("unknown-category");
  });

  it("should assign sequential positions starting at 1", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          makeHit({ id: 1, url: "/apps/support/1/first/" }),
          makeHit({ id: 2, url: "/apps/support/2/second/" }),
          makeHit({ id: 3, url: "/apps/support/3/third/" }),
        ],
        nbHits: 3,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[2].position).toBe(3);
  });

  it("should detect hasNextPage based on page vs nbPages", () => {
    // page 0 of 3 => hasNextPage true
    const page1 = JSON.stringify(
      makeAlgoliaResponse({ hits: [makeHit()], nbHits: 50, page: 0, nbPages: 3 }),
    );
    expect(parseZendeskCategoryPage(page1, "ai-and-bots", TEST_URL).hasNextPage).toBe(true);

    // page 2 of 3 (last page, 0-indexed) => hasNextPage false
    const lastPage = JSON.stringify(
      makeAlgoliaResponse({ hits: [makeHit()], nbHits: 50, page: 2, nbPages: 3 }),
    );
    expect(parseZendeskCategoryPage(lastPage, "ai-and-bots", TEST_URL).hasNextPage).toBe(false);
  });

  it("should handle empty hits array", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({ hits: [], nbHits: 0, page: 0, nbPages: 0 }),
    );

    const result = parseZendeskCategoryPage(json, "translations", TEST_URL);
    expect(result.apps).toHaveLength(0);
    expect(result.appCount).toBeNull();
    expect(result.hasNextPage).toBe(false);
    expect(result.title).toBe("Translations");
  });

  it("should handle invalid JSON gracefully", () => {
    const result = parseZendeskCategoryPage("{{{invalid", "ai-and-bots", TEST_URL);

    expect(result.slug).toBe("ai-and-bots");
    expect(result.url).toBe(TEST_URL);
    expect(result.title).toBe("AI and Bots");
    expect(result.apps).toHaveLength(0);
    expect(result.appCount).toBeNull();
    expect(result.hasNextPage).toBe(false);
  });

  it("should handle flat Algolia result without results wrapper", () => {
    const flat = {
      hits: [makeHit({ id: 200, name: "Flat Result", url: "/apps/support/200/flat-result/" })],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 24,
    };
    const json = JSON.stringify(flat);

    const result = parseZendeskCategoryPage(json, "messaging", TEST_URL);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].slug).toBe("200--flat-result");
  });

  it("should handle missing rating fields on hits", () => {
    const json = JSON.stringify(
      makeAlgoliaResponse({
        hits: [
          {
            id: 999,
            name: "No Rating",
            url: "/apps/support/999/no-rating/",
            icon_url: "",
            short_description: "",
            author_name: "",
            products: [],
            categories: [],
            rating: null,
            display_price: "",
            tile_display_price: "",
          },
        ],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      }),
    );

    const result = parseZendeskCategoryPage(json, "ai-and-bots", TEST_URL);
    const app = result.apps[0];

    expect(app.averageRating).toBe(0);
    expect(app.ratingCount).toBe(0);
  });
});
