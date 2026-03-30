/**
 * AI keyword suggestion engine (PLA-449).
 *
 * ASO-inspired 5-tier keyword model that generates semantic keywords
 * beyond what n-gram extraction can find. Combines AI-generated keywords
 * with existing n-gram results via hybrid scoring.
 */

import type { AIClient, CallAIResult } from "./ai-service.js";
import { callAI } from "./ai-service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeywordTier = 1 | 2 | 3 | 4 | 5;
export type SearchIntent = "navigational" | "informational" | "transactional" | "commercial";
export type Competitiveness = "low" | "medium" | "high";

export interface AIKeywordSuggestion {
  keyword: string;
  tier: KeywordTier;
  score: number;          // 0-100
  rationale: string;
  source: string;         // which field(s) inspired this keyword
  competitiveness: Competitiveness;
  searchIntent: SearchIntent;
}

export interface AIKeywordResponse {
  appSummary: string;
  primaryCategory: string;
  targetAudience: string;
  keywords: AIKeywordSuggestion[];
}

export interface KeywordSuggestionInput {
  /** App name */
  name: string;
  /** App subtitle / tagline */
  subtitle: string | null;
  /** App introduction (first ~100 chars shown above fold) */
  introduction: string | null;
  /** Full app description */
  description: string | null;
  /** App feature list */
  features: string[];
  /** Category names the app belongs to */
  categories: string[];
  /** Pricing plan names and features */
  pricingPlans?: Array<{ name: string; features?: string[] }>;
  /** Developer name */
  developerName?: string | null;
  /** Platform (e.g. "shopify", "salesforce") */
  platform: string;
  /** Existing tracked keywords for this app */
  existingKeywords?: string[];
  /** Competitor keyword data: keyword → number of competitors using it */
  competitorKeywords?: Record<string, number>;
  /** Top keywords in the app's primary category */
  categoryTopKeywords?: string[];
  /** Top n-gram keywords from extractKeywordsFromAppMetadata (top 20) */
  ngramTopKeywords?: Array<{ keyword: string; score: number }>;
}

export interface MergedKeyword {
  keyword: string;
  tier: KeywordTier;
  score: number;          // final merged score (0-100)
  rationale: string;
  source: string;
  competitiveness: Competitiveness;
  searchIntent: SearchIntent;
  fromAI: boolean;
  fromNgram: boolean;
}

// ---------------------------------------------------------------------------
// ASO Weight Model (used in prompt to guide AI)
// ---------------------------------------------------------------------------

