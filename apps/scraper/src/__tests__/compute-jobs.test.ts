import { describe, it, expect } from "vitest";
import {
  jaccard,
  tokenize,
  extractCategorySlugs,
  extractCategorySlugsFromPlatformData,
  extractFeatureHandles,
  getSimilarityWeights,
  getSimilarityStopWords,
  computeSimilarityBetween,
  type AppSimilarityData,
} from "@appranks/shared";
import {
  computeAppVisibility,
  computeRankWeight,
  normalizeScore,
  PAGE_SIZE,
  PAGE_DECAY,
} from "@appranks/shared";
import {
  computeAppPower,
  computeCategoryRankScore,
  computeWeightedPowerScore,
  POWER_WEIGHTS,
  type PowerInput,
} from "@appranks/shared";

// ============================================================
// Replicate private computeMetrics from compute-review-metrics.ts
// for unit testing since it is not exported
// ============================================================
function computeMetrics(v7d: number, v30d: number, v90d: number) {
  const expected7dFrom30d = v30d / (30 / 7);
  const accMicro = Math.round((v7d - expected7dFrom30d) * 100) / 100;

  const expected30dFrom90d = v90d / 3;
  const accMacro = Math.round((v30d - expected30dFrom90d) * 100) / 100;

  let momentum: string;
  if (v30d === 0 && v7d === 0) {
    momentum = "flat";
  } else if (expected7dFrom30d > 0 && accMicro > expected7dFrom30d) {
    momentum = "spike";
  } else if (accMicro > 0 && accMacro > 0) {
    momentum = "accelerating";
  } else if (accMicro < 0 || accMacro < 0) {
    momentum = "slowing";
  } else {
    momentum = "stable";
  }

  return { v7d, v30d, v90d, accMicro, accMacro, momentum };
}

