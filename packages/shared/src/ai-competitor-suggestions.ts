/**
 * AI competitor suggestion engine (PLA-450).
 *
 * Evaluates potential competitors across 6 dimensions using AI,
 * then merges with Jaccard similarity for hybrid scoring.
 * Classifies competitors as direct/indirect/alternative/aspirational.
 */

import type { AIClient, CallAIResult } from "./ai-service.js";
import { callAI } from "./ai-service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitorType = "direct" | "indirect" | "alternative" | "aspirational";

export interface AICompetitorScore {
  slug: string;
  name: string;
  type: CompetitorType;
  overallScore: number;     // 0-100
  dimensions: {
    valuePropositionOverlap: number;  // 0-100
    targetAudienceMatch: number;      // 0-100
    featureFunctionalityOverlap: number; // 0-100
    marketPositioning: number;         // 0-100
    keywordSearchOverlap: number;      // 0-100
    categoryProximity: number;         // 0-100
  };
  rationale: string;
  threatLevel: "low" | "medium" | "high";
}

export interface AICompetitorResponse {
  appSummary: string;
  marketContext: string;
  competitors: AICompetitorScore[];
}

export interface CompetitorCandidate {
  slug: string;
  name: string;
  subtitle?: string | null;
  features?: string[];  // top 5
  categories?: string[];
  rating?: number | null;
  ratingCount?: number | null;
  pricingHint?: string | null;
}

export interface CompetitorSuggestionInput {
  /** The app being analyzed */
  app: {
    name: string;
    slug: string;
    subtitle?: string | null;
    introduction?: string | null;
    description?: string | null;
    features?: string[];
    categories?: string[];
    pricingHint?: string | null;
  };
  /** Candidate competitors (pre-filtered) */
  candidates: CompetitorCandidate[];
  /** Platform (e.g. "shopify", "salesforce") */
  platform: string;
}

export interface MergedCompetitor {
  slug: string;
  name: string;
  type: CompetitorType;
  aiScore: number;        // 0-100
  jaccardScore: number;   // 0-1
  finalScore: number;     // 0-100 (hybrid)
  dimensions: AICompetitorScore["dimensions"];
  rationale: string;
  threatLevel: "low" | "medium" | "high";
  flags: string[];        // e.g. "semantic_competitor", "superficially_similar"
}

// ---------------------------------------------------------------------------
// Dimension weights
// ---------------------------------------------------------------------------

export const COMPETITOR_DIMENSION_WEIGHTS = {
  valuePropositionOverlap: 0.30,
  targetAudienceMatch: 0.20,
  featureFunctionalityOverlap: 0.20,
  marketPositioning: 0.15,
  keywordSearchOverlap: 0.10,
  categoryProximity: 0.05,
} as const;

// Hybrid merge weights
export const HYBRID_WEIGHTS = {
  ai: 0.6,
  jaccard: 0.4,
} as const;

// ---------------------------------------------------------------------------
// Candidate pre-filtering
// ---------------------------------------------------------------------------

const MAX_CANDIDATES = 60;

/**
 * Pre-filter and compress candidates for the AI prompt.
 * Combines Jaccard top candidates with similar_app_sightings, capped at MAX_CANDIDATES.
 * Compresses each candidate to name, subtitle, top 5 features.
 */
export function preFilterCandidates(
  jaccardCandidates: CompetitorCandidate[],
  sightingsCandidates: CompetitorCandidate[] = []
): CompetitorCandidate[] {
  const seen = new Set<string>();
  const result: CompetitorCandidate[] = [];

  // Add Jaccard top 48 first
  for (const c of jaccardCandidates.slice(0, 48)) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    result.push(compressCandidate(c));
  }

  // Add sightings candidates (up to fill MAX_CANDIDATES)
  for (const c of sightingsCandidates) {
    if (result.length >= MAX_CANDIDATES) break;
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    result.push(compressCandidate(c));
  }

  return result;
}

function compressCandidate(c: CompetitorCandidate): CompetitorCandidate {
  return {
    slug: c.slug,
    name: c.name,
    subtitle: c.subtitle || null,
    features: (c.features || []).slice(0, 5),
    categories: c.categories,
    rating: c.rating,
    ratingCount: c.ratingCount,
    pricingHint: c.pricingHint,
  };
}

// ---------------------------------------------------------------------------
// Input builder
// ---------------------------------------------------------------------------

