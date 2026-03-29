/**
 * AI content generation pipeline for SEO pages (PLA-328).
 *
 * Generates:
 * - App comparison analysis text
 * - Category overview descriptions
 * - "Best of" listicle introductions
 * - App profile extended descriptions
 */
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { aiLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("ai:content");

// Cost per 1M tokens (GPT-4o pricing)
const PROMPT_COST_PER_M = 2.5;
const COMPLETION_COST_PER_M = 10;

interface ContentGenerationParams {
  db: any;
  type: "comparison" | "category_overview" | "best_of_intro" | "app_description";
  context: Record<string, unknown>;
  userId?: string;
  accountId?: string;
}

interface ContentResult {
  content: string;
  tokensUsed: { prompt: number; completion: number };
  model: string;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60000 });
}

const SYSTEM_PROMPTS: Record<string, string> = {
  comparison: `You are an app marketplace analyst writing a comparison article. Write in a professional, objective tone. Focus on factual differences — ratings, features, pricing, and use cases. Do not make up data. Use the provided data only. Output 2-3 paragraphs.`,

  category_overview: `You are writing a category overview for an app marketplace directory. Describe what this category of apps does, who needs them, and what to look for when choosing one. Write 2-3 informative paragraphs suitable for SEO. Do not mention specific apps unless provided in context.`,

  best_of_intro: `You are writing an introduction for a "Best of" listicle article about marketplace apps. Write 1-2 engaging paragraphs that explain why these apps matter and what criteria were used to rank them. Be concise and SEO-friendly.`,

  app_description: `You are writing an enhanced description for an app marketplace listing page. Based on the app data provided, write 2-3 paragraphs describing what the app does, its key features, and who it's best for. Use facts from the provided data only.`,
};

function buildUserPrompt(type: string, context: Record<string, unknown>): string {
  switch (type) {
    case "comparison":
      return `Compare these two apps:\n\nApp 1: ${context.app1Name} (${context.app1Rating}★, ${context.app1Reviews} reviews, ${context.app1Pricing})\nFeatures: ${context.app1Features}\n\nApp 2: ${context.app2Name} (${context.app2Rating}★, ${context.app2Reviews} reviews, ${context.app2Pricing})\nFeatures: ${context.app2Features}\n\nPlatform: ${context.platform}`;

    case "category_overview":
      return `Write an overview for the "${context.categoryName}" category on ${context.platform}.\nTotal apps: ${context.appCount}\nTop apps: ${context.topApps}\nAverage rating: ${context.avgRating}`;

    case "best_of_intro":
      return `Write an intro for "Best ${context.categoryName} Apps for ${context.platform} (${context.year})".\nTotal apps ranked: ${context.appCount}\nTop app: ${context.topAppName} (${context.topAppRating}★)`;

    case "app_description":
      return `App: ${context.appName}\nPlatform: ${context.platform}\nRating: ${context.rating}★ (${context.reviewCount} reviews)\nPricing: ${context.pricing}\nFeatures: ${context.features}\nCategories: ${context.categories}\nDeveloper: ${context.developer}`;

    default:
      return JSON.stringify(context);
  }
}

export async function generateContent(params: ContentGenerationParams): Promise<ContentResult | null> {
  const openai = getOpenAI();
  if (!openai) {
    log.warn("OpenAI not configured — skipping content generation");
    return null;
  }

  const { db, type, context, userId, accountId } = params;
  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.app_description;
  const userPrompt = buildUserPrompt(type, context);
  const model = "gpt-4o";
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    const usage = response.usage;
    const durationMs = Date.now() - startTime;

    // Log to aiLogs
    try {
      await db.insert(aiLogs).values({
        accountId: accountId || null,
        userId: userId || null,
        model,
        systemPrompt,
        userPrompt,
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
        productType: `seo_${type}`,
        triggerType: "automated",
      });
    } catch (logErr) {
      log.warn("failed to log AI call", { error: String(logErr) });
    }

    return {
      content,
      tokensUsed: {
        prompt: usage?.prompt_tokens || 0,
        completion: usage?.completion_tokens || 0,
      },
      model,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    log.error("AI content generation failed", { type, error: String(err) });

    try {
      await db.insert(aiLogs).values({
        accountId: accountId || null,
        userId: userId || null,
        model,
        systemPrompt,
        userPrompt,
        response: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: "0",
        durationMs,
        status: "error",
        error: String(err),
        productType: `seo_${type}`,
        triggerType: "automated",
      });
    } catch { /* ignore log errors */ }

    return null;
  }
}
