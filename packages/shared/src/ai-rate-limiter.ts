/**
 * AI suggestion rate limiter (PLA-457).
 *
 * Per-account daily limits and cooldown for AI suggestion generation.
 */

export interface AiRateLimitConfig {
  maxKeywordGenerationsPerDay: number;
  maxCompetitorAnalysesPerDay: number;
  maxTotalAiCallsPerDay: number;
  cooldownMinutes: number;
  monthlyBudgetUsd: number;
}

export const DEFAULT_AI_RATE_LIMITS: AiRateLimitConfig = {
  maxKeywordGenerationsPerDay: 5,
  maxCompetitorAnalysesPerDay: 5,
  maxTotalAiCallsPerDay: 15,
  cooldownMinutes: 60,
  monthlyBudgetUsd: parseFloat(process.env.AI_MONTHLY_BUDGET_USD || "50"),
};

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfterMinutes?: number;
}

export function checkAiRateLimit(
  dailyCounts: { keywords: number; competitors: number; total: number },
  lastGeneratedAt: Date | null,
  config: AiRateLimitConfig = DEFAULT_AI_RATE_LIMITS,
  type: "keyword" | "competitor" = "keyword"
): RateLimitCheck {
  // Check cooldown
  if (lastGeneratedAt) {
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    const elapsedMs = Date.now() - lastGeneratedAt.getTime();
    if (elapsedMs < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsedMs) / 60000);
      return {
        allowed: false,
        reason: `Please wait ${remaining} minute${remaining > 1 ? "s" : ""} before regenerating`,
        retryAfterMinutes: remaining,
      };
    }
  }

  // Check type-specific daily limit
  if (type === "keyword" && dailyCounts.keywords >= config.maxKeywordGenerationsPerDay) {
    return {
      allowed: false,
      reason: `Daily keyword generation limit reached (${config.maxKeywordGenerationsPerDay}/day)`,
    };
  }
  if (type === "competitor" && dailyCounts.competitors >= config.maxCompetitorAnalysesPerDay) {
    return {
      allowed: false,
      reason: `Daily competitor analysis limit reached (${config.maxCompetitorAnalysesPerDay}/day)`,
    };
  }

  // Check total daily limit
  if (dailyCounts.total >= config.maxTotalAiCallsPerDay) {
    return {
      allowed: false,
      reason: `Daily AI call limit reached (${config.maxTotalAiCallsPerDay}/day)`,
    };
  }

  return { allowed: true };
}

export function checkMonthlyBudget(
  currentMonthCostUsd: number,
  config: AiRateLimitConfig = DEFAULT_AI_RATE_LIMITS
): RateLimitCheck {
  if (currentMonthCostUsd >= config.monthlyBudgetUsd) {
    return {
      allowed: false,
      reason: `Monthly AI budget exceeded ($${currentMonthCostUsd.toFixed(2)}/$${config.monthlyBudgetUsd})`,
    };
  }

  const warningThreshold = config.monthlyBudgetUsd * 0.8;
  if (currentMonthCostUsd >= warningThreshold) {
    return {
      allowed: true,
      reason: `Warning: ${Math.round((currentMonthCostUsd / config.monthlyBudgetUsd) * 100)}% of monthly budget used`,
    };
  }

  return { allowed: true };
}
