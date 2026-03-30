/**
 * Shared AI service layer (PLA-448).
 *
 * Centralizes OpenAI call lifecycle: client invocation, cost calculation,
 * retry logic, response parsing, and ai_logs insertion.
 *
 * Uses dependency injection so the shared package doesn't depend on
 * `openai` or `@appranks/db` — callers pass in their own instances.
 */

import { createLogger } from "./logger.js";

const log = createLogger("ai-service");

// ---------------------------------------------------------------------------
// Model pricing table (per 1M tokens, USD)
// ---------------------------------------------------------------------------

export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

export const AI_MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { promptPer1M: 2.5, completionPer1M: 10 },
  "gpt-4o-mini": { promptPer1M: 0.15, completionPer1M: 0.6 },
  "gpt-4-turbo": { promptPer1M: 10, completionPer1M: 30 },
  "gpt-4": { promptPer1M: 30, completionPer1M: 60 },
  "gpt-3.5-turbo": { promptPer1M: 0.5, completionPer1M: 1.5 },
  "o1": { promptPer1M: 15, completionPer1M: 60 },
  "o1-mini": { promptPer1M: 1.1, completionPer1M: 4.4 },
  "o3-mini": { promptPer1M: 1.1, completionPer1M: 4.4 },
};

// Default fallback when model not in the pricing table
const DEFAULT_PRICING: ModelPricing = { promptPer1M: 2.5, completionPer1M: 10 };

/**
 * Compute USD cost for a given model and token counts.
 * Returns a string with 6 decimal places (e.g. "0.003750").
 */
export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): string {
  const pricing = AI_MODEL_PRICING[model] || DEFAULT_PRICING;
  const cost =
    (promptTokens / 1_000_000) * pricing.promptPer1M +
    (completionTokens / 1_000_000) * pricing.completionPer1M;
  return cost.toFixed(6);
}

// ---------------------------------------------------------------------------
// callAI — wraps the full OpenAI call lifecycle
// ---------------------------------------------------------------------------

/** Minimal interface for an OpenAI-compatible client (dependency injection). */
export interface AIClient {
  chat: {
    completions: {
      create(
        body: Record<string, unknown>,
        options?: { timeout?: number }
      ): Promise<AICompletionResponse>;
    };
  };
}

export interface AICompletionResponse {
  choices: Array<{
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CallAIOptions {
  /** OpenAI-compatible client instance. */
  client: AIClient;
  systemPrompt: string;
  userPrompt: string;
  /** Model name (default: "gpt-4o"). */
  model?: string;
  /** Sampling temperature (default: 0.7). */
  temperature?: number;
  /** Max output tokens (default: 1000). */
  maxTokens?: number;
  /**
   * Optional response_format for structured output.
   * Pass `{ type: "json_object" }` or `{ type: "json_schema", json_schema: {...} }`.
   */
  responseFormat?: Record<string, unknown>;
  /** Per-request timeout in ms (default: 60000). */
  timeout?: number;
  /** Number of retries on transient errors (default: 0). */
  retries?: number;
  /** If true, parse response as JSON (default: false). */
  parseJson?: boolean;
}

export interface CallAIResult<T = unknown> {
  content: string;
  parsed: T | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  costUsd: string;
  model: string;
}

/** Errors that are transient and worth retrying. */
function isTransient(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string };
  if (e.status === 429) return true;
  if (e.status === 500 || e.status === 502 || e.status === 503) return true;
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET") return true;
  return false;
}

/** Check if the error is a rate-limit or quota exhaustion. */
export function isRateLimitOrQuota(err: unknown): { isRateLimit: boolean; isQuota: boolean } {
  const e = err as { status?: number; code?: string; error?: { code?: string } };
  const isQuota = e.code === "insufficient_quota" || e.error?.code === "insufficient_quota";
  const isRateLimit = e.status === 429 && !isQuota;
  return { isRateLimit, isQuota };
}

/**
 * Call an OpenAI-compatible API with retry logic, timing, and cost calculation.
 *
 * @throws on non-transient errors or after exhausting retries.
 */
export async function callAI<T = unknown>(
  options: CallAIOptions
): Promise<CallAIResult<T>> {
  const {
    client,
    systemPrompt,
    userPrompt,
    model = "gpt-4o",
    temperature = 0.7,
    maxTokens = 1000,
    responseFormat,
    timeout = 60000,
    retries = 0,
    parseJson = false,
  } = options;

  const body: Record<string, unknown> = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  let lastError: unknown;
  const maxAttempts = 1 + retries;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    try {
      const completion = await client.chat.completions.create(body, { timeout });
      const durationMs = Date.now() - startTime;

      const content = completion.choices[0]?.message?.content || "";
      const usage = completion.usage;
      const promptTokens = usage?.prompt_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? 0;
      const totalTokens = usage?.total_tokens ?? 0;

      let parsed: T | null = null;
      if (parseJson && content) {
        try {
          parsed = JSON.parse(content) as T;
        } catch {
          log.warn("failed to parse AI response as JSON", { model, contentPreview: content.slice(0, 200) });
        }
      }

      return {
        content,
        parsed,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        costUsd: computeCost(model, promptTokens, completionTokens),
        model,
      };
    } catch (err) {
      lastError = err;
      const durationMs = Date.now() - startTime;

      if (attempt < maxAttempts && isTransient(err)) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        log.warn("transient AI error, retrying", {
          attempt,
          maxAttempts,
          backoffMs: backoff,
          error: String(err),
        });
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      log.error("AI call failed", { model, durationMs, error: String(err) });
      throw err;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

// ---------------------------------------------------------------------------
// logAICall — insert into ai_logs table
// ---------------------------------------------------------------------------

export interface LogAICallParams {
  accountId: string;
  userId?: string | null;
  platform?: string;
  productType: string;
  productId?: string | null;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseContent?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
  durationMs: number;
  status: "success" | "error" | "timeout";
  errorMessage?: string | null;
  triggerType?: "manual" | "automated";
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tags?: unknown[];
}

/**
 * Insert an AI call log into the ai_logs table.
 *
 * Accepts a Drizzle db instance and the aiLogs table reference
 * so the shared package doesn't need to import @appranks/db.
 *
 * Silently catches insert errors (logging should never crash the caller).
 */
export async function logAICall(
  db: { insert(table: unknown): { values(row: Record<string, unknown>): Promise<unknown> } },
  aiLogsTable: unknown,
  params: LogAICallParams
): Promise<void> {
  try {
    await db.insert(aiLogsTable).values({
      accountId: params.accountId,
      userId: params.userId ?? null,
      platform: params.platform ?? "shopify",
      productType: params.productType,
      productId: params.productId ?? null,
      model: params.model,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      responseContent: params.responseContent ?? null,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      costUsd: params.costUsd,
      durationMs: params.durationMs,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      triggerType: params.triggerType ?? "manual",
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      tags: params.tags ?? [],
    });
  } catch (err) {
    log.warn("failed to insert AI log", { error: String(err), productType: params.productType });
  }
}
