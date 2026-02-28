import { describe, it, expect } from "vitest";
import {
  jaccard,
  tokenize,
  extractCategorySlugs,
  extractFeatureHandles,
  computeSimilarityBetween,
  SIMILARITY_WEIGHTS,
  STOP_WORDS,
} from "@shopify-tracking/shared";

describe("jaccard", () => {
  it("returns 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("returns 0 when sets have no overlap", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "b", "c"]))).toBe(1);
  });

  it("computes correct score for partial overlap", () => {
    // intersection = {b}, union = {a, b, c} => 1/3
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(
      1 / 3,
      10
    );
  });

  it("is symmetric", () => {
    const a = new Set(["x", "y", "z"]);
    const b = new Set(["y", "z", "w"]);
    expect(jaccard(a, b)).toBe(jaccard(b, a));
  });

  it("handles one empty set", () => {
    expect(jaccard(new Set(["a"]), new Set())).toBe(0);
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("tokenize", () => {
  it("lowercases text", () => {
    const tokens = tokenize("Hello World");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
  });

  it("filters out stop words", () => {
    const tokens = tokenize("the app is for your store");
    expect(tokens.size).toBe(0);
  });

  it("filters out words shorter than 3 characters", () => {
    const tokens = tokenize("go do it ab");
    expect(tokens.size).toBe(0);
  });

  it("removes punctuation", () => {
    const tokens = tokenize("email-marketing, SMS & automation!");
    expect(tokens.has("email")).toBe(true);
    expect(tokens.has("marketing")).toBe(true);
    expect(tokens.has("sms")).toBe(true);
    expect(tokens.has("automation")).toBe(true);
  });

  it("returns a Set (no duplicates)", () => {
    const tokens = tokenize("test test test data data");
    expect(tokens.size).toBe(2);
    expect(tokens.has("test")).toBe(true);
    expect(tokens.has("data")).toBe(true);
  });
});

describe("extractCategorySlugs", () => {
  it("extracts slugs from category URLs", () => {
    const categories = [
      { url: "https://apps.shopify.com/categories/marketing" },
      { url: "https://apps.shopify.com/categories/sales/email-marketing" },
    ];
    const slugs = extractCategorySlugs(categories);
    expect(slugs.has("marketing")).toBe(true);
    expect(slugs.has("sales")).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it("returns empty set for empty categories", () => {
    expect(extractCategorySlugs([]).size).toBe(0);
  });

  it("skips categories without URL", () => {
    const categories = [{ title: "Marketing" }, { url: "https://apps.shopify.com/categories/sales" }];
    const slugs = extractCategorySlugs(categories);
    expect(slugs.size).toBe(1);
    expect(slugs.has("sales")).toBe(true);
  });
});

describe("extractFeatureHandles", () => {
  it("extracts feature handles from nested structure", () => {
    const categories = [
      {
        subcategories: [
          {
            features: [
              { feature_handle: "email-campaigns" },
              { feature_handle: "sms-marketing" },
            ],
          },
        ],
      },
    ];
    const handles = extractFeatureHandles(categories);
    expect(handles.has("email-campaigns")).toBe(true);
    expect(handles.has("sms-marketing")).toBe(true);
    expect(handles.size).toBe(2);
  });

  it("returns empty set when no subcategories", () => {
    const categories = [{ title: "Marketing" }];
    expect(extractFeatureHandles(categories).size).toBe(0);
  });

  it("handles missing features array", () => {
    const categories = [{ subcategories: [{ title: "Sub" }] }];
    expect(extractFeatureHandles(categories).size).toBe(0);
  });
});

describe("SIMILARITY_WEIGHTS", () => {
  it("has four weights that sum to 1", () => {
    const sum =
      SIMILARITY_WEIGHTS.category +
      SIMILARITY_WEIGHTS.feature +
      SIMILARITY_WEIGHTS.keyword +
      SIMILARITY_WEIGHTS.text;
    expect(sum).toBe(1);
  });

  it("has equal weights of 0.25", () => {
    expect(SIMILARITY_WEIGHTS.category).toBe(0.25);
    expect(SIMILARITY_WEIGHTS.feature).toBe(0.25);
    expect(SIMILARITY_WEIGHTS.keyword).toBe(0.25);
    expect(SIMILARITY_WEIGHTS.text).toBe(0.25);
  });
});

describe("computeSimilarityBetween", () => {
  it("returns all zeros for completely different apps", () => {
    const appA = {
      categorySlugs: new Set(["marketing"]),
      featureHandles: new Set(["email"]),
      keywordIds: new Set(["1"]),
      textTokens: new Set(["automation"]),
    };
    const appB = {
      categorySlugs: new Set(["design"]),
      featureHandles: new Set(["gallery"]),
      keywordIds: new Set(["2"]),
      textTokens: new Set(["photos"]),
    };
    const result = computeSimilarityBetween(appA, appB);
    expect(result.overall).toBe(0);
    expect(result.category).toBe(0);
    expect(result.feature).toBe(0);
    expect(result.keyword).toBe(0);
    expect(result.text).toBe(0);
  });

  it("returns 1 for identical apps", () => {
    const app = {
      categorySlugs: new Set(["marketing", "sales"]),
      featureHandles: new Set(["email", "sms"]),
      keywordIds: new Set(["1", "2"]),
      textTokens: new Set(["automation", "campaign"]),
    };
    const result = computeSimilarityBetween(app, app);
    expect(result.overall).toBe(1);
    expect(result.category).toBe(1);
    expect(result.feature).toBe(1);
    expect(result.keyword).toBe(1);
    expect(result.text).toBe(1);
  });

  it("computes partial similarity correctly", () => {
    const appA = {
      categorySlugs: new Set(["marketing", "sales"]),
      featureHandles: new Set(["email"]),
      keywordIds: new Set(["1", "2", "3"]),
      textTokens: new Set(["automation"]),
    };
    const appB = {
      categorySlugs: new Set(["marketing"]),
      featureHandles: new Set(["email", "sms"]),
      keywordIds: new Set(["2", "3", "4"]),
      textTokens: new Set(["automation", "campaign"]),
    };
    const result = computeSimilarityBetween(appA, appB);

    // category: 1/2 = 0.5
    expect(result.category).toBeCloseTo(0.5, 10);
    // feature: 1/2 = 0.5
    expect(result.feature).toBeCloseTo(0.5, 10);
    // keyword: 2/4 = 0.5
    expect(result.keyword).toBeCloseTo(0.5, 10);
    // text: 1/2 = 0.5
    expect(result.text).toBeCloseTo(0.5, 10);
    // overall: 0.25*0.5 * 4 = 0.5
    expect(result.overall).toBeCloseTo(0.5, 10);
  });

  it("handles empty data gracefully", () => {
    const empty = {
      categorySlugs: new Set<string>(),
      featureHandles: new Set<string>(),
      keywordIds: new Set<string>(),
      textTokens: new Set<string>(),
    };
    const result = computeSimilarityBetween(empty, empty);
    expect(result.overall).toBe(0);
  });
});

describe("STOP_WORDS", () => {
  it("includes common English stop words", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("and")).toBe(true);
    expect(STOP_WORDS.has("for")).toBe(true);
  });

  it("includes Shopify-specific stop words", () => {
    expect(STOP_WORDS.has("app")).toBe(true);
    expect(STOP_WORDS.has("shopify")).toBe(true);
    expect(STOP_WORDS.has("store")).toBe(true);
  });
});
