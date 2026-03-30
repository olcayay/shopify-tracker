import { describe, it, expect } from "vitest";
import { checkAiRateLimit, checkMonthlyBudget, DEFAULT_AI_RATE_LIMITS } from "../ai-rate-limiter.js";

describe("checkAiRateLimit", () => {
  it("allows when under all limits", () => {
    const result = checkAiRateLimit(
      { keywords: 0, competitors: 0, total: 0 },
      null
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks when keyword daily limit exceeded", () => {
    const result = checkAiRateLimit(
      { keywords: 5, competitors: 0, total: 5 },
      null,
      DEFAULT_AI_RATE_LIMITS,
      "keyword"
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("keyword generation limit");
  });

  it("blocks when competitor daily limit exceeded", () => {
    const result = checkAiRateLimit(
      { keywords: 0, competitors: 5, total: 5 },
      null,
      DEFAULT_AI_RATE_LIMITS,
      "competitor"
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("competitor analysis limit");
  });

  it("blocks when total daily limit exceeded", () => {
    const result = checkAiRateLimit(
      { keywords: 3, competitors: 3, total: 15 },
      null
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily AI call limit");
  });

  it("blocks during cooldown period", () => {
    const lastGenerated = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const result = checkAiRateLimit(
      { keywords: 0, competitors: 0, total: 0 },
      lastGenerated,
      { ...DEFAULT_AI_RATE_LIMITS, cooldownMinutes: 60 }
    );
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMinutes).toBeGreaterThan(0);
  });

  it("allows after cooldown period", () => {
    const lastGenerated = new Date(Date.now() - 120 * 60 * 1000); // 2h ago
    const result = checkAiRateLimit(
      { keywords: 0, competitors: 0, total: 0 },
      lastGenerated
    );
    expect(result.allowed).toBe(true);
  });
});

describe("checkMonthlyBudget", () => {
  it("allows when under budget", () => {
    const result = checkMonthlyBudget(10);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("warns at 80% budget", () => {
    const result = checkMonthlyBudget(45, { ...DEFAULT_AI_RATE_LIMITS, monthlyBudgetUsd: 50 });
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("budget used");
  });

  it("blocks when budget exceeded", () => {
    const result = checkMonthlyBudget(55, { ...DEFAULT_AI_RATE_LIMITS, monthlyBudgetUsd: 50 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("budget exceeded");
  });
});
