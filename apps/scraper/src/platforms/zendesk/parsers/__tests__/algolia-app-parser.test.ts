import { describe, it, expect } from "vitest";
import { parseAppFromAlgolia } from "../algolia-app-parser.js";

describe("parseAppFromAlgolia", () => {
  const baseHit = {
    id: 972305,
    name: "Slack",
    url: "/apps/support/972305/slack/",
    icon_url: "https://cdn.example.com/slack-icon.png",
    short_description: "Get notified about tickets in Slack",
    author_name: "Slack Technologies",
    author_url: "https://slack.com",
    products: ["support", "chat"],
    categories: [
      { id: 1, name: "AI and Bots" },
      { id: 2, name: "Collaboration" },
    ],
    rating: { average: 4.2, total_count: 150 },
    display_price: "$5/month per agent",
    tile_display_price: "From $5",
    date_published: "2020-01-15",
    version: "3.2.1",
  };

  it("extracts basic fields from Algolia hit", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");

    expect(result.name).toBe("Slack");
    expect(result.slug).toBe("972305--slack");
    expect(result.averageRating).toBe(4.2);
    expect(result.ratingCount).toBe(150);
    expect(result.pricingHint).toBe("From $5");
    expect(result.iconUrl).toBe("https://cdn.example.com/slack-icon.png");
  });

  it("extracts developer info", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");

    expect(result.developer).toEqual({
      name: "Slack Technologies",
      url: "https://slack.com",
    });
  });

  it("maps categories to slug/name format", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");
    const cats = result.platformData.categories as any[];

    expect(cats).toHaveLength(2);
    expect(cats[0]).toEqual({ slug: "ai-and-bots", name: "AI and Bots" });
    expect(cats[1]).toEqual({ slug: "collaboration", name: "Collaboration" });
  });

  it("sets source to 'algolia'", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");
    expect(result.platformData.source).toBe("algolia");
  });

  it("extracts product type and sets externalId", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");
    expect(result.platformData.externalId).toBe("support");
    expect(result.platformData.products).toEqual(["support", "chat"]);
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = {
      id: 12345,
      name: "Minimal App",
      url: "",
    };
    const result = parseAppFromAlgolia(minimal, "12345--minimal-app");

    expect(result.name).toBe("Minimal App");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.pricingHint).toBeNull();
    expect(result.iconUrl).toBeNull();
    expect(result.developer).toBeNull();
    expect(result.badges).toEqual([]);
  });

  it("constructs slug from URL when possible", () => {
    const hit = { ...baseHit, url: "/apps/sell/99999/my-cool-app/" };
    const result = parseAppFromAlgolia(hit, "fallback-slug");

    expect(result.slug).toBe("99999--my-cool-app");
    expect(result.platformData.externalId).toBe("sell");
  });

  it("uses fallback slug when URL parsing fails", () => {
    const hit = { ...baseHit, url: "" };
    const result = parseAppFromAlgolia(hit, "972305--slack");

    expect(result.slug).toBe("972305--slack");
  });

  it("sets longDescription and installationInstructions to null", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");
    expect(result.platformData.longDescription).toBeNull();
    expect(result.platformData.installationInstructions).toBeNull();
  });

  it("extracts datePublished and version", () => {
    const result = parseAppFromAlgolia(baseHit, "972305--slack");
    expect(result.platformData.datePublished).toBe("2020-01-15");
    expect(result.platformData.version).toBe("3.2.1");
  });
});