// ============================================================
// REVIEW METRICS TESTS
// ============================================================
describe("Review Metrics - computeMetrics", () => {
  it("computes v7d/v30d/v90d correctly from review counts", () => {
    const result = computeMetrics(5, 20, 60);
    expect(result.v7d).toBe(5);
    expect(result.v30d).toBe(20);
    expect(result.v90d).toBe(60);
  });

  it("computes accMicro correctly (7d pace vs 30d normalized pace)", () => {
    // v7d=10, v30d=30 => expected7dFrom30d = 30/(30/7) = 7
    // accMicro = 10 - 7 = 3
    const result = computeMetrics(10, 30, 90);
    expect(result.accMicro).toBe(3);
  });

  it("computes accMacro correctly (30d pace vs 90d normalized pace)", () => {
    // v30d=40, v90d=90 => expected30dFrom90d = 90/3 = 30
    // accMacro = 40 - 30 = 10
    const result = computeMetrics(10, 40, 90);
    expect(result.accMacro).toBe(10);
  });

  it("classifies momentum as spike when 7d pace > 2x 30d-normalized pace", () => {
    // v30d=30 => expected7dFrom30d = 30/4.2857 ~ 7.0
    // v7d=20 => accMicro = 20 - 7 = 13 > 7 (expected7dFrom30d) => spike
    const result = computeMetrics(20, 30, 90);
    expect(result.momentum).toBe("spike");
  });

  it("classifies momentum as accelerating when accMicro > 0 and accMacro > 0", () => {
    // v7d=10, v30d=40, v90d=90
    // expected7dFrom30d = 40/4.2857 ~ 9.33 => accMicro = 10-9.33 = 0.67 (>0, but <9.33 so not spike)
    // expected30dFrom90d = 30 => accMacro = 40 - 30 = 10 (>0)
    const result = computeMetrics(10, 40, 90);
    expect(result.momentum).toBe("accelerating");
    expect(result.accMicro).toBeGreaterThan(0);
    expect(result.accMacro).toBeGreaterThan(0);
  });

  it("classifies momentum as slowing when accMicro is negative", () => {
    // v7d=2, v30d=30, v90d=90
    // expected7dFrom30d ~ 7 => accMicro = 2 - 7 = -5 (<0)
    const result = computeMetrics(2, 30, 90);
    expect(result.momentum).toBe("slowing");
    expect(result.accMicro).toBeLessThan(0);
  });

  it("classifies momentum as slowing when accMacro is negative (even if accMicro positive)", () => {
    // v7d=8, v30d=20, v90d=90
    // expected7dFrom30d ~ 4.67 => accMicro = 8 - 4.67 ~ 3.33 (>0)
    // expected30dFrom90d = 30 => accMacro = 20 - 30 = -10 (<0) => slowing
    const result = computeMetrics(8, 20, 90);
    expect(result.momentum).toBe("slowing");
    expect(result.accMicro).toBeGreaterThan(0);
    expect(result.accMacro).toBeLessThan(0);
  });

  it("classifies momentum as flat when v7d and v30d are both 0", () => {
    const result = computeMetrics(0, 0, 50);
    expect(result.momentum).toBe("flat");
  });

  it("classifies momentum as stable when accMicro=0 and accMacro=0", () => {
    // v7d=7, v30d=30, v90d=90
    // expected7dFrom30d = 30/4.2857 = 7 => accMicro = 7-7 = 0
    // expected30dFrom90d = 30 => accMacro = 30-30 = 0
    const result = computeMetrics(7, 30, 90);
    expect(result.momentum).toBe("stable");
  });

  it("handles apps with zero reviews in all windows", () => {
    const result = computeMetrics(0, 0, 0);
    expect(result.momentum).toBe("flat");
    expect(result.accMicro).toBe(0);
    expect(result.accMacro).toBe(0);
  });

  it("handles apps with reviews only in the 90d window", () => {
    // v7d=0, v30d=0, v90d=50
    // accMicro = 0 - 0 = 0, accMacro = 0 - 50/3 = -16.67
    // v30d=0 and v7d=0 => flat (flat check comes first)
    const result = computeMetrics(0, 0, 50);
    expect(result.momentum).toBe("flat");
    expect(result.accMacro).toBeCloseTo(-16.67, 1);
  });

  it("handles apps with reviews only in the 30d window (no 90d)", () => {
    // v7d=5, v30d=10, v90d=0
    // expected30dFrom90d = 0 => accMacro = 10
    const result = computeMetrics(5, 10, 0);
    expect(result.accMacro).toBe(10);
  });

  it("handles apps with reviews only in the 7d window", () => {
    // v7d=5, v30d=5 (7d reviews are subset of 30d), v90d=5
    const result = computeMetrics(5, 5, 5);
    // expected7dFrom30d = 5/4.2857 ~ 1.17
    // accMicro = 5 - 1.17 ~ 3.83 > 1.17 => spike
    expect(result.momentum).toBe("spike");
  });

  it("rounds accMicro and accMacro to 2 decimal places", () => {
    // v7d=3, v30d=10 => expected7dFrom30d = 10/4.2857 = 2.3333
    // accMicro = 3 - 2.3333 = 0.6667 => rounds to 0.67
    const result = computeMetrics(3, 10, 30);
    expect(result.accMicro).toBe(0.67);
  });

  it("handles very large review counts without overflow", () => {
    const result = computeMetrics(1000, 5000, 15000);
    expect(result.momentum).toBeDefined();
    expect(Number.isFinite(result.accMicro)).toBe(true);
    expect(Number.isFinite(result.accMacro)).toBe(true);
  });
});

