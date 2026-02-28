import { describe, it, expect } from "vitest";
import {
  generateNgrams,
  extractKeywordsFromAppMetadata,
  KEYWORD_STOP_WORDS,
  FIELD_WEIGHTS,
} from "@shopify-tracking/shared";

describe("KEYWORD_STOP_WORDS", () => {
  it("includes common English stop words", () => {
    expect(KEYWORD_STOP_WORDS.has("the")).toBe(true);
    expect(KEYWORD_STOP_WORDS.has("and")).toBe(true);
    expect(KEYWORD_STOP_WORDS.has("for")).toBe(true);
  });

  it("includes Shopify-specific stop words", () => {
    expect(KEYWORD_STOP_WORDS.has("app")).toBe(true);
    expect(KEYWORD_STOP_WORDS.has("shopify")).toBe(true);
    expect(KEYWORD_STOP_WORDS.has("store")).toBe(true);
  });
});

describe("FIELD_WEIGHTS", () => {
  it("has correct weight ordering", () => {
    expect(FIELD_WEIGHTS.name).toBeGreaterThan(FIELD_WEIGHTS.subtitle);
    expect(FIELD_WEIGHTS.subtitle).toBeGreaterThan(FIELD_WEIGHTS.introduction);
    expect(FIELD_WEIGHTS.introduction).toBeGreaterThan(FIELD_WEIGHTS.categories);
    expect(FIELD_WEIGHTS.categories).toBeGreaterThanOrEqual(FIELD_WEIGHTS.features);
    expect(FIELD_WEIGHTS.features).toBeGreaterThanOrEqual(FIELD_WEIGHTS.description);
  });
});

describe("generateNgrams", () => {
  it("generates unigrams from 4+ char words", () => {
    const result = generateNgrams("email marketing");
    expect(result).toContain("email");
    expect(result).toContain("marketing");
  });

  it("excludes short words from unigrams", () => {
    const result = generateNgrams("ai bot test");
    // "ai" is 2 chars, "bot" is 3 chars — both < 4
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

  it("excludes stop words from unigrams", () => {
    const result = generateNgrams("the best shopify app");
    expect(result).not.toContain("the");
    expect(result).not.toContain("best");
    expect(result).not.toContain("shopify");
  });

  it("strips special characters", () => {
    const result = generateNgrams("AI-powered chatbot & support!");
    expect(result).toContain("ai-powered chatbot");
  });

  it("returns empty for empty input", () => {
    expect(generateNgrams("")).toEqual([]);
  });

  it("handles single word", () => {
    const result = generateNgrams("chatbot");
    expect(result).toContain("chatbot");
    expect(result).toHaveLength(1);
  });
});

describe("extractKeywordsFromAppMetadata", () => {
  const baseInput = {
    name: "",
    subtitle: null,
    introduction: null,
    description: null,
    features: [],
    categories: [],
  };

  it("extracts keywords from app name", () => {
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

  it("extracts keywords from subtitle", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "ServiceHub",
      subtitle: "AI customer service platform",
      description: "The best customer service solution available",
    });
    const customerService = result.find((k) => k.keyword === "customer service");
    expect(customerService).toBeDefined();
    expect(customerService!.sources.some((s) => s.field === "subtitle")).toBe(true);
    expect(customerService!.count).toBeGreaterThanOrEqual(2);
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

  it("boosts score when keyword also appears in categories", () => {
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
    const customerSupport = result.find((k) => k.keyword === "customer support");
    expect(customerSupport).toBeDefined();
    expect(customerSupport!.sources.some((s) => s.field === "categories")).toBe(true);
    expect(customerSupport!.sources.some((s) => s.field === "name")).toBe(true);
  });

  it("boosts score when keyword also appears in categoryFeatures", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      introduction: "Abandoned cart recovery is essential for e-commerce",
      categories: [
        {
          title: "Marketing",
          url: "/categories/marketing",
          subcategories: [
            {
              title: "Email",
              features: [
                {
                  title: "Abandoned cart recovery",
                  url: "/categories/marketing/abandoned-cart-recovery",
                  feature_handle: "abandoned-cart-recovery",
                },
              ],
            },
          ],
        },
      ],
    });
    const abandoned = result.find((k) => k.keyword === "abandoned cart recovery");
    expect(abandoned).toBeDefined();
    expect(abandoned!.sources.some((s) => s.field === "categoryFeatures")).toBe(true);
    expect(abandoned!.sources.some((s) => s.field === "introduction")).toBe(true);
  });

  it("boosts score when keyword also appears in features array", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      description: "Powerful email marketing automation for your store",
      features: ["Email marketing automation", "SMS campaigns"],
    });
    const emailMarketing = result.find((k) => k.keyword === "email marketing automation");
    expect(emailMarketing).toBeDefined();
    expect(emailMarketing!.sources.some((s) => s.field === "features")).toBe(true);
    expect(emailMarketing!.sources.some((s) => s.field === "description")).toBe(true);
  });

  it("excludes keywords only from non-primary fields (categories/features/categoryFeatures)", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Some Other App",
      categories: [
        {
          title: "Unique category only",
          url: "/categories/unique",
          subcategories: [],
        },
      ],
      features: ["Standalone feature only"],
    });
    // These keywords only appear in categories/features, not in name/subtitle/intro/description
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

  it("returns empty for empty input", () => {
    const result = extractKeywordsFromAppMetadata(baseInput);
    expect(result).toEqual([]);
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
    // With count >= 2 filter, single-field keywords won't appear
    expect(result).toEqual([]);
  });

  it("applies word count multiplier to scores", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Email Marketing Automation",
      subtitle: "Email marketing automation platform",
    });
    const trigramKw = result.find((k) => k.keyword === "email marketing automation");
    const bigramKw = result.find((k) => k.keyword === "email marketing");
    const unigramKw = result.find((k) => k.keyword === "email");

    // All should exist (appear in both name and subtitle)
    expect(trigramKw).toBeDefined();
    expect(bigramKw).toBeDefined();
    expect(unigramKw).toBeDefined();

    // 3-word keyword should have highest multiplier (3x), 2-word (2x), 1-word (1x)
    // For same base weight and count, trigram > bigram > unigram
    expect(trigramKw!.score).toBeGreaterThan(bigramKw!.score);
    expect(bigramKw!.score).toBeGreaterThan(unigramKw!.score);
  });

  it("excludes keywords with more than 3 words", () => {
    const result = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "App",
      subtitle: "Best platform ever",
      // Feature with 4+ word title — should be excluded even if it appears in description too
      description: "Automated email marketing campaign manager for stores",
      features: ["Automated email marketing campaign manager"],
    });
    expect(
      result.find((k) => k.keyword === "automated email marketing campaign manager")
    ).toBeUndefined();
  });

  it("requires keywords to appear in at least 2 fields", () => {
    // "chatbot" only in name → filtered out
    const single = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Chatbot Pro",
    });
    expect(single.find((k) => k.keyword === "chatbot")).toBeUndefined();

    // "chatbot" in name + subtitle → included
    const multi = extractKeywordsFromAppMetadata({
      ...baseInput,
      name: "Chatbot Pro",
      subtitle: "AI chatbot for support",
    });
    expect(multi.find((k) => k.keyword === "chatbot")).toBeDefined();
  });
});
