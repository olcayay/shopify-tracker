import { describe, it, expect, vi } from "vitest";
import {
  buildKeywordSuggestionInput,
  mergeKeywords,
  generateKeywordSuggestions,
  ASO_WEIGHTS,
  KEYWORD_TIERS,
  KEYWORD_RESPONSE_SCHEMA,
} from "../ai-keyword-suggestions.js";
import type {
  KeywordSuggestionInput,
  AIKeywordSuggestion,
  NgramKeyword,
  AIKeywordResponse,
  AIClient,
} from "../index.js";

// ---------------------------------------------------------------------------
// buildKeywordSuggestionInput
// ---------------------------------------------------------------------------
describe("buildKeywordSuggestionInput", () => {
  const baseInput: KeywordSuggestionInput = {
    name: "OrderTracker Pro",
    subtitle: "Real-time order tracking & shipping notifications",
    introduction: "Track every order from checkout to delivery",
    description: "A comprehensive order tracking solution for e-commerce stores.",
    features: ["Real-time tracking", "Email notifications", "Analytics dashboard"],
    categories: ["Orders & Shipping", "Customer Service"],
    platform: "shopify",
  };

  it("includes all fields with ASO weights", () => {
    const result = buildKeywordSuggestionInput(baseInput);

    expect(result).toContain("Platform: shopify");
    expect(result).toContain("App Name (10x weight): OrderTracker Pro");
    expect(result).toContain("Subtitle (7x weight):");
    expect(result).toContain("Introduction (5x weight):");
    expect(result).toContain("Features (4x weight):");
    expect(result).toContain("Categories (3x weight):");
    expect(result).toContain("Description (2x weight):");
  });

  it("includes pricing plans when provided", () => {
    const input = {
      ...baseInput,
      pricingPlans: [
        { name: "Free", features: ["Basic tracking"] },
        { name: "Pro", features: ["Real-time updates", "Analytics"] },
      ],
    };
    const result = buildKeywordSuggestionInput(input);
    expect(result).toContain("Pricing Plans (1x weight):");
    expect(result).toContain("Free: Basic tracking");
    expect(result).toContain("Pro: Real-time updates, Analytics");
  });

  it("includes developer name when provided", () => {
    const input = { ...baseInput, developerName: "TrackCorp Inc." };
    const result = buildKeywordSuggestionInput(input);
    expect(result).toContain("Developer (0.5x weight): TrackCorp Inc.");
  });

  it("omits null/empty optional fields", () => {
    const minimal: KeywordSuggestionInput = {
      name: "Test App",
      subtitle: null,
      introduction: null,
      description: null,
      features: [],
      categories: [],
      platform: "shopify",
    };
    const result = buildKeywordSuggestionInput(minimal);

    expect(result).toContain("App Name (10x weight): Test App");
    expect(result).not.toContain("Subtitle");
    expect(result).not.toContain("Introduction");
    expect(result).not.toContain("Description");
    expect(result).not.toContain("Features");
    expect(result).not.toContain("Categories");
  });

  it("includes existing tracked keywords", () => {
    const input = {
      ...baseInput,
      existingKeywords: ["order tracking", "shipping notification"],
    };
    const result = buildKeywordSuggestionInput(input);
    expect(result).toContain("Already tracked keywords");
    expect(result).toContain("order tracking");
  });

  it("includes competitor keywords sorted by count", () => {
    const input = {
      ...baseInput,
      competitorKeywords: {
        "order management": 5,
        "shipping tracker": 3,
        "delivery status": 8,
      },
    };
    const result = buildKeywordSuggestionInput(input);
    expect(result).toContain("Competitor keywords:");
    expect(result).toContain("delivery status (8 competitors)");
  });

  it("includes n-gram top keywords", () => {
    const input = {
      ...baseInput,
      ngramTopKeywords: [
        { keyword: "order tracking", score: 45.2 },
        { keyword: "shipping", score: 30.1 },
      ],
    };
    const result = buildKeywordSuggestionInput(input);
    expect(result).toContain("N-gram keywords");
    expect(result).toContain("order tracking (45.2)");
  });

  it("truncates long description to 500 chars", () => {
    const input = { ...baseInput, description: "A".repeat(600) };
    const result = buildKeywordSuggestionInput(input);
    // Description line should have at most 500 chars of the description
    const descLine = result.split("\n").find(l => l.includes("Description"));
    expect(descLine).toBeDefined();
    expect(descLine!.length).toBeLessThan(550); // "Description (2x weight): " + 500
  });
});