export function buildCompetitorSuggestionInput(input: CompetitorSuggestionInput): string {
  const { app, candidates, platform } = input;
  const sections: string[] = [];

  sections.push(`Platform: ${platform}`);
  sections.push(`\n## Target App`);
  sections.push(`Name: ${app.name}`);
  if (app.subtitle) sections.push(`Subtitle: ${app.subtitle}`);
  if (app.introduction) sections.push(`Introduction: ${app.introduction.slice(0, 200)}`);
  if (app.features && app.features.length > 0) {
    sections.push(`Features: ${app.features.join(", ")}`);
  }
  if (app.categories && app.categories.length > 0) {
    sections.push(`Categories: ${app.categories.join(", ")}`);
  }
  if (app.pricingHint) sections.push(`Pricing: ${app.pricingHint}`);

  sections.push(`\n## Candidate Competitors (${candidates.length} apps)`);
  for (const c of candidates) {
    const parts = [`- ${c.name} [${c.slug}]`];
    if (c.subtitle) parts.push(`"${c.subtitle}"`);
    if (c.features && c.features.length > 0) parts.push(`Features: ${c.features.join(", ")}`);
    if (c.categories && c.categories.length > 0) parts.push(`Categories: ${c.categories.join(", ")}`);
    if (c.rating) parts.push(`${c.rating}★`);
    if (c.pricingHint) parts.push(c.pricingHint);
    sections.push(parts.join(" | "));
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a competitive intelligence analyst for app marketplaces. Given a target app and candidate competitors, evaluate each candidate across 6 dimensions.

## 6 Evaluation Dimensions (score 0-100 each)

1. **Value Proposition Overlap (30%)** — Do they solve the same core problem?
2. **Target Audience Match (20%)** — Same user persona, industry, company size?
3. **Feature Functionality Overlap (20%)** — How many features are shared/similar?
4. **Market Positioning (15%)** — Same pricing tier, quality level, market segment?
5. **Keyword/Search Overlap (10%)** — Would users search for both with similar queries?
6. **Category Proximity (5%)** — Same or adjacent categories?

## Competitor Classification

Assign exactly one type to each competitor:
- **direct**: Same problem, same audience, similar approach. They compete head-to-head.
- **indirect**: Same problem solved differently, or adjacent problem for same audience.
- **alternative**: Different approach entirely, but competes for same budget or need.
- **aspirational**: Market leader — not a direct threat but a benchmark to learn from.

## Threat Level
- **high**: Direct substitute, similar pricing, overlapping audience
- **medium**: Partial overlap, different niche or approach
- **low**: Tangential relationship, different segment

## Rules
1. Only include candidates with overallScore ≥ 20. Skip irrelevant apps.
2. overallScore = weighted average of all 6 dimensions using the percentages above.
3. Be conservative — don't inflate scores. Most candidates will score 20-60.
4. Rationale should be 1-2 sentences explaining the competitive relationship.
5. Order competitors by overallScore descending.
6. Include 10-25 competitors (skip truly irrelevant ones).
7. Be platform-aware — consider marketplace-specific dynamics.

Respond ONLY with valid JSON matching the required schema.`;

// ---------------------------------------------------------------------------
// Response JSON schema
// ---------------------------------------------------------------------------

export const COMPETITOR_RESPONSE_SCHEMA = {
  name: "competitor_suggestions",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      appSummary: { type: "string" as const },
      marketContext: { type: "string" as const },
      competitors: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            slug: { type: "string" as const },
            name: { type: "string" as const },
            type: { type: "string" as const },
            overallScore: { type: "number" as const },
            dimensions: {
              type: "object" as const,
              properties: {
                valuePropositionOverlap: { type: "number" as const },
                targetAudienceMatch: { type: "number" as const },
                featureFunctionalityOverlap: { type: "number" as const },
                marketPositioning: { type: "number" as const },
                keywordSearchOverlap: { type: "number" as const },
                categoryProximity: { type: "number" as const },
              },
              required: [
                "valuePropositionOverlap", "targetAudienceMatch",
                "featureFunctionalityOverlap", "marketPositioning",
                "keywordSearchOverlap", "categoryProximity",
              ] as const,
              additionalProperties: false as const,
            },
            rationale: { type: "string" as const },
            threatLevel: { type: "string" as const },
          },
          required: ["slug", "name", "type", "overallScore", "dimensions", "rationale", "threatLevel"] as const,
          additionalProperties: false as const,
        },
      },
    },
    required: ["appSummary", "marketContext", "competitors"] as const,
    additionalProperties: false as const,
  },
};

// ---------------------------------------------------------------------------
// generateCompetitorSuggestions
// ---------------------------------------------------------------------------

export interface GenerateCompetitorSuggestionsOptions {
  client: AIClient;
  input: CompetitorSuggestionInput;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface GenerateCompetitorSuggestionsResult {
  response: AICompetitorResponse;
  aiResult: CallAIResult<AICompetitorResponse>;
}

export async function generateCompetitorSuggestions(
  options: GenerateCompetitorSuggestionsOptions
): Promise<GenerateCompetitorSuggestionsResult> {
  const {
    client,
    input,
    model = "gpt-4o-mini",
    temperature = 0.5,
    maxTokens = 3000,
    timeout = 90000,
  } = options;

  const userPrompt = buildCompetitorSuggestionInput(input);

  const aiResult = await callAI<AICompetitorResponse>({
    client,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model,
    temperature,
    maxTokens,
    responseFormat: { type: "json_schema", json_schema: COMPETITOR_RESPONSE_SCHEMA },
    timeout,
    parseJson: true,
  });

  const response = aiResult.parsed ?? JSON.parse(aiResult.content) as AICompetitorResponse;

  // Validate and normalize competitor data
  response.competitors = response.competitors.map(c => ({
    ...c,
    type: normalizeCompetitorType(c.type),
    overallScore: clamp(c.overallScore, 0, 100),
    dimensions: {
      valuePropositionOverlap: clamp(c.dimensions.valuePropositionOverlap, 0, 100),
      targetAudienceMatch: clamp(c.dimensions.targetAudienceMatch, 0, 100),
      featureFunctionalityOverlap: clamp(c.dimensions.featureFunctionalityOverlap, 0, 100),
      marketPositioning: clamp(c.dimensions.marketPositioning, 0, 100),
      keywordSearchOverlap: clamp(c.dimensions.keywordSearchOverlap, 0, 100),
      categoryProximity: clamp(c.dimensions.categoryProximity, 0, 100),
    },
    threatLevel: normalizeThreatLevel(c.threatLevel),
  }));

  return { response, aiResult };
}

// ---------------------------------------------------------------------------
// Hybrid merge — combines AI scores with Jaccard similarity
// ---------------------------------------------------------------------------

export interface JaccardScore {
  slug: string;
  overall: number; // 0-1
}

/**
 * Merge AI competitor scores with Jaccard similarity scores.
 *
 * finalScore = 0.6 × AI score + 0.4 × (Jaccard × 100)
 *
 * Flags:
 * - "semantic_competitor": AI > 70 but Jaccard < 0.1 (AI sees competition that text overlap misses)
 * - "superficially_similar": Jaccard > 0.5 but AI < 30 (similar keywords but not real competitors)
 */
export function mergeCompetitorScores(
  aiCompetitors: AICompetitorScore[],
  jaccardScores: JaccardScore[],
  maxResults = 25
): MergedCompetitor[] {
  const jaccardMap = new Map(jaccardScores.map(j => [j.slug, j.overall]));
  const merged: MergedCompetitor[] = [];

  for (const ai of aiCompetitors) {
    const jaccard = jaccardMap.get(ai.slug) ?? 0;
    const finalScore = Math.round(
      HYBRID_WEIGHTS.ai * ai.overallScore + HYBRID_WEIGHTS.jaccard * (jaccard * 100)
    );

    const flags: string[] = [];
    if (ai.overallScore > 70 && jaccard < 0.1) flags.push("semantic_competitor");
    if (jaccard > 0.5 && ai.overallScore < 30) flags.push("superficially_similar");

    merged.push({
      slug: ai.slug,
      name: ai.name,
      type: ai.type,
      aiScore: ai.overallScore,
      jaccardScore: jaccard,
      finalScore,
      dimensions: ai.dimensions,
      rationale: ai.rationale,
      threatLevel: ai.threatLevel,
      flags,
    });
  }

  return merged
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeCompetitorType(value: string): CompetitorType {
  const v = value.toLowerCase();
  if (v === "direct" || v === "indirect" || v === "alternative" || v === "aspirational") return v;
  return "indirect";
}

function normalizeThreatLevel(value: string): "low" | "medium" | "high" {
  const v = value.toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}
