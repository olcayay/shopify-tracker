/**
 * FAQ extraction and AI generation (PLA-333).
 *
 * Extracts FAQ data from platform pages and generates AI-powered FAQs
 * for apps and categories.
 */
import OpenAI from "openai";
import { aiLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("ai:faq");

export interface FAQ {
  question: string;
  answer: string;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60000 });
}

/**
 * Generate FAQs for an app profile page.
 */
export async function generateAppFAQs(
  db: any,
  appData: {
    name: string;
    platform: string;
    description?: string;
    pricing?: string;
    features?: string[];
    categories?: string[];
    rating?: number;
    reviewCount?: number;
  },
  options?: { userId?: string; accountId?: string }
): Promise<FAQ[]> {
  const openai = getOpenAI();

  // Rule-based FAQs (always available, no AI needed)
  const baseFAQs: FAQ[] = [];

  if (appData.pricing) {
    baseFAQs.push({
      question: `How much does ${appData.name} cost?`,
      answer: `${appData.name} pricing: ${appData.pricing}. Check the ${appData.platform} marketplace for the most current pricing information.`,
    });
  }

  if (appData.rating != null && appData.reviewCount != null) {
    baseFAQs.push({
      question: `What do users think of ${appData.name}?`,
      answer: `${appData.name} has a ${appData.rating.toFixed(1)} out of 5 star rating based on ${appData.reviewCount} reviews on the ${appData.platform} marketplace.`,
    });
  }

  if (appData.features && appData.features.length > 0) {
    baseFAQs.push({
      question: `What are the main features of ${appData.name}?`,
      answer: `Key features include: ${appData.features.slice(0, 5).join(", ")}.`,
    });
  }

  baseFAQs.push({
    question: `Is ${appData.name} available on ${appData.platform}?`,
    answer: `Yes, ${appData.name} is available on the ${appData.platform} marketplace. You can install it directly from the marketplace listing.`,
  });

  // AI-generated FAQs (if available)
  if (!openai) return baseFAQs;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Generate 3-5 helpful FAQs for an app marketplace listing. Each FAQ should be a common question a potential user might ask. Use only the data provided — do not make up facts. Return JSON: {"faqs": [{"question": "...", "answer": "..."}]}`,
        },
        {
          role: "user",
          content: `App: ${appData.name}\nPlatform: ${appData.platform}\nDescription: ${appData.description || "N/A"}\nPricing: ${appData.pricing || "N/A"}\nFeatures: ${(appData.features || []).join(", ")}\nCategories: ${(appData.categories || []).join(", ")}\nRating: ${appData.rating || "N/A"}★ (${appData.reviewCount || 0} reviews)`,
        },
      ],
      temperature: 0.5,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const aiFAQs: FAQ[] = parsed.faqs || [];

    // Log
    try {
      await db.insert(aiLogs).values({
        accountId: options?.accountId || null,
        userId: options?.userId || null,
        model: "gpt-4o",
        systemPrompt: "FAQ generation",
        userPrompt: appData.name,
        response: content,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        costUsd: "0.01",
        durationMs: 0,
        status: "success",
        productType: "seo_faq",
        triggerType: "automated",
      });
    } catch { /* ignore */ }

    return [...baseFAQs, ...aiFAQs];
  } catch (err) {
    log.warn("AI FAQ generation failed, using rule-based", { error: String(err) });
    return baseFAQs;
  }
}

/**
 * Generate FAQs for a category page.
 */
export function generateCategoryFAQs(
  categoryName: string,
  platform: string,
  appCount: number
): FAQ[] {
  return [
    {
      question: `How many ${categoryName.toLowerCase()} apps are available on ${platform}?`,
      answer: `There are currently ${appCount} ${categoryName.toLowerCase()} apps listed on the ${platform} marketplace. Rankings are updated daily.`,
    },
    {
      question: `How are ${categoryName.toLowerCase()} apps ranked?`,
      answer: `Apps are ranked based on a combination of user ratings, review count, and marketplace positioning. Our rankings are updated daily from the ${platform} marketplace.`,
    },
    {
      question: `What should I look for in a ${categoryName.toLowerCase()} app?`,
      answer: `Key factors to consider: user ratings and reviews, pricing that fits your budget, feature set that matches your needs, integration support, and developer responsiveness to support requests.`,
    },
  ];
}