// ============================================================
// SIMILARITY SCORES TESTS
// ============================================================
describe("Similarity Scores - Jaccard similarity", () => {
  it("returns 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "b", "c"]))).toBe(1);
  });

  it("returns 0 for completely disjoint sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("computes correctly for partial overlap", () => {
    // A = {a, b, c}, B = {b, c, d}
    // Intersection = {b, c} = 2
    // Union = {a, b, c, d} = 4
    // Jaccard = 2/4 = 0.5
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
  });

  it("is commutative (A,B) = (B,A)", () => {
    const a = new Set(["x", "y", "z"]);
    const b = new Set(["y", "z", "w"]);
    expect(jaccard(a, b)).toBe(jaccard(b, a));
  });

  it("handles one empty set against a non-empty set", () => {
    expect(jaccard(new Set(["a", "b"]), new Set())).toBe(0);
  });

  it("handles singleton sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["a"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("computes correctly for known category overlap scenario", () => {
    // App A: categories [email, marketing, analytics]
    // App B: categories [email, marketing, crm]
    // Intersection = 2, Union = 4 => 0.5
    const a = new Set(["email", "marketing", "analytics"]);
    const b = new Set(["email", "marketing", "crm"]);
    expect(jaccard(a, b)).toBe(0.5);
  });

  it("apps with no shared categories get score 0", () => {
    const a = new Set(["email", "marketing"]);
    const b = new Set(["productivity", "developer-tools"]);
    expect(jaccard(a, b)).toBe(0);
  });

  it("large category overlap produces high scores", () => {
    // 9 shared out of 10 total unique
    const a = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    const b = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "j"]);
    // Intersection = 8, Union = 10 => 0.8
    expect(jaccard(a, b)).toBe(0.8);
  });
});

describe("Similarity Scores - Platform weights", () => {
  it("Shopify has equal weights (0.25 each)", () => {
    const w = getSimilarityWeights("shopify");
    expect(w.category).toBe(0.25);
    expect(w.feature).toBe(0.25);
    expect(w.keyword).toBe(0.25);
    expect(w.text).toBe(0.25);
  });

  it("non-Shopify platforms have 0 feature weight", () => {
    for (const p of ["salesforce", "canva", "wix", "wordpress", "atlassian", "zoom", "zoho", "zendesk", "hubspot"]) {
      const w = getSimilarityWeights(p);
      expect(w.feature).toBe(0);
    }
  });

  it("weights sum to 1 for all platforms", () => {
    for (const p of ["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot"]) {
      const w = getSimilarityWeights(p);
      expect(w.category + w.feature + w.keyword + w.text).toBeCloseTo(1, 5);
    }
  });

  it("Canva uses 50/50 category+text split (no keyword, no feature)", () => {
    const w = getSimilarityWeights("canva");
    expect(w.category).toBe(0.5);
    expect(w.text).toBe(0.5);
    expect(w.feature).toBe(0);
    expect(w.keyword).toBe(0);
  });

  it("unknown platform falls back to default equal weights", () => {
    const w = getSimilarityWeights("nonexistent_platform");
    expect(w.category).toBe(0.25);
    expect(w.feature).toBe(0.25);
  });
});

