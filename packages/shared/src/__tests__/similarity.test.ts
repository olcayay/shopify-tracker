import { describe, it, expect } from "vitest";
import {
  jaccard,
  tokenize,
  extractCategorySlugs,
  extractFeatureHandles,
  extractCategorySlugsFromPlatformData,
  computeSimilarityBetween,
  getSimilarityWeights,
  getSimilarityStopWords,
  SIMILARITY_WEIGHTS,
  COMMON_SIMILARITY_STOP_WORDS,
  STOP_WORDS,
} from "../similarity.js";

// ---------------------------------------------------------------------------
// jaccard
// ---------------------------------------------------------------------------
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
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 10);
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

  it("handles single-element identical sets", () => {
    expect(jaccard(new Set(["x"]), new Set(["x"]))).toBe(1);
  });

  it("handles large sets correctly", () => {
    const a = new Set(Array.from({ length: 100 }, (_, i) => `item-${i}`));
    const b = new Set(Array.from({ length: 100 }, (_, i) => `item-${i + 50}`));
    // intersection = 50, union = 150
    expect(jaccard(a, b)).toBeCloseTo(50 / 150, 10);
  });

  it("optimizes by iterating over smaller set", () => {
    const small = new Set(["a"]);
    const large = new Set(["a", "b", "c", "d", "e"]);
    // intersection = 1, union = 5
    expect(jaccard(small, large)).toBeCloseTo(0.2, 10);
    expect(jaccard(large, small)).toBeCloseTo(0.2, 10);
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------
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
  });

  it("uses custom stop words when provided", () => {
    const custom = new Set(["hello"]);
    const tokens = tokenize("hello world testing", custom);
    expect(tokens.has("hello")).toBe(false);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.has("testing")).toBe(true);
  });

  it("returns empty set for empty string", () => {
    expect(tokenize("").size).toBe(0);
  });

  it("handles only whitespace", () => {
    expect(tokenize("   ").size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getSimilarityWeights
// ---------------------------------------------------------------------------
describe("getSimilarityWeights", () => {
  it("returns default weights when no platform specified", () => {
    const w = getSimilarityWeights();
    expect(w).toEqual(SIMILARITY_WEIGHTS);
  });

  it("returns shopify weights", () => {
    const w = getSimilarityWeights("shopify");
    expect(w.category).toBe(0.25);
    expect(w.feature).toBe(0.25);
    expect(w.keyword).toBe(0.25);
    expect(w.text).toBe(0.25);
  });

  it("returns salesforce weights (no feature weight)", () => {
    const w = getSimilarityWeights("salesforce");
    expect(w.feature).toBe(0);
    expect(w.category + w.feature + w.keyword + w.text).toBeCloseTo(1, 10);
  });

  it("returns canva weights (only category + text)", () => {
    const w = getSimilarityWeights("canva");
    expect(w.category).toBe(0.5);
    expect(w.text).toBe(0.5);
    expect(w.feature).toBe(0);
    expect(w.keyword).toBe(0);
  });

  it("returns default weights for unknown platform", () => {
    const w = getSimilarityWeights("unknown_platform");
    expect(w).toEqual(SIMILARITY_WEIGHTS);
  });

  it("all 10 platforms have weights that sum to 1", () => {
    const platforms = [
      "shopify", "salesforce", "canva", "wix", "wordpress",
      "google_workspace", "atlassian", "zoom", "zoho", "zendesk",
    ];
    for (const p of platforms) {
      const w = getSimilarityWeights(p);
      const sum = w.category + w.feature + w.keyword + w.text;
      expect(sum).toBeCloseTo(1, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// getSimilarityStopWords
// ---------------------------------------------------------------------------
describe("getSimilarityStopWords", () => {
  it("returns common stop words when no platform given", () => {
    const sw = getSimilarityStopWords();
    expect(sw.has("the")).toBe(true);
    expect(sw.has("and")).toBe(true);
  });

  it("includes shopify-specific stop words", () => {
    const sw = getSimilarityStopWords("shopify");
    expect(sw.has("shopify")).toBe(true);
    expect(sw.has("store")).toBe(true);
    expect(sw.has("the")).toBe(true); // still has common
  });

  it("includes salesforce-specific stop words", () => {
    const sw = getSimilarityStopWords("salesforce");
    expect(sw.has("salesforce")).toBe(true);
    expect(sw.has("appexchange")).toBe(true);
  });

  it("includes canva-specific stop words", () => {
    const sw = getSimilarityStopWords("canva");
    expect(sw.has("canva")).toBe(true);
    expect(sw.has("design")).toBe(true);
  });

  it("includes wix-specific stop words", () => {
    const sw = getSimilarityStopWords("wix");
    expect(sw.has("wix")).toBe(true);
    expect(sw.has("website")).toBe(true);
  });

  it("includes wordpress-specific stop words", () => {
    const sw = getSimilarityStopWords("wordpress");
    expect(sw.has("wordpress")).toBe(true);
    expect(sw.has("plugin")).toBe(true);
  });

  it("includes google_workspace-specific stop words", () => {
    const sw = getSimilarityStopWords("google_workspace");
    expect(sw.has("google")).toBe(true);
    expect(sw.has("workspace")).toBe(true);
  });

  it("includes atlassian-specific stop words", () => {
    const sw = getSimilarityStopWords("atlassian");
    expect(sw.has("atlassian")).toBe(true);
    expect(sw.has("jira")).toBe(true);
    expect(sw.has("confluence")).toBe(true);
  });

  it("includes zoom-specific stop words", () => {
    const sw = getSimilarityStopWords("zoom");
    expect(sw.has("zoom")).toBe(true);
    expect(sw.has("meeting")).toBe(true);
  });

  it("includes zoho-specific stop words", () => {
    const sw = getSimilarityStopWords("zoho");
    expect(sw.has("zoho")).toBe(true);
    expect(sw.has("extension")).toBe(true);
  });

  it("includes zendesk-specific stop words", () => {
    const sw = getSimilarityStopWords("zendesk");
    expect(sw.has("zendesk")).toBe(true);
    expect(sw.has("ticket")).toBe(true);
  });

  it("returns only common stop words for unknown platform", () => {
    const sw = getSimilarityStopWords("unknown");
    expect(sw.size).toBe(COMMON_SIMILARITY_STOP_WORDS.size);
  });

  it("STOP_WORDS is shopify-specific (deprecated export)", () => {
    expect(STOP_WORDS.has("shopify")).toBe(true);
    expect(STOP_WORDS.has("store")).toBe(true);
    expect(STOP_WORDS.has("the")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractCategorySlugs
// ---------------------------------------------------------------------------
describe("extractCategorySlugs", () => {
  it("extracts slugs from Shopify category URLs", () => {
    const cats = [
      { url: "https://apps.shopify.com/categories/marketing" },
      { url: "https://apps.shopify.com/categories/sales/email-marketing" },
    ];
    const slugs = extractCategorySlugs(cats);
    expect(slugs.has("marketing")).toBe(true);
    expect(slugs.has("sales")).toBe(true);
  });

  it("returns empty set for empty array", () => {
    expect(extractCategorySlugs([]).size).toBe(0);
  });

  it("skips categories without URL (Shopify)", () => {
    const cats = [{ title: "Marketing" }, { url: "https://apps.shopify.com/categories/sales" }];
    const slugs = extractCategorySlugs(cats);
    expect(slugs.size).toBe(1);
    expect(slugs.has("sales")).toBe(true);
  });

  it("uses slug directly for non-Shopify platforms", () => {
    const cats = [{ slug: "crm" }, { slug: "analytics" }];
    const slugs = extractCategorySlugs(cats, "salesforce");
    expect(slugs.has("crm")).toBe(true);
    expect(slugs.has("analytics")).toBe(true);
  });

  it("falls back to url for non-Shopify when slug missing", () => {
    const cats = [{ url: "some-url" }];
    const slugs = extractCategorySlugs(cats, "wix");
    expect(slugs.has("some-url")).toBe(true);
  });

  it("treats undefined platform as Shopify", () => {
    const cats = [{ url: "https://apps.shopify.com/categories/marketing" }];
    const slugs = extractCategorySlugs(cats, undefined);
    expect(slugs.has("marketing")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractFeatureHandles
// ---------------------------------------------------------------------------
describe("extractFeatureHandles", () => {
  it("extracts feature handles from nested structure", () => {
    const cats = [
      {
        subcategories: [
          { features: [{ feature_handle: "email-campaigns" }, { feature_handle: "sms-marketing" }] },
        ],
      },
    ];
    const handles = extractFeatureHandles(cats);
    expect(handles.has("email-campaigns")).toBe(true);
    expect(handles.has("sms-marketing")).toBe(true);
    expect(handles.size).toBe(2);
  });

  it("returns empty set for non-Shopify platforms", () => {
    const cats = [
      { subcategories: [{ features: [{ feature_handle: "test" }] }] },
    ];
    expect(extractFeatureHandles(cats, "salesforce").size).toBe(0);
    expect(extractFeatureHandles(cats, "canva").size).toBe(0);
    expect(extractFeatureHandles(cats, "wix").size).toBe(0);
  });

  it("returns empty set when no subcategories", () => {
    expect(extractFeatureHandles([{ title: "Marketing" }]).size).toBe(0);
  });

  it("handles missing features array", () => {
    expect(extractFeatureHandles([{ subcategories: [{ title: "Sub" }] }]).size).toBe(0);
  });

  it("works with Shopify platform explicitly", () => {
    const cats = [
      { subcategories: [{ features: [{ feature_handle: "test-handle" }] }] },
    ];
    expect(extractFeatureHandles(cats, "shopify").has("test-handle")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractCategorySlugsFromPlatformData
// ---------------------------------------------------------------------------
describe("extractCategorySlugsFromPlatformData", () => {
  it("extracts WordPress tags", () => {
    const data = { tags: { seo: "SEO", analytics: "Analytics" } };
    const slugs = extractCategorySlugsFromPlatformData(data, "wordpress");
    expect(slugs.has("seo")).toBe(true);
    expect(slugs.has("analytics")).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it("returns empty for WordPress with no tags", () => {
    expect(extractCategorySlugsFromPlatformData({}, "wordpress").size).toBe(0);
    expect(extractCategorySlugsFromPlatformData({ tags: null }, "wordpress").size).toBe(0);
  });

  it("returns empty for WordPress with non-object tags", () => {
    expect(extractCategorySlugsFromPlatformData({ tags: "string" }, "wordpress").size).toBe(0);
  });

  it("extracts Wix categories by slug", () => {
    const data = { categories: [{ slug: "marketing" }, { slug: "analytics" }] };
    const slugs = extractCategorySlugsFromPlatformData(data, "wix");
    expect(slugs.has("marketing")).toBe(true);
    expect(slugs.has("analytics")).toBe(true);
  });

  it("returns empty for Wix with non-array categories", () => {
    expect(extractCategorySlugsFromPlatformData({}, "wix").size).toBe(0);
    expect(extractCategorySlugsFromPlatformData({ categories: "not-array" }, "wix").size).toBe(0);
  });

  it("filters Wix categories without slug", () => {
    const data = { categories: [{ slug: "ok" }, { name: "no-slug" }] };
    const slugs = extractCategorySlugsFromPlatformData(data, "wix");
    expect(slugs.size).toBe(1);
  });

  it("extracts Canva topics with marketplace_topic prefix", () => {
    const data = {
      topics: ["marketplace_topic.photo_editing", "marketplace_topic.ai_tools", "other_topic.ignored"],
    };
    const slugs = extractCategorySlugsFromPlatformData(data, "canva");
    expect(slugs.has("photo-editing")).toBe(true);
    expect(slugs.has("ai-tools")).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it("returns empty for Canva with non-array topics", () => {
    expect(extractCategorySlugsFromPlatformData({}, "canva").size).toBe(0);
    expect(extractCategorySlugsFromPlatformData({ topics: "string" }, "canva").size).toBe(0);
  });

  it("extracts Salesforce listing categories", () => {
    const data = { listingCategories: ["CRM", "Sales", "Marketing"] };
    const slugs = extractCategorySlugsFromPlatformData(data, "salesforce");
    expect(slugs.size).toBe(3);
    expect(slugs.has("CRM")).toBe(true);
  });

  it("returns empty for Salesforce with no listing categories", () => {
    expect(extractCategorySlugsFromPlatformData({}, "salesforce").size).toBe(0);
  });

  it("extracts Google Workspace single category", () => {
    const data = { category: "project-management" };
    const slugs = extractCategorySlugsFromPlatformData(data, "google_workspace");
    expect(slugs.size).toBe(1);
    expect(slugs.has("project-management")).toBe(true);
  });

  it("returns empty for Google Workspace with no category", () => {
    expect(extractCategorySlugsFromPlatformData({}, "google_workspace").size).toBe(0);
  });

  it("extracts Atlassian categories by slug or key", () => {
    const data = {
      categories: [{ slug: "dev-tools" }, { key: "project-management" }, { slug: "ci-cd" }],
    };
    const slugs = extractCategorySlugsFromPlatformData(data, "atlassian");
    expect(slugs.size).toBe(3);
    expect(slugs.has("dev-tools")).toBe(true);
    expect(slugs.has("project-management")).toBe(true);
  });

  it("returns empty for Atlassian with non-array categories", () => {
    expect(extractCategorySlugsFromPlatformData({}, "atlassian").size).toBe(0);
  });

  it("extracts Zoom categories by slug", () => {
    const data = { categories: [{ slug: "collaboration" }, { slug: "productivity" }] };
    const slugs = extractCategorySlugsFromPlatformData(data, "zoom");
    expect(slugs.size).toBe(2);
  });

  it("extracts Zoho categories by slug", () => {
    const data = { categories: [{ slug: "crm" }] };
    const slugs = extractCategorySlugsFromPlatformData(data, "zoho");
    expect(slugs.has("crm")).toBe(true);
  });

  it("extracts Zendesk categories by slug", () => {
    const data = { categories: [{ slug: "communication" }, { slug: "analytics" }] };
    const slugs = extractCategorySlugsFromPlatformData(data, "zendesk");
    expect(slugs.size).toBe(2);
  });

  it("returns empty for unknown platform", () => {
    expect(extractCategorySlugsFromPlatformData({ foo: "bar" }, "unknown").size).toBe(0);
  });

  it("returns empty for Shopify (handled via extractCategorySlugs instead)", () => {
    expect(extractCategorySlugsFromPlatformData({}, "shopify").size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SIMILARITY_WEIGHTS
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// computeSimilarityBetween
// ---------------------------------------------------------------------------
describe("computeSimilarityBetween", () => {
  const makeData = (overrides: Partial<{
    categorySlugs: Set<string>;
    featureHandles: Set<string>;
    keywordIds: Set<string>;
    textTokens: Set<string>;
  }> = {}) => ({
    categorySlugs: new Set<string>(),
    featureHandles: new Set<string>(),
    keywordIds: new Set<string>(),
    textTokens: new Set<string>(),
    ...overrides,
  });

  it("returns all zeros for completely different apps", () => {
    const a = makeData({
      categorySlugs: new Set(["marketing"]),
      featureHandles: new Set(["email"]),
      keywordIds: new Set(["1"]),
      textTokens: new Set(["automation"]),
    });
    const b = makeData({
      categorySlugs: new Set(["design"]),
      featureHandles: new Set(["gallery"]),
      keywordIds: new Set(["2"]),
      textTokens: new Set(["photos"]),
    });
    const result = computeSimilarityBetween(a, b);
    expect(result.overall).toBe(0);
  });

  it("returns 1 for identical apps", () => {
    const app = makeData({
      categorySlugs: new Set(["marketing", "sales"]),
      featureHandles: new Set(["email", "sms"]),
      keywordIds: new Set(["1", "2"]),
      textTokens: new Set(["automation", "campaign"]),
    });
    const result = computeSimilarityBetween(app, app);
    expect(result.overall).toBe(1);
  });

  it("computes partial similarity correctly", () => {
    const a = makeData({
      categorySlugs: new Set(["marketing", "sales"]),
      featureHandles: new Set(["email"]),
      keywordIds: new Set(["1", "2", "3"]),
      textTokens: new Set(["automation"]),
    });
    const b = makeData({
      categorySlugs: new Set(["marketing"]),
      featureHandles: new Set(["email", "sms"]),
      keywordIds: new Set(["2", "3", "4"]),
      textTokens: new Set(["automation", "campaign"]),
    });
    const result = computeSimilarityBetween(a, b);
    expect(result.category).toBeCloseTo(0.5, 10);
    expect(result.feature).toBeCloseTo(0.5, 10);
    expect(result.keyword).toBeCloseTo(0.5, 10);
    expect(result.text).toBeCloseTo(0.5, 10);
    expect(result.overall).toBeCloseTo(0.5, 10);
  });

  it("handles empty data gracefully", () => {
    const empty = makeData();
    const result = computeSimilarityBetween(empty, empty);
    expect(result.overall).toBe(0);
  });

  it("uses platform-specific weights for Canva", () => {
    const a = makeData({
      categorySlugs: new Set(["design"]),
      textTokens: new Set(["photo"]),
      keywordIds: new Set(["1"]),
    });
    const b = makeData({
      categorySlugs: new Set(["design"]),
      textTokens: new Set(["photo"]),
      keywordIds: new Set(["2"]), // different keyword — but keyword weight is 0 for canva
    });
    const result = computeSimilarityBetween(a, b, "canva");
    // category=1, text=1, feature=0(empty), keyword=0(weight 0)
    // overall = 0.5*1 + 0.5*1 = 1
    expect(result.overall).toBeCloseTo(1, 10);
  });

  it("uses platform-specific weights for Salesforce", () => {
    const a = makeData({
      categorySlugs: new Set(["crm"]),
      featureHandles: new Set(["unique"]), // feature weight = 0 for salesforce
    });
    const b = makeData({
      categorySlugs: new Set(["crm"]),
      featureHandles: new Set(["other"]),
    });
    const result = computeSimilarityBetween(a, b, "salesforce");
    // category: 1 * 0.35 = 0.35, feature: 0 * 0 = 0, keyword: 0 * 0.30 = 0, text: 0 * 0.35 = 0
    expect(result.overall).toBeCloseTo(0.35, 10);
  });
});
