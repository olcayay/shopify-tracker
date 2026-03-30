import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeCost,
  callAI,
  logAICall,
  isRateLimitOrQuota,
  AI_MODEL_PRICING,
} from "../ai-service.js";
import type { AIClient, AICompletionResponse } from "../ai-service.js";

// ---------------------------------------------------------------------------
// computeCost
// ---------------------------------------------------------------------------
describe("computeCost", () => {
  it("calculates gpt-4o cost correctly", () => {
    // 1000 prompt tokens * 2.5 / 1M + 500 completion tokens * 10 / 1M
    // = 0.0025 + 0.005 = 0.0075
    expect(computeCost("gpt-4o", 1000, 500)).toBe("0.007500");
  });

  it("calculates gpt-4o-mini cost correctly", () => {
    // 10000 prompt * 0.15 / 1M + 5000 completion * 0.6 / 1M
    // = 0.0015 + 0.003 = 0.0045
    expect(computeCost("gpt-4o-mini", 10000, 5000)).toBe("0.004500");
  });

  it("returns zero for zero tokens", () => {
    expect(computeCost("gpt-4o", 0, 0)).toBe("0.000000");
  });

  it("uses default pricing for unknown models", () => {
    // Default = gpt-4o pricing (2.5 / 10)
    expect(computeCost("unknown-model", 1000, 500)).toBe("0.007500");
  });

  it("handles large token counts", () => {
    // 1M prompt tokens at gpt-4o = $2.50, 1M completion = $10
    expect(computeCost("gpt-4o", 1_000_000, 1_000_000)).toBe("12.500000");
  });

  it("has pricing entries for all common models", () => {
    const models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"];
    for (const model of models) {
      expect(AI_MODEL_PRICING[model]).toBeDefined();
      expect(AI_MODEL_PRICING[model].promptPer1M).toBeGreaterThan(0);
      expect(AI_MODEL_PRICING[model].completionPer1M).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isRateLimitOrQuota
// ---------------------------------------------------------------------------
describe("isRateLimitOrQuota", () => {
  it("detects rate limit (429 without quota)", () => {
    const result = isRateLimitOrQuota({ status: 429, code: "rate_limit_exceeded" });
    expect(result.isRateLimit).toBe(true);
    expect(result.isQuota).toBe(false);
  });

  it("detects quota exhaustion", () => {
    const result = isRateLimitOrQuota({ code: "insufficient_quota" });
    expect(result.isRateLimit).toBe(false);
    expect(result.isQuota).toBe(true);
  });

  it("detects quota from nested error", () => {
    const result = isRateLimitOrQuota({ status: 429, error: { code: "insufficient_quota" } });
    expect(result.isRateLimit).toBe(false);
    expect(result.isQuota).toBe(true);
  });

  it("returns false for non-rate-limit errors", () => {
    const result = isRateLimitOrQuota({ status: 500, code: "server_error" });
    expect(result.isRateLimit).toBe(false);
    expect(result.isQuota).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// callAI
// ---------------------------------------------------------------------------
function createMockClient(
  response: Partial<AICompletionResponse> = {}
): AIClient {
  const defaultResponse: AICompletionResponse = {
    choices: [{ message: { content: response.choices?.[0]?.message?.content ?? '{"result": "ok"}' } }],
    usage: response.usage ?? { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(defaultResponse),
      },
    },
  };
}

describe("callAI", () => {
  it("returns parsed result with tokens, cost, and duration", async () => {
    const client = createMockClient();
    const result = await callAI({
      client,
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe('{"result": "ok"}');
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
    expect(result.model).toBe("gpt-4o");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(parseFloat(result.costUsd)).toBeGreaterThan(0);
    expect(result.parsed).toBeNull(); // parseJson not set
  });

  it("parses JSON when parseJson is true", async () => {
    const client = createMockClient({
      choices: [{ message: { content: '{"name": "test"}' } }],
    });
    const result = await callAI<{ name: string }>({
      client,
      systemPrompt: "test",
      userPrompt: "test",
      parseJson: true,
    });

    expect(result.parsed).toEqual({ name: "test" });
  });

  it("returns null parsed on invalid JSON with parseJson", async () => {
    const client = createMockClient({
      choices: [{ message: { content: "not json" } }],
    });
    const result = await callAI({
      client,
      systemPrompt: "test",
      userPrompt: "test",
      parseJson: true,
    });

    expect(result.parsed).toBeNull();
    expect(result.content).toBe("not json");
  });

  it("passes correct parameters to the client", async () => {
    const client = createMockClient();
    await callAI({
      client,
      systemPrompt: "system",
      userPrompt: "user",
      model: "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 500,
      responseFormat: { type: "json_object" },
      timeout: 30000,
    });

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledWith(
      {
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "user" },
        ],
        response_format: { type: "json_object" },
      },
      { timeout: 30000 }
    );
  });

  it("retries on transient errors", async () => {
    const transientError = Object.assign(new Error("rate limited"), { status: 429 });
    const successResponse: AICompletionResponse = {
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    const createFn = vi.fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(successResponse);

    const client: AIClient = { chat: { completions: { create: createFn } } };

    const result = await callAI({
      client,
      systemPrompt: "test",
      userPrompt: "test",
      retries: 1,
    });

    expect(createFn).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("ok");
  });

  it("throws after exhausting retries", async () => {
    const transientError = Object.assign(new Error("server error"), { status: 500 });
    const createFn = vi.fn().mockRejectedValue(transientError);
    const client: AIClient = { chat: { completions: { create: createFn } } };

    await expect(
      callAI({ client, systemPrompt: "test", userPrompt: "test", retries: 1 })
    ).rejects.toThrow("server error");

    expect(createFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors", async () => {
    const error = Object.assign(new Error("bad request"), { status: 400 });
    const createFn = vi.fn().mockRejectedValue(error);
    const client: AIClient = { chat: { completions: { create: createFn } } };

    await expect(
      callAI({ client, systemPrompt: "test", userPrompt: "test", retries: 2 })
    ).rejects.toThrow("bad request");

    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it("handles empty response content gracefully", async () => {
    const response: AICompletionResponse = {
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
    };
    const client: AIClient = {
      chat: { completions: { create: vi.fn().mockResolvedValue(response) } },
    };
    const result = await callAI({
      client,
      systemPrompt: "test",
      userPrompt: "test",
    });
    expect(result.content).toBe("");
  });
});

// ---------------------------------------------------------------------------
// logAICall
// ---------------------------------------------------------------------------
describe("logAICall", () => {
  it("inserts log entry into the db", async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
    const mockDb = { insert: insertFn };
    const mockTable = Symbol("aiLogs");

    await logAICall(mockDb, mockTable, {
      accountId: "acc-1",
      userId: "user-1",
      productType: "test",
      model: "gpt-4o",
      systemPrompt: "sys",
      userPrompt: "usr",
      responseContent: "resp",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: "0.007500",
      durationMs: 1234,
      status: "success",
    });

    expect(insertFn).toHaveBeenCalledWith(mockTable);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-1",
        userId: "user-1",
        productType: "test",
        model: "gpt-4o",
        status: "success",
        costUsd: "0.007500",
      })
    );
  });

  it("does not throw when db insert fails", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB down")),
      }),
    };

    // Should not throw
    await logAICall(mockDb, "table", {
      accountId: "acc-1",
      productType: "test",
      model: "gpt-4o",
      systemPrompt: "s",
      userPrompt: "u",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: "0",
      durationMs: 0,
      status: "error",
    });
  });

  it("applies defaults for optional fields", async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined);
    const mockDb = { insert: vi.fn().mockReturnValue({ values: valuesFn }) };

    await logAICall(mockDb, "table", {
      accountId: "acc-1",
      productType: "test",
      model: "gpt-4o",
      systemPrompt: "s",
      userPrompt: "u",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: "0",
      durationMs: 0,
      status: "success",
    });

    const row = valuesFn.mock.calls[0][0];
    expect(row.userId).toBeNull();
    expect(row.platform).toBe("shopify");
    expect(row.triggerType).toBe("manual");
    expect(row.metadata).toBeNull();
    expect(row.tags).toEqual([]);
  });
});