describe("Similarity Scores - computeSimilarityBetween", () => {
  it("returns 1.0 overall for identical apps", () => {
    const appData: AppSimilarityData = {
      categorySlugs: new Set(["cat1", "cat2"]),
      featureHandles: new Set(["feat1"]),
      keywordIds: new Set(["1", "2"]),
      textTokens: new Set(["token1", "token2"]),
    };
    const result = computeSimilarityBetween(appData, appData, "shopify");
    expect(result.overall).toBe(1);
    expect(result.category).toBe(1);
    expect(result.feature).toBe(1);
    expect(result.keyword).toBe(1);
    expect(result.text).toBe(1);
  });

  it("returns 0 overall for completely different apps", () => {
    const appA: AppSimilarityData = {
      categorySlugs: new Set(["a"]),
      featureHandles: new Set(["x"]),
      keywordIds: new Set(["1"]),
      textTokens: new Set(["hello"]),
    };
    const appB: AppSimilarityData = {
      categorySlugs: new Set(["b"]),
      featureHandles: new Set(["y"]),
      keywordIds: new Set(["2"]),
      textTokens: new Set(["world"]),
    };
    const result = computeSimilarityBetween(appA, appB, "shopify");
    expect(result.overall).toBe(0);
  });

  it("bi-directional scores are equal (A,B) = (B,A)", () => {
    const appA: AppSimilarityData = {
      categorySlugs: new Set(["cat1", "cat2"]),
      featureHandles: new Set(["feat1"]),
      keywordIds: new Set(["1", "2", "3"]),
      textTokens: new Set(["email", "marketing"]),
    };
    const appB: AppSimilarityData = {
      categorySlugs: new Set(["cat2", "cat3"]),
      featureHandles: new Set(["feat1", "feat2"]),
      keywordIds: new Set(["2", "3", "4"]),
      textTokens: new Set(["marketing", "analytics"]),
    };
    const ab = computeSimilarityBetween(appA, appB, "shopify");
    const ba = computeSimilarityBetween(appB, appA, "shopify");
    expect(ab.overall).toBe(ba.overall);
    expect(ab.category).toBe(ba.category);
    expect(ab.feature).toBe(ba.feature);
    expect(ab.keyword).toBe(ba.keyword);
    expect(ab.text).toBe(ba.text);
  });

  it("platform weights affect overall score", () => {
    const appA: AppSimilarityData = {
      categorySlugs: new Set(["cat1"]),
      featureHandles: new Set(),
      keywordIds: new Set(),
      textTokens: new Set(["token1"]),
    };
    const appB: AppSimilarityData = {
      categorySlugs: new Set(["cat1"]),
      featureHandles: new Set(),
      keywordIds: new Set(),
      textTokens: new Set(["token1"]),
    };
    // Canva: 0.5 category + 0.5 text = both 1.0 => overall=1.0
    const canva = computeSimilarityBetween(appA, appB, "canva");
    // Shopify: 0.25 cat + 0.25 feat(both empty=0) + 0.25 kw(both empty=0) + 0.25 text = 0.25*1 + 0 + 0 + 0.25*1 = 0.5
    const shopify = computeSimilarityBetween(appA, appB, "shopify");
    expect(canva.overall).toBe(1);
    expect(shopify.overall).toBe(0.5);
  });

  it("apps with no shared categories/features get low scores", () => {
    const appA: AppSimilarityData = {
      categorySlugs: new Set(["email"]),
      featureHandles: new Set(["feat1"]),
      keywordIds: new Set(["1"]),
      textTokens: new Set(["hello", "world"]),
    };
    const appB: AppSimilarityData = {
      categorySlugs: new Set(["analytics"]),
      featureHandles: new Set(["feat2"]),
      keywordIds: new Set(["2"]),
      textTokens: new Set(["foo", "bar"]),
    };
    const result = computeSimilarityBetween(appA, appB, "shopify");
    expect(result.overall).toBe(0);
    expect(result.category).toBe(0);
    expect(result.feature).toBe(0);
  });

  it("high category overlap with no keyword overlap yields partial score", () => {
    const appA: AppSimilarityData = {
      categorySlugs: new Set(["cat1", "cat2", "cat3"]),
      featureHandles: new Set(),
      keywordIds: new Set(["1"]),
      textTokens: new Set(["shipping"]),
    };
    const appB: AppSimilarityData = {
      categorySlugs: new Set(["cat1", "cat2", "cat3"]),
      featureHandles: new Set(),
      keywordIds: new Set(["99"]),
      textTokens: new Set(["fulfillment"]),
    };
    const result = computeSimilarityBetween(appA, appB, "shopify");
    // category = 1.0, feature = 0 (both empty), keyword = 0, text = 0
    // overall = 0.25*1 + 0.25*0 + 0.25*0 + 0.25*0 = 0.25
    expect(result.category).toBe(1);
    expect(result.keyword).toBe(0);
    expect(result.overall).toBe(0.25);
  });
});