export const ASO_WEIGHTS = {
  appTitle: 10,
  subtitle: 7,
  introduction: 5,
  features: 4,
  categories: 3,
  description: 2,
  pricingPlans: 1,
  developerName: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Tier definitions (used in prompt)
// ---------------------------------------------------------------------------

export const KEYWORD_TIERS = {
  1: { name: "Direct Match", range: [90, 100] as const, description: "Primary function keywords — exact match for what the app does" },
  2: { name: "Feature Keywords", range: [70, 89] as const, description: "Specific features the app offers" },
  3: { name: "Problem/Intent", range: [50, 69] as const, description: "Problems the app solves, user intents" },
  4: { name: "Adjacent/Semantic", range: [30, 49] as const, description: "Related terms, synonyms, industry jargon" },
  5: { name: "Long-tail Opportunities", range: [10, 29] as const, description: "Multi-word search phrases, niche queries" },
} as const;

// ---------------------------------------------------------------------------
// Input builder — collects all metadata into a prompt-ready format
// ---------------------------------------------------------------------------

export function buildKeywordSuggestionInput(input: KeywordSuggestionInput): string {
  const sections: string[] = [];

  sections.push(`Platform: ${input.platform}`);
  sections.push(`App Name (10x weight): ${input.name}`);

  if (input.subtitle) {
    sections.push(`Subtitle (7x weight): ${input.subtitle}`);
  }
  if (input.introduction) {
    sections.push(`Introduction (5x weight): ${input.introduction.slice(0, 200)}`);
  }
  if (input.features.length > 0) {
    sections.push(`Features (4x weight): ${input.features.join(", ")}`);
  }
  if (input.categories.length > 0) {
    sections.push(`Categories (3x weight): ${input.categories.join(", ")}`);
  }
  if (input.description) {
    sections.push(`Description (2x weight): ${input.description.slice(0, 500)}`);
  }
  if (input.pricingPlans && input.pricingPlans.length > 0) {
    const plans = input.pricingPlans.map(p => {
      const features = p.features?.slice(0, 5).join(", ") || "";
      return `${p.name}${features ? `: ${features}` : ""}`;
    }).join("; ");
    sections.push(`Pricing Plans (1x weight): ${plans}`);
  }
  if (input.developerName) {
    sections.push(`Developer (0.5x weight): ${input.developerName}`);
  }

  // Context data
  if (input.existingKeywords && input.existingKeywords.length > 0) {
    sections.push(`\nAlready tracked keywords (avoid duplicates): ${input.existingKeywords.slice(0, 30).join(", ")}`);
  }
  if (input.competitorKeywords && Object.keys(input.competitorKeywords).length > 0) {
    const top = Object.entries(input.competitorKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([kw, count]) => `${kw} (${count} competitors)`)
      .join(", ");
    sections.push(`Competitor keywords: ${top}`);
  }
  if (input.categoryTopKeywords && input.categoryTopKeywords.length > 0) {
    sections.push(`Category top keywords: ${input.categoryTopKeywords.slice(0, 15).join(", ")}`);
  }
  if (input.ngramTopKeywords && input.ngramTopKeywords.length > 0) {
    const ngrams = input.ngramTopKeywords.slice(0, 20).map(k => `${k.keyword} (${k.score.toFixed(1)})`).join(", ");
    sections.push(`N-gram keywords (already extracted): ${ngrams}`);
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an App Store Optimization (ASO) keyword specialist. Given app metadata and context, generate 30-50 keyword suggestions using the ASO 5-Tier model.

## ASO Weight Model
Higher-weighted fields are stronger ranking signals:
- App Title (10x) — most important for rankings
- Subtitle/Tagline (7x) — second strongest signal
- Introduction first 100 chars (5x) — above-the-fold visibility
- Features list (4x) — indexed, user-visible
- Category names (3x) — broad relevance signal
- Description (2x) — indexed but diluted
- Pricing plan names (1x) — niche signal
- Developer name (0.5x) — brand keyword

## 5-Tier Keyword Model
Assign each keyword to exactly one tier:

Tier 1 (score 90-100) — Direct Match: Primary function keywords that exactly describe what the app does. 3-5 keywords.
Tier 2 (score 70-89) — Feature Keywords: Specific features offered. 8-12 keywords.
Tier 3 (score 50-69) — Problem/Intent: Problems solved, user pain points, goals. 8-12 keywords.
Tier 4 (score 30-49) — Adjacent/Semantic: Related terms, synonyms, industry jargon. 6-10 keywords.
Tier 5 (score 10-29) — Long-tail Opportunities: Multi-word search phrases, niche queries. 5-10 keywords.

## Rules
1. Keywords should be lowercase, 1-4 words each
2. Do NOT repeat keywords already in "Already tracked keywords" ��� suggest NEW ones
3. Prioritize gaps: keywords competitors use but this app doesn't track
4. Include both head terms (1-2 words) and long-tail phrases (3-4 words)
5. Consider user search intent (transactional, informational, commercial, navigational)
6. Rate competitiveness based on how many competitors target the keyword
7. Be platform-aware — use terminology specific to the marketplace
8. "rationale" should explain WHY this keyword is relevant (1 sentence)
9. "source" should indicate which field(s) from the app data inspired the keyword

Respond ONLY with valid JSON matching the required schema.`;

// ---------------------------------------------------------------------------
// Response JSON schema (for OpenAI structured output)
// ---------------------------------------------------------------------------

export const KEYWORD_RESPONSE_SCHEMA = {
  name: "keyword_suggestions",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      appSummary: { type: "string" as const },
      primaryCategory: { type: "string" as const },
      targetAudience: { type: "string" as const },
      keywords: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            keyword: { type: "string" as const },
            tier: { type: "number" as const },
            score: { type: "number" as const },
            rationale: { type: "string" as const },
            source: { type: "string" as const },
            competitiveness: { type: "string" as const },
            searchIntent: { type: "string" as const },
          },
          required: ["keyword", "tier", "score", "rationale", "source", "competitiveness", "searchIntent"] as const,
          additionalProperties: false as const,
        },
      },
    },
    required: ["appSummary", "primaryCategory", "targetAudience", "keywords"] as const,
    additionalProperties: false as const,
  },
};

// ---------------------------------------------------------------------------
// generateKeywordSuggestions — call AI to generate keyword suggestions
// ---------------------------------------------------------------------------

export interface GenerateKeywordSuggestionsOptions {
  client: AIClient;
  input: KeywordSuggestionInput;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface GenerateKeywordSuggestionsResult {
  response: AIKeywordResponse;
  aiResult: CallAIResult<AIKeywordResponse>;
}

export async function generateKeywordSuggestions(
  options: GenerateKeywordSuggestionsOptions
): Promise<GenerateKeywordSuggestionsResult> {
  const {
    client,
    input,
    model = "gpt-4o-mini",
    temperature = 0.7,
    maxTokens = 2000,
    timeout = 60000,
  } = options;

  const userPrompt = buildKeywordSuggestionInput(input);

  const aiResult = await callAI<AIKeywordResponse>({
    client,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model,
    temperature,
    maxTokens,
    responseFormat: { type: "json_schema", json_schema: KEYWORD_RESPONSE_SCHEMA },
    timeout,
    parseJson: true,
  });

  const response = aiResult.parsed ?? JSON.parse(aiResult.content) as AIKeywordResponse;

  // Validate and clamp keyword data
  response.keywords = response.keywords.map(kw => ({
    ...kw,
    keyword: kw.keyword.toLowerCase().trim(),
    tier: clampTier(kw.tier),
    score: Math.max(0, Math.min(100, Math.round(kw.score))),
    competitiveness: normalizeCompetitiveness(kw.competitiveness),
    searchIntent: normalizeSearchIntent(kw.searchIntent),
  }));

  return { response, aiResult };
}

// ---------------------------------------------------------------------------
// Hybrid merge — combines AI suggestions with n-gram results
// ---------------------------------------------------------------------------

export interface NgramKeyword {
  keyword: string;
  score: number;  // raw n-gram score (not 0-100)
}

/**
 * Merge AI-generated keywords with n-gram extracted keywords.
 *
 * Scoring rules:
 * - Both AI + n-gram → boost AI score by 20% (capped at 100)
 * - N-gram only → map to tier 2 with normalized score
 * - AI only → use AI score as-is
 *
 * Returns deduplicated, sorted (by score desc) list of merged keywords.
 */
export function mergeKeywords(
  aiKeywords: AIKeywordSuggestion[],
  ngramKeywords: NgramKeyword[],
  maxResults = 50
): MergedKeyword[] {
  const merged = new Map<string, MergedKeyword>();

  // Add AI keywords first
  for (const kw of aiKeywords) {
    const key = kw.keyword.toLowerCase().trim();
    if (!key) continue;
    merged.set(key, {
      keyword: key,
      tier: kw.tier,
      score: kw.score,
      rationale: kw.rationale,
      source: kw.source,
      competitiveness: kw.competitiveness,
      searchIntent: kw.searchIntent,
      fromAI: true,
      fromNgram: false,
    });
  }

  // Normalize n-gram scores to 0-100 range
  const maxNgramScore = ngramKeywords.reduce((max, k) => Math.max(max, k.score), 0) || 1;

  for (const ngram of ngramKeywords) {
    const key = ngram.keyword.toLowerCase().trim();
    if (!key) continue;
    const normalizedScore = Math.round((ngram.score / maxNgramScore) * 80); // max 80 for n-gram only

    const existing = merged.get(key);
    if (existing) {
      // Both AI + n-gram — boost score by 20%
      existing.score = Math.min(100, Math.round(existing.score * 1.2));
      existing.fromNgram = true;
    } else {
      // N-gram only — assign tier 2, use normalized score
      merged.set(key, {
        keyword: key,
        tier: 2,
        score: normalizedScore,
        rationale: "Extracted from app metadata via n-gram analysis",
        source: "n-gram",
        competitiveness: "medium",
        searchIntent: "commercial",
        fromAI: false,
        fromNgram: true,
      });
    }
  }

  // Sort by score descending, take top N
  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampTier(tier: number): KeywordTier {
  const t = Math.round(tier);
  if (t >= 1 && t <= 5) return t as KeywordTier;
  if (t < 1) return 1;
  return 5;
}

function normalizeCompetitiveness(value: string): Competitiveness {
  const v = value.toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

function normalizeSearchIntent(value: string): SearchIntent {
  const v = value.toLowerCase();
  if (v === "navigational" || v === "informational" || v === "transactional" || v === "commercial") return v;
  return "commercial";
}
