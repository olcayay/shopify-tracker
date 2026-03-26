import { describe, it, expect } from "vitest";
import { parseAppFromSearchResult } from "../search-app-parser.js";

describe("parseAppFromSearchResult", () => {
  const baseCard = {
    oafId: "a0N4V00000JTeWyUAL",
    title: "Document Generator",
    publisher: "Conga",
    averageRating: 4.7,
    reviewsAmount: 230,
    pricing: "Freemium",
    description: "Generate documents from Salesforce data",
    type: "force/package",
    listingCategories: ["productivity", "sales"],
    sponsored: false,
    logos: [
      { mediaId: "https://cdn.example.com/logo.png", logoType: "Logo" },
      { mediaId: "https://cdn.example.com/big-logo.png", logoType: "Big Logo" },
    ],
  };

  it("extracts basic fields from search card", () => {
    const result = parseAppFromSearchResult(baseCard, "a0N4V00000JTeWyUAL");

    expect(result.name).toBe("Document Generator");
    expect(result.slug).toBe("a0N4V00000JTeWyUAL");
    expect(result.averageRating).toBe(4.7);
    expect(result.ratingCount).toBe(230);
    expect(result.pricingHint).toBe("Freemium");
  });

  it("extracts logo URL (prefers Logo type)", () => {
    const result = parseAppFromSearchResult(baseCard, "a0N4V00000JTeWyUAL");
    expect(result.iconUrl).toBe("https://cdn.example.com/logo.png");
  });

  it("falls back to Big Logo when Logo type not found", () => {
    const card = {
      ...baseCard,
      logos: [{ mediaId: "https://cdn.example.com/big.png", logoType: "Big Logo" }],
    };
    const result = parseAppFromSearchResult(card, "test-id");
    expect(result.iconUrl).toBe("https://cdn.example.com/big.png");
  });

  it("extracts developer from publisher", () => {
    const result = parseAppFromSearchResult(baseCard, "test-id");
    expect(result.developer).toEqual({ name: "Conga" });
  });

  it("sets source to 'search-api'", () => {
    const result = parseAppFromSearchResult(baseCard, "test-id");
    expect(result.platformData.source).toBe("search-api");
  });

  it("preserves listing categories", () => {
    const result = parseAppFromSearchResult(baseCard, "test-id");
    expect(result.platformData.listingCategories).toEqual(["productivity", "sales"]);
  });

  it("sets fields not available in search to null/empty", () => {
    const result = parseAppFromSearchResult(baseCard, "test-id");

    expect(result.platformData.fullDescription).toBeNull();
    expect(result.platformData.highlights).toEqual([]);
    expect(result.platformData.publishedDate).toBeNull();
    expect(result.platformData.languages).toEqual([]);
    expect(result.platformData.productsSupported).toEqual([]);
    expect(result.platformData.pricingPlans).toEqual([]);
    expect(result.platformData.solution).toBeNull();
    expect(result.platformData.plugins).toBeNull();
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = {
      title: "Minimal",
    };
    const result = parseAppFromSearchResult(minimal, "fallback-slug");

    expect(result.name).toBe("Minimal");
    expect(result.slug).toBe("fallback-slug");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.pricingHint).toBeNull();
    expect(result.iconUrl).toBeNull();
    expect(result.developer).toBeNull();
  });

  it("uses oafId from card if available", () => {
    const result = parseAppFromSearchResult(baseCard, "different-slug");
    expect(result.slug).toBe("a0N4V00000JTeWyUAL");
  });

  it("preserves sponsored flag", () => {
    const sponsored = { ...baseCard, sponsored: true };
    const result = parseAppFromSearchResult(sponsored, "test-id");
    expect(result.platformData.sponsored).toBe(true);
  });

  it("preserves technology type", () => {
    const result = parseAppFromSearchResult(baseCard, "test-id");
    expect(result.platformData.technology).toBe("force/package");
  });
});