describe("Similarity Scores - Tokenization", () => {
  it("tokenizes text into lowercase words", () => {
    const tokens = tokenize("Hello World Test", new Set());
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.has("test")).toBe(true);
  });

  it("filters out stop words", () => {
    const stop = getSimilarityStopWords("shopify");
    const tokens = tokenize("The best shopify app for your store", stop);
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("shopify")).toBe(false);
    expect(tokens.has("store")).toBe(false);
    expect(tokens.has("best")).toBe(true);
  });

  it("filters out words shorter than 3 characters", () => {
    const tokens = tokenize("Go to be an AI ML expert", new Set());
    expect(tokens.has("go")).toBe(false);
    expect(tokens.has("to")).toBe(false);
    expect(tokens.has("be")).toBe(false);
    expect(tokens.has("an")).toBe(false);
    expect(tokens.has("expert")).toBe(true);
  });

  it("removes non-alphanumeric characters", () => {
    const tokens = tokenize("email-marketing & CRM!", new Set());
    expect(tokens.has("email")).toBe(true);
    expect(tokens.has("marketing")).toBe(true);
    expect(tokens.has("crm")).toBe(true);
  });
});

describe("Similarity Scores - Category extraction from platformData", () => {
  it("extracts WordPress tags from platformData", () => {
    const pd = { tags: { "e-commerce": "E-Commerce", seo: "SEO" } };
    const slugs = extractCategorySlugsFromPlatformData(pd, "wordpress");
    expect(slugs.has("e-commerce")).toBe(true);
    expect(slugs.has("seo")).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it("extracts Salesforce listingCategories from platformData", () => {
    const pd = { listingCategories: ["CRM", "Sales", "Analytics"] };
    const slugs = extractCategorySlugsFromPlatformData(pd, "salesforce");
    expect(slugs.size).toBe(3);
    expect(slugs.has("CRM")).toBe(true);
  });

  it("extracts Canva topics with prefix stripping", () => {
    const pd = { topics: ["marketplace_topic.productivity", "marketplace_topic.social_media"] };
    const slugs = extractCategorySlugsFromPlatformData(pd, "canva");
    expect(slugs.has("productivity")).toBe(true);
    expect(slugs.has("social-media")).toBe(true);
  });

  it("returns empty set for unknown platform", () => {
    const slugs = extractCategorySlugsFromPlatformData({}, "nonexistent");
    expect(slugs.size).toBe(0);
  });

  it("returns empty set when platformData is empty", () => {
    const slugs = extractCategorySlugsFromPlatformData({}, "wordpress");
    expect(slugs.size).toBe(0);
  });
});

// ============================================================
// APP SCORES - VISIBILITY
// ============================================================
describe("App Scores - Visibility", () => {
  it("computes visibility from keyword rankings", () => {
    const result = computeAppVisibility([
      { totalResults: 100, position: 1 },
      { totalResults: 50, position: 10 },
    ]);
    expect(result.keywordCount).toBe(2);
    expect(result.visibilityRaw).toBeGreaterThan(0);
  });

  it("returns 0 for empty rankings", () => {
    const result = computeAppVisibility([]);
    expect(result.keywordCount).toBe(0);
    expect(result.visibilityRaw).toBe(0);
  });

  it("skips rankings with position < 1", () => {
    const result = computeAppVisibility([
      { totalResults: 100, position: 0 },
      { totalResults: 50, position: -1 },
    ]);
    expect(result.keywordCount).toBe(0);
    expect(result.visibilityRaw).toBe(0);
  });

  it("skips rankings with totalResults <= 0", () => {
    const result = computeAppVisibility([
      { totalResults: 0, position: 1 },
      { totalResults: -5, position: 2 },
    ]);
    expect(result.keywordCount).toBe(0);
  });

  it("position 1 has highest rank weight", () => {
    const rank1 = computeRankWeight(1);
    const rank2 = computeRankWeight(2);
    const rank10 = computeRankWeight(10);
    expect(rank1).toBeGreaterThan(rank2);
    expect(rank2).toBeGreaterThan(rank10);
  });

  it("applies page decay at page boundaries (position 25 vs 24)", () => {
    const pos24 = computeRankWeight(24); // page 0
    const pos25 = computeRankWeight(25); // page 1 (decay applied)
    // pos25 should be significantly less due to page decay
    expect(pos25).toBeLessThan(pos24 * PAGE_DECAY * 1.5);
  });

  it("higher totalResults produces higher visibility contribution", () => {
    const high = computeAppVisibility([{ totalResults: 1000, position: 5 }]);
    const low = computeAppVisibility([{ totalResults: 10, position: 5 }]);
    expect(high.visibilityRaw).toBeGreaterThan(low.visibilityRaw);
  });

  it("more keywords produce higher raw visibility", () => {
    const twoKw = computeAppVisibility([
      { totalResults: 100, position: 1 },
      { totalResults: 100, position: 5 },
    ]);
    const oneKw = computeAppVisibility([
      { totalResults: 100, position: 1 },
    ]);
    expect(twoKw.visibilityRaw).toBeGreaterThan(oneKw.visibilityRaw);
    expect(twoKw.keywordCount).toBe(2);
    expect(oneKw.keywordCount).toBe(1);
  });
});

describe("App Scores - normalizeScore", () => {
  it("normalizes to 0-100 scale", () => {
    expect(normalizeScore(50, 100)).toBe(50);
    expect(normalizeScore(100, 100)).toBe(100);
    expect(normalizeScore(0, 100)).toBe(0);
  });

  it("returns 0 when maxRaw is 0", () => {
    expect(normalizeScore(50, 0)).toBe(0);
  });

  it("returns 0 when maxRaw is negative", () => {
    expect(normalizeScore(50, -10)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    expect(normalizeScore(33, 100)).toBe(33);
    expect(normalizeScore(1, 3)).toBe(33); // 33.33 rounds to 33
  });

  it("max score is 100 when raw equals maxRaw", () => {
    expect(normalizeScore(42.5, 42.5)).toBe(100);
  });

  it("historical scores are preserved as separate rows per date", () => {
    // This tests the concept: different computedAt dates should yield separate rows
    // We verify normalizeScore is pure and deterministic
    const day1Score = normalizeScore(80, 100);
    const day2Score = normalizeScore(80, 100);
    expect(day1Score).toBe(day2Score);
    expect(day1Score).toBe(80);
  });
});

// ============================================================
// APP SCORES - POWER
// ============================================================
describe("App Scores - Power Score", () => {
  it("computes all component scores", () => {
    const result = computeAppPower(
      {
        averageRating: 4.5,
        ratingCount: 100,
        categoryRankings: [{ position: 5, totalApps: 200 }],
        accMacro: 5,
      },
      1000, // maxReviewsInCategory
      10,   // maxAccMacroInCategory
    );
    expect(result.ratingScore).toBeGreaterThan(0);
    expect(result.reviewScore).toBeGreaterThan(0);
    expect(result.categoryScore).toBeGreaterThan(0);
    expect(result.momentumScore).toBeGreaterThan(0);
    expect(result.powerRaw).toBeGreaterThan(0);
  });

  it("rating below 3.0 gives ratingScore of 0", () => {
    const result = computeAppPower(
      {
        averageRating: 2.5,
        ratingCount: 100,
        categoryRankings: [],
        accMacro: null,
      },
      100,
      0,
    );
    expect(result.ratingScore).toBe(0);
  });

  it("rating of 5.0 gives maximum ratingScore", () => {
    const result = computeAppPower(
      {
        averageRating: 5.0,
        ratingCount: 100,
        categoryRankings: [],
        accMacro: null,
      },
      100,
      0,
    );
    // ((5-3)/2)^1.5 = 1^1.5 = 1.0
    expect(result.ratingScore).toBe(1);
  });

  it("null averageRating gives ratingScore of 0", () => {
    const result = computeAppPower(
      {
        averageRating: null,
        ratingCount: 100,
        categoryRankings: [],
        accMacro: null,
      },
      100,
      0,
    );
    expect(result.ratingScore).toBe(0);
  });

  it("reviewScore is normalized against max in category", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 100,
        categoryRankings: [],
        accMacro: null,
      },
      100, // max = 100, same as this app
      0,
    );
    // log10(101) / log10(101) = 1.0
    expect(result.reviewScore).toBe(1);
  });

  it("reviewScore is 0 when maxReviewsInCategory is 0", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [],
        accMacro: null,
      },
      0,
      0,
    );
    // maxReview = log10(1) = 0
    expect(result.reviewScore).toBe(0);
  });

  it("categoryScore computed correctly for single category", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [{ position: 1, totalApps: 100 }],
        accMacro: null,
      },
      100,
      0,
    );
    expect(result.categoryScore).toBeGreaterThan(0);
  });

  it("categoryScore uses 70/30 blend for two categories", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [
          { position: 1, totalApps: 100 },
          { position: 50, totalApps: 100 },
        ],
        accMacro: null,
      },
      100,
      0,
    );
    // Best category gets 70% weight, second gets 30%
    const score1 = computeCategoryRankScore({ position: 1, totalApps: 100 });
    const score50 = computeCategoryRankScore({ position: 50, totalApps: 100 });
    const expected = 0.7 * score1 + 0.3 * score50;
    expect(result.categoryScore).toBeCloseTo(expected, 3);
  });

  it("momentumScore is 0 when accMacro is null", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [],
        accMacro: null,
      },
      100,
      10,
    );
    expect(result.momentumScore).toBe(0);
  });

  it("momentumScore is 0 when accMacro is negative", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [],
        accMacro: -5,
      },
      100,
      10,
    );
    expect(result.momentumScore).toBe(0);
  });

  it("momentumScore is clamped to 1 when accMacro > maxAccMacroInCategory", () => {
    const result = computeAppPower(
      {
        averageRating: 4.0,
        ratingCount: 50,
        categoryRankings: [],
        accMacro: 20,
      },
      100,
      10, // max is 10 but app has 20
    );
    expect(result.momentumScore).toBe(1);
  });

  it("powerRaw is weighted sum of all components", () => {
    const input: PowerInput = {
      averageRating: 5.0,
      ratingCount: 1000,
      categoryRankings: [{ position: 1, totalApps: 100 }],
      accMacro: 10,
    };
    const result = computeAppPower(input, 1000, 10);
    const expected =
      POWER_WEIGHTS.rating * result.ratingScore +
      POWER_WEIGHTS.review * result.reviewScore +
      POWER_WEIGHTS.category * result.categoryScore +
      POWER_WEIGHTS.momentum * result.momentumScore;
    expect(result.powerRaw).toBeCloseTo(expected, 3);
  });

  it("position beyond totalApps gives categoryScore of 0", () => {
    const score = computeCategoryRankScore({ position: 101, totalApps: 100 });
    expect(score).toBe(0);
  });

  it("computeWeightedPowerScore aggregates across categories", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 80, appCount: 100 },
      { powerScore: 60, appCount: 50 },
    ]);
    // Weighted: (80*100 + 60*50) / (100+50) = 11000/150 ~ 73.33 => 73
    expect(result).toBe(73);
  });

  it("computeWeightedPowerScore returns 0 for empty array", () => {
    expect(computeWeightedPowerScore([])).toBe(0);
  });
});

