/**
 * Review sentiment analysis with AI (PLA-329).
 *
 * Extracts pros/cons from reviews and generates sentiment summaries.
 */
import OpenAI from "openai";
import { aiLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("ai:sentiment");

const PROMPT_COST_PER_M = 2.5;
const COMPLETION_COST_PER_M = 10;

export interface ReviewSentiment {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score: number; // -1 to 1
  pros: string[];
  cons: string[];
  summary: string;
  topics: string[];
}

export interface BatchSentimentResult {
  appName: string;
  overallSentiment: "positive" | "negative" | "neutral" | "mixed";
  averageScore: number;
  topPros: string[];
  topCons: string[];
  summary: string;
  reviewCount: number;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60000 });
}

/**
 * Analyze sentiment of a batch of reviews for an app.
 */
export async function analyzeReviewSentiment(
  db: any,
  appName: string,
  reviews: { body: string; rating: number; author?: string }[],
  options?: { userId?: string; accountId?: string }
): Promise<BatchSentimentResult | null> {
  const openai = getOpenAI();
  if (!openai) {
    log.warn("OpenAI not configured — skipping sentiment analysis");
    return null;
  }

  if (reviews.length === 0) return null;

  // Take up to 20 reviews for analysis (cost control)
  const sample = reviews.slice(0, 20);
  const reviewTexts = sample
    .map((r, i) => `Review ${i + 1} (${r.rating}★${r.author ? ` by ${r.author}` : ""}): ${r.body}`)
    .join("\n\n");

  const systemPrompt = `You are a review analyst. Analyze the following app reviews and extract:
1. Overall sentiment (positive/negative/neutral/mixed)
2. Sentiment score (-1 to 1, where -1 is very negative, 1 is very positive)
3. Top pros (3-5 bullet points — what users love)
4. Top cons (3-5 bullet points — what users complain about)
5. A 2-3 sentence summary of the overall user sentiment
6. Key topics mentioned (e.g., "customer support", "pricing", "ease of use")

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "score": 0.75,
  "pros": ["..."],
  "cons": ["..."],
  "summary": "...",
  "topics": ["..."]
}`;

  const userPrompt = `App: ${appName}\nNumber of reviews: ${reviews.length} (showing ${sample.length})\n\n${reviewTexts}`;
  const model = "gpt-4o";
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const usage = response.usage;
    const durationMs = Date.now() - startTime;

    let parsed: ReviewSentiment;
    try {
      parsed = JSON.parse(content);
    } catch {
      log.warn("failed to parse sentiment JSON", { content });
      return null;
    }

    // Log to aiLogs
    try {
      await db.insert(aiLogs).values({
        accountId: options?.accountId || null,
        userId: options?.userId || null,
        model,
        systemPrompt,
        userPrompt: userPrompt.slice(0, 5000), // Truncate for storage
        response: content,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        costUsd: usage
          ? ((usage.prompt_tokens / 1_000_000) * PROMPT_COST_PER_M +
             (usage.completion_tokens / 1_000_000) * COMPLETION_COST_PER_M).toFixed(6)
          : "0",
        durationMs,
        status: "success",
        productType: "review_sentiment",
        triggerType: "automated",
      });
    } catch { /* ignore log errors */ }

    return {
      appName,
      overallSentiment: parsed.sentiment || "neutral",
      averageScore: parsed.score || 0,
      topPros: parsed.pros || [],
      topCons: parsed.cons || [],
      summary: parsed.summary || "",
      reviewCount: reviews.length,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error("sentiment analysis failed", { appName, error: String(err) });

    try {
      await db.insert(aiLogs).values({
        accountId: options?.accountId || null,
        userId: options?.userId || null,
        model,
        systemPrompt,
        userPrompt: userPrompt.slice(0, 5000),
        response: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: "0",
        durationMs,
        status: "error",
        error: String(err),
        productType: "review_sentiment",
        triggerType: "automated",
      });
    } catch { /* ignore */ }

    return null;
  }
}

/**
 * Simple rule-based sentiment (no AI needed — for when OpenAI isn't available).
 */
export function quickSentiment(reviews: { body: string; rating: number }[]): {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  avgRating: number;
} {
  if (reviews.length === 0) return { sentiment: "neutral", avgRating: 0 };

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  if (avgRating >= 4.0) return { sentiment: "positive", avgRating };
  if (avgRating <= 2.5) return { sentiment: "negative", avgRating };
  if (reviews.some((r) => r.rating >= 4) && reviews.some((r) => r.rating <= 2)) {
    return { sentiment: "mixed", avgRating };
  }
  return { sentiment: "neutral", avgRating };
}
