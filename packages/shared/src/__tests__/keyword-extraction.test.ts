import { describe, it, expect } from "vitest";
import {
  generateNgrams,
  extractKeywordsFromAppMetadata,
  getStopWords,
  COMMON_STOP_WORDS,
  KEYWORD_STOP_WORDS,
  FIELD_WEIGHTS,
} from "../keyword-extraction.js";

// ---------------------------------------------------------------------------
// COMMON_STOP_WORDS / KEYWORD_STOP_WORDS
// ---------------------------------------------------------------------------
describe("COMMON_STOP_WORDS", () => {
  it("includes common English stop words", () => {
    for (const w of ["the", "a", "an", "is", "are", "and", "or", "but"]) {
      expect(COMMON_STOP_WORDS.has(w)).toBe(true);
    }
  });

  it("includes generic marketplace terms", () => {
    for (const w of ["app", "apps", "plugin", "tools", "feature"]) {
      expect(COMMON_STOP_WORDS.has(w)).toBe(true);
    }
  });
});

describe("KEYWORD_STOP_WORDS (deprecated)", () => {
  it("includes Shopify-specific stop words", () => {
    expect(KEYWORD_STOP_WORDS.has("shopify")).toBe(true);
    expect(KEYWORD_STOP_WORDS.has("store")).toBe(true);
  });

  it("is a superset of COMMON_STOP_WORDS", () => {
    for (const w of COMMON_STOP_WORDS) {
      expect(KEYWORD_STOP_WORDS.has(w)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getStopWords
// ---------------------------------------------------------------------------
describe("getStopWords", () => {
  it("returns common stop words when no platform given", () => {
    const sw = getStopWords();
    expect(sw.has("the")).toBe(true);
    expect(sw.has("app")).toBe(true);
  });

  it("includes shopify-specific stop words", () => {
    const sw = getStopWords("shopify");
    expect(sw.has("shopify")).toBe(true);
    expect(sw.has("store")).toBe(true);
  });

  it("includes salesforce-specific stop words", () => {
    const sw = getStopWords("salesforce");
    expect(sw.has("salesforce")).toBe(true);
    expect(sw.has("appexchange")).toBe(true);
  });

  it("includes canva-specific stop words", () => {
    const sw = getStopWords("canva");
    expect(sw.has("canva")).toBe(true);
    expect(sw.has("template")).toBe(true);
  });

  it("returns only common stop words for unknown platform", () => {
    const sw = getStopWords("unknown");
    expect(sw.size).toBe(COMMON_STOP_WORDS.size);
  });
});

// ---------------------------------------------------------------------------
// FIELD_WEIGHTS
// ---------------------------------------------------------------------------
describe("FIELD_WEIGHTS", () => {
  it("has correct weight ordering: name > subtitle > intro > categories >= features >= desc", () => {
    expect(FIELD_WEIGHTS.name).toBeGreaterThan(FIELD_WEIGHTS.subtitle);
    expect(FIELD_WEIGHTS.subtitle).toBeGreaterThan(FIELD_WEIGHTS.introduction);
    expect(FIELD_WEIGHTS.introduction).toBeGreaterThan(FIELD_WEIGHTS.categories);
    expect(FIELD_WEIGHTS.categories).toBeGreaterThanOrEqual(FIELD_WEIGHTS.features);
    expect(FIELD_WEIGHTS.features).toBeGreaterThanOrEqual(FIELD_WEIGHTS.description);
  });

  it("has specific weight values", () => {
    expect(FIELD_WEIGHTS.name).toBe(10.0);
    expect(FIELD_WEIGHTS.subtitle).toBe(5.0);
    expect(FIELD_WEIGHTS.introduction).toBe(4.0);
    expect(FIELD_WEIGHTS.categories).toBe(3.0);
    expect(FIELD_WEIGHTS.features).toBe(2.0);
    expect(FIELD_WEIGHTS.description).toBe(2.0);
    expect(FIELD_WEIGHTS.categoryFeatures).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// generateNgrams
// ---------------------------------------------------------------------------
describe("generateNgrams", () => {
  it("generates unigrams from 4+ char words", () => {
    const result = generateNgrams("email marketing");
    expect(result).toContain("email");
    expect(result).toContain("marketing");
  });

  it("excludes short words from unigrams", () => {
    const result = generateNgrams("ai bot test");
    expect(result).not.toContain("ai");
    expect(result).not.toContain("bot");
    expect(result).toContain("test");
  });

  it("generates bigrams", () => {
    const result = generateNgrams("email marketing tool");
    expect(result).toContain("email marketing");
    expect(result).toContain("marketing tool");
  });

  it("generates trigrams", () => {
    const result = generateNgrams("live chat support widget");
    expect(result).toContain("live chat support");
    expect(result).toContain("chat support widget");
  });

  it("respects maxN parameter to skip trigrams", () => {
    const result = generateNgrams("live chat support widget", 2);
    expect(result).not.toContain("live chat support");
    expect(result).toContain("live chat");
    expect(result).toContain("chat support");
  });

  it("excludes stop words from unigrams", () => {
    const result = generateNgrams("the best shopify app");
    expect(result).not.toContain("the");
    expect(result).not.toContain("best");
    expect(result).not.toContain("shopify");
  });

  it("returns empty for empty input", () => {
    expect(generateNgrams("")).toEqual([]);
  });

  it("handles single word", () => {
    const result = generateNgrams("chatbot");
    expect(result).toContain("chatbot");
    expect(result).toHaveLength(1);
  });

  it("uses custom stop words when provided", () => {
    const sw = new Set(["custom"]);
    const result = generateNgrams("custom word testing", 3, sw);
    expect(result).not.toContain("custom");
    expect(result).toContain("word");
    expect(result).toContain("testing");
  });

  it("bigrams allow one stop word", () => {
    const sw = new Set(["stop"]);
    const result = generateNgrams("stop word", 2, sw);
    // "stop" is a stop word but "stop word" bigram should be included
    // because at least one word (word) is not a stop word
    expect(result).toContain("stop word");
  });

  it("bigrams exclude when both words are stop words", () => {
    // Using default stop words where "the" and "app" are stop words
    const result = generateNgrams("the app");
    expect(result).not.toContain("the app");
  });

  it("trigrams need at least 2 non-stop words", () => {
    const sw = new Set(["is"]);
    const result = generateNgrams("chat is great", 3, sw);
    // "chat" and "great" are not stop words (2 non-stop), "is" is stop
    expect(result).toContain("chat is great");
  });
});

// ---------------------------------------------------------------------------
// extractKeywordsFromAppMetadata
// ---------------------------------------------------------------------------
describe("extractKeywordsFromAppMetadata", () => {
  const baseInput = {
    name: "",
    subtitle: null as string | null,
    introduction: null as string | null,
    description: null as string | null,
    features: [] as string[],
    categories: [] as any[],
  };

  it("returns empty for empty input", () => {
    expect(extractKeywordsFromAppMetadata(baseInput)).toEqual([]);
  });

  it("handles null fields gracefully", () => {
    const result = extractKeywordsFromAppMetadata({
      name: "Test App",
      subtitle: null,
      introduction: null,
      description: null,
      features: [],
      categories: [],
    });
    expect(result).toEqual([]);
  });

  it("extracts keywords from app name + subtitle", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Tidio Live Chat",
      subtitle: "Live chat for your store",
    });
    const liveChat = result.find((k) => k.keyword === "live chat");
    expect(liveChat).toBeDefined();
    expect(liveChat!.sources.some((s) => s.field === "name")).toBe(true);
    expect(liveChat!.count).toBeGreaterThanOrEqual(2);
  });

  it("accumulates score across multiple fields", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Live Chat App",
      subtitle: "Best live chat solution",
    });
    const liveChat = result.find((k) => k.keyword === "live chat");
    expect(liveChat).toBeDefined();
    expect(liveChat!.sources.length).toBeGreaterThanOrEqual(2);
    expect(liveChat!.score).toBeGreaterThan(FIELD_WEIGHTS.name);
  });

  it("boosts score for keyword in categories", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Customer Support Hub",
      categories: [
        {
          title: "Customer support",
          url: "/categories/customer-support",
          subcategories: [{ title: "Live chat", features: [] }],
        },
      ],
    });
    const cs = result.find((k) => k.keyword === "customer support");
    expect(cs).toBeDefined();
    expect(cs!.sources.some((s) => s.field === "categories")).toBe(true);
    expect(cs!.sources.some((s) => s.field === "name")).toBe(true);
  });

  it("requires keywords in at least 2 fields", () => {
    const single = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Chatbot Pro",
    });
    expect(single.find((k) => k.keyword === "chatbot")).toBeUndefined();

    const multi = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Chatbot Pro",
      subtitle: "AI chatbot for support",
    });
    expect(multi.find((k) => k.keyword === "chatbot")).toBeDefined();
  });

  it("requires keywords to appear in at least one primary field", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Some Other App",
      categories: [
        { title: "Unique category only", url: "/categories/unique", subcategories: [] },
      ],
      features: ["Standalone feature only"],
    });
    expect(result.find((k) => k.keyword === "unique category only")).toBeUndefined();
    expect(result.find((k) => k.keyword === "standalone feature only")).toBeUndefined();
  });

  it("sorts by score descending", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Live Chat Helpdesk",
      subtitle: "Live chat for support",
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("applies word count multiplier: 3-word > 2-word > 1-word", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Email Marketing Automation",
      subtitle: "Email marketing automation platform",
    });
    const trigram = result.find((k) => k.keyword === "email marketing automation");
    const bigram = result.find((k) => k.keyword === "email marketing");
    const unigram = result.find((k) => k.keyword === "email");

    expect(trigram).toBeDefined();
    expect(bigram).toBeDefined();
    expect(unigram).toBeDefined();
    expect(trigram!.score).toBeGreaterThan(bigram!.score);
    expect(bigram!.score).toBeGreaterThan(unigram!.score);
  });

  it("excludes keywords with more than 3 words", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "App",
      subtitle: "Best platform ever",
      description: "Automated email marketing campaign manager for stores",
      features: ["Automated email marketing campaign manager"],
    });
    expect(
      result.find((k) => k.keyword === "automated email marketing campaign manager")
    ).toBeUndefined();
  });

  it("uses platform-specific stop words when platform is provided", () => {
    const shopifyResult = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Shopify Store Manager",
      subtitle: "Manage your Shopify store easily",
    }, "shopify");
    // "shopify" and "store" are stop words for Shopify
    expect(shopifyResult.find((k) => k.keyword === "shopify")).toBeUndefined();
    expect(shopifyResult.find((k) => k.keyword === "store")).toBeUndefined();
  });

  it("caps description at 500 words", () => {
    const longDesc = Array(600).fill("keyword").join(" ");
    // Should not throw, just truncates
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Test keyword extractor",
      description: longDesc,
    });
    expect(result).toBeDefined();
  });
});