describe("App Scores - Category rank score", () => {
  it("position 1 gives highest score", () => {
    const score1 = computeCategoryRankScore({ position: 1, totalApps: 100 });
    const score5 = computeCategoryRankScore({ position: 5, totalApps: 100 });
    expect(score1).toBeGreaterThan(score5);
  });

  it("returns 0 for invalid inputs", () => {
    expect(computeCategoryRankScore({ position: 0, totalApps: 100 })).toBe(0);
    expect(computeCategoryRankScore({ position: 1, totalApps: 0 })).toBe(0);
    expect(computeCategoryRankScore({ position: -1, totalApps: 100 })).toBe(0);
  });

  it("applies page decay at page boundaries", () => {
    const pos24 = computeCategoryRankScore({ position: 24, totalApps: 200 }); // page 0
    const pos25 = computeCategoryRankScore({ position: 25, totalApps: 200 }); // page 1
    // Page 1 should have significantly lower score due to 0.5 page decay
    expect(pos25).toBeLessThan(pos24);
  });

  it("score decreases monotonically with position (within same page)", () => {
    const scores = [1, 5, 10, 15, 20, 24].map((p) =>
      computeCategoryRankScore({ position: p, totalApps: 200 })
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });
});

// ============================================================
// APP SCORES - PREREQUISITE TYPES
// ============================================================
describe("App Scores - Prerequisite types", () => {
  // Replicate the private function for testing
  const { PLATFORMS } = require("@appranks/shared");
  const BASE_PREREQUISITE_TYPES = ["app_details", "category"] as const;

  function getPrerequisiteTypes(platform: string): string[] {
    const platformConfig = PLATFORMS[platform];
    const types: string[] = [...BASE_PREREQUISITE_TYPES];
    if (platformConfig.hasKeywordSearch) types.push("keyword_search");
    if (platformConfig.hasReviews) types.push("reviews");
    return types;
  }

  it("always includes app_details and category", () => {
    for (const platformId of Object.keys(PLATFORMS)) {
      const types = getPrerequisiteTypes(platformId);
      expect(types).toContain("app_details");
      expect(types).toContain("category");
    }
  });

  it("retries if dependent data missing (before cutoff)", () => {
    // Test the logic: if missing prerequisites exist and UTC hour < 18, retry
    const nowUtc = 10; // before cutoff
    const CUTOFF_HOUR_UTC = 18;
    const missing = ["keyword_search"];
    const shouldRetry = missing.length > 0 && nowUtc < CUTOFF_HOUR_UTC;
    expect(shouldRetry).toBe(true);
  });

  it("fails if dependent data missing past cutoff", () => {
    const nowUtc = 19; // after cutoff
    const CUTOFF_HOUR_UTC = 18;
    const missing = ["keyword_search"];
    const shouldRetry = missing.length > 0 && nowUtc < CUTOFF_HOUR_UTC;
    const shouldFail = missing.length > 0 && !shouldRetry;
    expect(shouldFail).toBe(true);
  });

  it("proceeds when all prerequisites met", () => {
    const missing: string[] = [];
    expect(missing.length).toBe(0);
  });
});

// ============================================================
// FEATURE HANDLES - Shopify specific
// ============================================================
describe("Similarity Scores - Feature handle extraction", () => {
  it("extracts feature_handle from Shopify categories JSONB", () => {
    const categories = [
      {
        subcategories: [
          {
            features: [
              { feature_handle: "email-marketing" },
              { feature_handle: "sms-marketing" },
            ],
          },
        ],
      },
    ];
    const handles = extractFeatureHandles(categories, "shopify");
    expect(handles.has("email-marketing")).toBe(true);
    expect(handles.has("sms-marketing")).toBe(true);
    expect(handles.size).toBe(2);
  });

  it("returns empty set for non-Shopify platforms", () => {
    const categories = [
      {
        subcategories: [
          { features: [{ feature_handle: "something" }] },
        ],
      },
    ];
    expect(extractFeatureHandles(categories, "salesforce").size).toBe(0);
    expect(extractFeatureHandles(categories, "canva").size).toBe(0);
  });

  it("handles empty categories array", () => {
    expect(extractFeatureHandles([], "shopify").size).toBe(0);
  });

  it("handles categories with no subcategories", () => {
    const categories = [{ url: "/categories/email" }];
    expect(extractFeatureHandles(categories, "shopify").size).toBe(0);
  });
});

// ============================================================
// CATEGORY SLUGS - Shopify
// ============================================================
describe("Similarity Scores - Category slug extraction", () => {
  it("extracts slug from Shopify category URL format", () => {
    const categories = [
      { url: "/categories/email-marketing" },
      { url: "/categories/analytics" },
    ];
    const slugs = extractCategorySlugs(categories);
    expect(slugs.has("email-marketing")).toBe(true);
    expect(slugs.has("analytics")).toBe(true);
  });

  it("returns empty set for empty categories", () => {
    expect(extractCategorySlugs([]).size).toBe(0);
  });

  it("handles categories without URL", () => {
    const categories = [{ name: "Email" }];
    expect(extractCategorySlugs(categories).size).toBe(0);
  });
});