// ---------------------------------------------------------------------------
// mergeKeywords
// ---------------------------------------------------------------------------
describe("mergeKeywords", () => {
  const aiKeywords: AIKeywordSuggestion[] = [
    {
      keyword: "order tracking",
      tier: 1,
      score: 95,
      rationale: "Primary function",
      source: "name, subtitle",
      competitiveness: "high",
      searchIntent: "transactional",
    },
    {
      keyword: "shipping notification",
      tier: 2,
      score: 80,
      rationale: "Key feature",
      source: "features",
      competitiveness: "medium",
      searchIntent: "commercial",
    },
    {
      keyword: "delivery status",
      tier: 3,
      score: 60,
      rationale: "Problem solved",
      source: "description",
      competitiveness: "low",
      searchIntent: "informational",
    },
  ];

  const ngramKeywords: NgramKeyword[] = [
    { keyword: "order tracking", score: 50 },    // Also in AI
    { keyword: "real-time updates", score: 30 },  // N-gram only
    { keyword: "shipping notification", score: 40 }, // Also in AI
  ];

  it("boosts score by 20% when keyword appears in both AI and n-gram", () => {
    const merged = mergeKeywords(aiKeywords, ngramKeywords);

    const orderTracking = merged.find(k => k.keyword === "order tracking");
    expect(orderTracking).toBeDefined();
    expect(orderTracking!.fromAI).toBe(true);
    expect(orderTracking!.fromNgram).toBe(true);
    // 95 * 1.2 = 114 → capped at 100
    expect(orderTracking!.score).toBe(100);
  });

  it("keeps AI-only keywords with original score", () => {
    const merged = mergeKeywords(aiKeywords, ngramKeywords);

    const delivery = merged.find(k => k.keyword === "delivery status");
    expect(delivery).toBeDefined();
    expect(delivery!.fromAI).toBe(true);
    expect(delivery!.fromNgram).toBe(false);
    expect(delivery!.score).toBe(60);
  });

  it("adds n-gram-only keywords with normalized score", () => {
    const merged = mergeKeywords(aiKeywords, ngramKeywords);

    const realtime = merged.find(k => k.keyword === "real-time updates");
    expect(realtime).toBeDefined();
    expect(realtime!.fromAI).toBe(false);
    expect(realtime!.fromNgram).toBe(true);
    expect(realtime!.tier).toBe(2); // default tier for n-gram only
    // 30/50 * 80 = 48
    expect(realtime!.score).toBe(48);
  });

  it("sorts by score descending", () => {
    const merged = mergeKeywords(aiKeywords, ngramKeywords);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].score).toBeGreaterThanOrEqual(merged[i].score);
    }
  });

  it("respects maxResults parameter", () => {
    const merged = mergeKeywords(aiKeywords, ngramKeywords, 2);
    expect(merged.length).toBe(2);
  });

  it("deduplicates case-insensitively", () => {
    const ai: AIKeywordSuggestion[] = [{
      keyword: "Order Tracking",
      tier: 1,
      score: 90,
      rationale: "test",
      source: "test",
      competitiveness: "high",
      searchIntent: "transactional",
    }];
    const ngram: NgramKeyword[] = [{ keyword: "order tracking", score: 40 }];

    const merged = mergeKeywords(ai, ngram);
    const matches = merged.filter(k => k.keyword === "order tracking");
    expect(matches.length).toBe(1);
    expect(matches[0].fromAI).toBe(true);
    expect(matches[0].fromNgram).toBe(true);
  });

  it("handles empty AI keywords", () => {
    const merged = mergeKeywords([], ngramKeywords);
    expect(merged.length).toBe(ngramKeywords.length);
    expect(merged.every(k => k.fromNgram && !k.fromAI)).toBe(true);
  });

  it("handles empty n-gram keywords", () => {
    const merged = mergeKeywords(aiKeywords, []);
    expect(merged.length).toBe(aiKeywords.length);
    expect(merged.every(k => k.fromAI && !k.fromNgram)).toBe(true);
  });

  it("handles both empty", () => {
    const merged = mergeKeywords([], []);
    expect(merged.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateKeywordSuggestions
// ---------------------------------------------------------------------------
describe("generateKeywordSuggestions", () => {
  const mockResponse: AIKeywordResponse = {
    appSummary: "Order tracking app",
    primaryCategory: "Orders & Shipping",
    targetAudience: "E-commerce merchants",
    keywords: [
      {
        keyword: "Order Tracking",
        tier: 1,
        score: 95,
        rationale: "Primary function",
        source: "name",
        competitiveness: "High",
        searchIntent: "Transactional",
      },
      {
        keyword: "shipping alerts",
        tier: 2,
        score: 75,
        rationale: "Key feature",
        source: "features",
        competitiveness: "medium",
        searchIntent: "commercial",
      },
      {
        keyword: "DELIVERY TRACKING",
        tier: 6 as any, // out of range — should be clamped
        score: 150, // out of range — should be clamped
        rationale: "Related term",
        source: "description",
        competitiveness: "UNKNOWN" as any, // invalid — should normalize
        searchIntent: "UNKNOWN" as any, // invalid — should normalize
      },
    ],
  };

  function createMockClient(): AIClient {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockResponse) } }],
            usage: { prompt_tokens: 500, completion_tokens: 300, total_tokens: 800 },
          }),
        },
      },
    };
  }

  it("calls AI and returns parsed response", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "OrderTracker Pro",
        subtitle: "Track orders",
        introduction: null,
        description: null,
        features: ["Real-time tracking"],
        categories: ["Orders"],
        platform: "shopify",
      },
    });

    expect(result.response.appSummary).toBe("Order tracking app");
    expect(result.response.keywords.length).toBe(3);
    expect(result.aiResult.promptTokens).toBe(500);
  });

  it("normalizes keywords to lowercase", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    expect(result.response.keywords[0].keyword).toBe("order tracking");
    expect(result.response.keywords[2].keyword).toBe("delivery tracking");
  });

  it("clamps tier to 1-5 range", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    // Tier 6 should be clamped to 5
    expect(result.response.keywords[2].tier).toBe(5);
  });

  it("clamps score to 0-100 range", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    // Score 150 should be clamped to 100
    expect(result.response.keywords[2].score).toBe(100);
  });

  it("normalizes invalid competitiveness to 'medium'", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    expect(result.response.keywords[2].competitiveness).toBe("medium");
  });

  it("normalizes invalid searchIntent to 'commercial'", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    expect(result.response.keywords[2].searchIntent).toBe("commercial");
  });

  it("uses gpt-4o-mini as default model", async () => {
    const client = createMockClient();
    const result = await generateKeywordSuggestions({
      client,
      input: {
        name: "Test",
        subtitle: null,
        introduction: null,
        description: null,
        features: [],
        categories: [],
        platform: "shopify",
      },
    });

    expect(result.aiResult.model).toBe("gpt-4o-mini");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("ASO_WEIGHTS has correct structure", () => {
    expect(ASO_WEIGHTS.appTitle).toBe(10);
    expect(ASO_WEIGHTS.subtitle).toBe(7);
    expect(ASO_WEIGHTS.introduction).toBe(5);
    expect(ASO_WEIGHTS.features).toBe(4);
    expect(ASO_WEIGHTS.categories).toBe(3);
    expect(ASO_WEIGHTS.description).toBe(2);
    expect(ASO_WEIGHTS.pricingPlans).toBe(1);
    expect(ASO_WEIGHTS.developerName).toBe(0.5);
  });

  it("KEYWORD_TIERS covers tiers 1-5 with non-overlapping ranges", () => {
    const tiers = [1, 2, 3, 4, 5] as const;
    for (const tier of tiers) {
      const def = KEYWORD_TIERS[tier];
      expect(def).toBeDefined();
      expect(def.range[0]).toBeLessThanOrEqual(def.range[1]);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
    }

    // Verify ranges don't overlap
    expect(KEYWORD_TIERS[5].range[1]).toBeLessThan(KEYWORD_TIERS[4].range[0]);
    expect(KEYWORD_TIERS[4].range[1]).toBeLessThan(KEYWORD_TIERS[3].range[0]);
    expect(KEYWORD_TIERS[3].range[1]).toBeLessThan(KEYWORD_TIERS[2].range[0]);
    expect(KEYWORD_TIERS[2].range[1]).toBeLessThan(KEYWORD_TIERS[1].range[0]);
  });

  it("KEYWORD_RESPONSE_SCHEMA has valid structure", () => {
    expect(KEYWORD_RESPONSE_SCHEMA.name).toBe("keyword_suggestions");
    expect(KEYWORD_RESPONSE_SCHEMA.strict).toBe(true);
    expect(KEYWORD_RESPONSE_SCHEMA.schema.properties.keywords).toBeDefined();
    expect(KEYWORD_RESPONSE_SCHEMA.schema.required).toContain("keywords");
  });
});
