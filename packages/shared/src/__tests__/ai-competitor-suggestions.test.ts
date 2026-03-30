import { describe, it, expect, vi } from "vitest";
import {
  preFilterCandidates,
  buildCompetitorSuggestionInput,
  mergeCompetitorScores,
  generateCompetitorSuggestions,
  COMPETITOR_DIMENSION_WEIGHTS,
  HYBRID_WEIGHTS,
  COMPETITOR_RESPONSE_SCHEMA,
} from "../ai-competitor-suggestions.js";
import type {
  CompetitorCandidate,
  AICompetitorScore,
  JaccardScore,
  AICompetitorResponse,
  AIClient,
} from "../index.js";

// ---------------------------------------------------------------------------
// preFilterCandidates
// ---------------------------------------------------------------------------
describe("preFilterCandidates", () => {
  const makeCandidates = (count: number, prefix = "app"): CompetitorCandidate[] =>
    Array.from({ length: count }, (_, i) => ({
      slug: `${prefix}-${i}`,
      name: `${prefix} ${i}`,
      features: ["f1", "f2", "f3", "f4", "f5", "f6", "f7"],
    }));

  it("takes top 48 from Jaccard candidates", () => {
    const jaccard = makeCandidates(60, "jac");
    const result = preFilterCandidates(jaccard);
    expect(result.length).toBe(48);
    expect(result[0].slug).toBe("jac-0");
  });

  it("fills remaining slots from sightings candidates", () => {
    const jaccard = makeCandidates(40, "jac");
    const sightings = makeCandidates(30, "sig");
    const result = preFilterCandidates(jaccard, sightings);
    expect(result.length).toBe(60); // 40 + 20 (capped at 60)
    expect(result.some(c => c.slug.startsWith("sig"))).toBe(true);
  });

  it("deduplicates by slug", () => {
    const jaccard: CompetitorCandidate[] = [{ slug: "dup", name: "Dup 1" }];
    const sightings: CompetitorCandidate[] = [{ slug: "dup", name: "Dup 2" }];
    const result = preFilterCandidates(jaccard, sightings);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Dup 1"); // Jaccard takes priority
  });

  it("caps at 60 total candidates", () => {
    const jaccard = makeCandidates(48, "jac");
    const sightings = makeCandidates(30, "sig");
    const result = preFilterCandidates(jaccard, sightings);
    expect(result.length).toBe(60);
  });

  it("compresses features to top 5", () => {
    const jaccard: CompetitorCandidate[] = [{
      slug: "test",
      name: "Test",
      features: ["f1", "f2", "f3", "f4", "f5", "f6", "f7"],
    }];
    const result = preFilterCandidates(jaccard);
    expect(result[0].features!.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildCompetitorSuggestionInput
// ---------------------------------------------------------------------------
describe("buildCompetitorSuggestionInput", () => {
  it("includes app details and candidates", () => {
    const result = buildCompetitorSuggestionInput({
      app: {
        name: "OrderTracker",
        slug: "ordertracker",
        subtitle: "Track your orders",
        features: ["Real-time tracking", "Notifications"],
        categories: ["Orders & Shipping"],
      },
      candidates: [
        { slug: "rival-1", name: "Rival One", subtitle: "Ship faster", features: ["Tracking"] },
        { slug: "rival-2", name: "Rival Two", features: ["Analytics"] },
      ],
      platform: "shopify",
    });

    expect(result).toContain("Platform: shopify");
    expect(result).toContain("Name: OrderTracker");
    expect(result).toContain("Subtitle: Track your orders");
    expect(result).toContain("Features: Real-time tracking, Notifications");
    expect(result).toContain("Candidate Competitors (2 apps)");
    expect(result).toContain("Rival One [rival-1]");
    expect(result).toContain("Rival Two [rival-2]");
  });

  it("handles minimal input", () => {
    const result = buildCompetitorSuggestionInput({
      app: { name: "Test", slug: "test" },
      candidates: [],
      platform: "salesforce",
    });

    expect(result).toContain("Platform: salesforce");
    expect(result).toContain("Name: Test");
    expect(result).toContain("Candidate Competitors (0 apps)");
  });
});

// ---------------------------------------------------------------------------
// mergeCompetitorScores
// ---------------------------------------------------------------------------
describe("mergeCompetitorScores", () => {
  const aiCompetitors: AICompetitorScore[] = [
    {
      slug: "app-a",
      name: "App A",
      type: "direct",
      overallScore: 80,
      dimensions: {
        valuePropositionOverlap: 90,
        targetAudienceMatch: 80,
        featureFunctionalityOverlap: 75,
        marketPositioning: 70,
        keywordSearchOverlap: 60,
        categoryProximity: 50,
      },
      rationale: "Direct competitor",
      threatLevel: "high",
    },
    {
      slug: "app-b",
      name: "App B",
      type: "indirect",
      overallScore: 40,
      dimensions: {
        valuePropositionOverlap: 50,
        targetAudienceMatch: 40,
        featureFunctionalityOverlap: 35,
        marketPositioning: 30,
        keywordSearchOverlap: 20,
        categoryProximity: 60,
      },
      rationale: "Indirect competitor",
      threatLevel: "medium",
    },
    {
      slug: "app-c",
      name: "App C",
      type: "alternative",
      overallScore: 75,
      dimensions: {
        valuePropositionOverlap: 80,
        targetAudienceMatch: 70,
        featureFunctionalityOverlap: 60,
        marketPositioning: 50,
        keywordSearchOverlap: 40,
        categoryProximity: 30,
      },
      rationale: "Semantic competitor",
      threatLevel: "medium",
    },
  ];

  const jaccardScores: JaccardScore[] = [
    { slug: "app-a", overall: 0.6 },
    { slug: "app-b", overall: 0.7 },
    { slug: "app-c", overall: 0.05 }, // Low Jaccard, high AI
  ];

  it("computes hybrid score correctly (60% AI + 40% Jaccard*100)", () => {
    const merged = mergeCompetitorScores(aiCompetitors, jaccardScores);

    const appA = merged.find(c => c.slug === "app-a")!;
    // 0.6 * 80 + 0.4 * 60 = 48 + 24 = 72
    expect(appA.finalScore).toBe(72);

    const appB = merged.find(c => c.slug === "app-b")!;
    // 0.6 * 40 + 0.4 * 70 = 24 + 28 = 52
    expect(appB.finalScore).toBe(52);
  });

  it("flags semantic_competitor when AI > 70 and Jaccard < 0.1", () => {
    const merged = mergeCompetitorScores(aiCompetitors, jaccardScores);

    const appC = merged.find(c => c.slug === "app-c")!;
    expect(appC.flags).toContain("semantic_competitor");
    expect(appC.aiScore).toBe(75);
    expect(appC.jaccardScore).toBe(0.05);
  });

  it("flags superficially_similar when Jaccard > 0.5 and AI < 30", () => {
    const ai: AICompetitorScore[] = [{
      slug: "surface",
      name: "Surface App",
      type: "indirect",
      overallScore: 25,
      dimensions: {
        valuePropositionOverlap: 20,
        targetAudienceMatch: 20,
        featureFunctionalityOverlap: 30,
        marketPositioning: 25,
        keywordSearchOverlap: 30,
        categoryProximity: 20,
      },
      rationale: "Similar keywords only",
      threatLevel: "low",
    }];
    const jaccard: JaccardScore[] = [{ slug: "surface", overall: 0.6 }];

    const merged = mergeCompetitorScores(ai, jaccard);
    expect(merged[0].flags).toContain("superficially_similar");
  });

  it("sorts by finalScore descending", () => {
    const merged = mergeCompetitorScores(aiCompetitors, jaccardScores);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].finalScore).toBeGreaterThanOrEqual(merged[i].finalScore);
    }
  });

  it("respects maxResults parameter", () => {
    const merged = mergeCompetitorScores(aiCompetitors, jaccardScores, 2);
    expect(merged.length).toBe(2);
  });

  it("handles missing Jaccard score (defaults to 0)", () => {
    const ai: AICompetitorScore[] = [{
      slug: "no-jaccard",
      name: "No Jaccard",
      type: "direct",
      overallScore: 50,
      dimensions: {
        valuePropositionOverlap: 50,
        targetAudienceMatch: 50,
        featureFunctionalityOverlap: 50,
        marketPositioning: 50,
        keywordSearchOverlap: 50,
        categoryProximity: 50,
      },
      rationale: "test",
      threatLevel: "medium",
    }];

    const merged = mergeCompetitorScores(ai, []);
    // 0.6 * 50 + 0.4 * 0 = 30
    expect(merged[0].finalScore).toBe(30);
    expect(merged[0].jaccardScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateCompetitorSuggestions
// ---------------------------------------------------------------------------
describe("generateCompetitorSuggestions", () => {
  const mockResponse: AICompetitorResponse = {
    appSummary: "Order tracking app",
    marketContext: "Competitive order management space",
    competitors: [
      {
        slug: "rival-app",
        name: "Rival App",
        type: "Direct", // should normalize
        overallScore: 85,
        dimensions: {
          valuePropositionOverlap: 90,
          targetAudienceMatch: 80,
          featureFunctionalityOverlap: 75,
          marketPositioning: 70,
          keywordSearchOverlap: 60,
          categoryProximity: 150, // out of range — should clamp
        },
        rationale: "Direct head-to-head competitor",
        threatLevel: "HIGH", // should normalize
      },
      {
        slug: "alt-app",
        name: "Alt App",
        type: "UNKNOWN" as any, // invalid — should normalize
        overallScore: -5, // out of range — should clamp
        dimensions: {
          valuePropositionOverlap: 30,
          targetAudienceMatch: 20,
          featureFunctionalityOverlap: 25,
          marketPositioning: 15,
          keywordSearchOverlap: 10,
          categoryProximity: 5,
        },
        rationale: "Different approach",
        threatLevel: "INVALID" as any, // should normalize
      },
    ],
  };

  function createMockClient(): AIClient {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockResponse) } }],
            usage: { prompt_tokens: 800, completion_tokens: 500, total_tokens: 1300 },
          }),
        },
      },
    };
  }

  it("calls AI and returns parsed response", async () => {
    const client = createMockClient();
    const result = await generateCompetitorSuggestions({
      client,
      input: {
        app: { name: "Test", slug: "test" },
        candidates: [{ slug: "rival-app", name: "Rival" }],
        platform: "shopify",
      },
    });

    expect(result.response.competitors.length).toBe(2);
    expect(result.aiResult.promptTokens).toBe(800);
  });

  it("normalizes competitor type", async () => {
    const client = createMockClient();
    const result = await generateCompetitorSuggestions({
      client,
      input: {
        app: { name: "Test", slug: "test" },
        candidates: [],
        platform: "shopify",
      },
    });

    expect(result.response.competitors[0].type).toBe("direct");
    expect(result.response.competitors[1].type).toBe("indirect"); // UNKNOWN → indirect
  });

  it("clamps scores to 0-100", async () => {
    const client = createMockClient();
    const result = await generateCompetitorSuggestions({
      client,
      input: {
        app: { name: "Test", slug: "test" },
        candidates: [],
        platform: "shopify",
      },
    });

    expect(result.response.competitors[0].dimensions.categoryProximity).toBe(100); // 150 → 100
    expect(result.response.competitors[1].overallScore).toBe(0); // -5 → 0
  });

  it("normalizes threat level", async () => {
    const client = createMockClient();
    const result = await generateCompetitorSuggestions({
      client,
      input: {
        app: { name: "Test", slug: "test" },
        candidates: [],
        platform: "shopify",
      },
    });

    expect(result.response.competitors[0].threatLevel).toBe("high");
    expect(result.response.competitors[1].threatLevel).toBe("medium"); // INVALID → medium
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("dimension weights sum to 1.0", () => {
    const sum = Object.values(COMPETITOR_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it("hybrid weights sum to 1.0", () => {
    expect(HYBRID_WEIGHTS.ai + HYBRID_WEIGHTS.jaccard).toBeCloseTo(1.0);
  });

  it("response schema has valid structure", () => {
    expect(COMPETITOR_RESPONSE_SCHEMA.name).toBe("competitor_suggestions");
    expect(COMPETITOR_RESPONSE_SCHEMA.strict).toBe(true);
    expect(COMPETITOR_RESPONSE_SCHEMA.schema.properties.competitors).toBeDefined();
  });
});
