import { describe, it, expect } from "vitest";
import { formatPlanPrice, diffPricingPlans } from "@/lib/pricing-diff";
import type { PricingPlan } from "@appranks/shared";

function makePlan(overrides: Partial<PricingPlan> & { name: string }): PricingPlan {
  return {
    price: null,
    period: null,
    yearly_price: null,
    discount_text: null,
    trial_text: null,
    features: [],
    ...overrides,
  };
}

describe("formatPlanPrice", () => {
  it("returns Free when price is null", () => {
    expect(formatPlanPrice(makePlan({ name: "Free" }))).toBe("Free");
  });

  it("formats price with default currency and period", () => {
    expect(formatPlanPrice(makePlan({ name: "Starter", price: "30", period: "month" }))).toBe("$30/month");
  });

  it("formats price without period", () => {
    expect(formatPlanPrice(makePlan({ name: "One-time", price: "99" }))).toBe("$99");
  });

  it("uses custom currency code", () => {
    expect(formatPlanPrice(makePlan({ name: "Pro", price: "50", period: "month", currency_code: "€" }))).toBe("€50/month");
  });
});

describe("diffPricingPlans", () => {
  it("returns empty diff for identical plans", () => {
    const plans = [
      makePlan({ name: "Free" }),
      makePlan({ name: "Pro", price: "30", period: "month", features: ["Feature A"] }),
    ];
    const result = diffPricingPlans(plans, plans);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it("detects added plans", () => {
    const oldPlans = [makePlan({ name: "Free" })];
    const newPlans = [makePlan({ name: "Free" }), makePlan({ name: "Pro", price: "30", period: "month" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].name).toBe("Pro");
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it("detects removed plans", () => {
    const oldPlans = [makePlan({ name: "Free" }), makePlan({ name: "Legacy", price: "10", period: "month" })];
    const newPlans = [makePlan({ name: "Free" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].name).toBe("Legacy");
    expect(result.added).toHaveLength(0);
  });

  it("detects price change", () => {
    const oldPlans = [makePlan({ name: "Starter", price: "30", period: "month" })];
    const newPlans = [makePlan({ name: "Starter", price: "35", period: "month" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].name).toBe("Starter");
    expect(result.modified[0].changes).toEqual(["Price: $30/month \u2192 $35/month"]);
  });

  it("detects period change", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "100", period: "month" })];
    const newPlans = [makePlan({ name: "Pro", price: "100", period: "year" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0]).toContain("$100/month");
    expect(result.modified[0].changes[0]).toContain("$100/year");
  });

  it("detects yearly price change", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", yearly_price: "252" })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", yearly_price: "300" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toEqual(["Yearly price: 252 \u2192 300"]);
  });

  it("detects trial text change", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", trial_text: "7-day free trial" })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", trial_text: "14-day free trial" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toEqual(["Trial: 7-day free trial \u2192 14-day free trial"]);
  });

  it("detects added features in a plan", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Feature A"] })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Feature A", "Feature B"] })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toEqual(["Added features: Feature B"]);
  });

  it("detects removed features in a plan", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Feature A", "Feature B"] })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Feature A"] })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toEqual(["Removed features: Feature B"]);
  });

  it("detects feature replacement (added + removed)", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Custom knowledge base", "AI chats"] })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["Advanced knowledge base", "AI chats"] })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toContain("Added features: Advanced knowledge base");
    expect(result.modified[0].changes).toContain("Removed features: Custom knowledge base");
  });

  it("detects multiple changes in one plan", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", trial_text: "7 days", features: ["A"] })];
    const newPlans = [makePlan({ name: "Pro", price: "50", period: "month", trial_text: "14 days", features: ["A", "B"] })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toHaveLength(3);
    expect(result.modified[0].changes[0]).toContain("Price:");
    expect(result.modified[0].changes[1]).toContain("Trial:");
    expect(result.modified[0].changes[2]).toContain("Added features: B");
  });

  it("handles complex scenario: add, remove, and modify plans", () => {
    const oldPlans = [
      makePlan({ name: "Free" }),
      makePlan({ name: "Starter", price: "30", period: "month" }),
      makePlan({ name: "Legacy", price: "10", period: "month" }),
    ];
    const newPlans = [
      makePlan({ name: "Free" }),
      makePlan({ name: "Starter", price: "35", period: "month" }),
      makePlan({ name: "Enterprise", price: "500", period: "month" }),
    ];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].name).toBe("Enterprise");
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].name).toBe("Legacy");
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].name).toBe("Starter");
    expect(result.modified[0].changes[0]).toContain("$30/month");
    expect(result.modified[0].changes[0]).toContain("$35/month");
  });

  it("ignores feature order changes (no false positive)", () => {
    const oldPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["A", "B", "C"] })];
    const newPlans = [makePlan({ name: "Pro", price: "30", period: "month", features: ["C", "A", "B"] })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(0);
  });

  it("handles empty plans arrays", () => {
    const result = diffPricingPlans([], []);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it("handles plan going from free to paid", () => {
    const oldPlans = [makePlan({ name: "Basic" })];
    const newPlans = [makePlan({ name: "Basic", price: "10", period: "month" })];
    const result = diffPricingPlans(oldPlans, newPlans);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0]).toContain("Free");
    expect(result.modified[0].changes[0]).toContain("$10/month");
  });
});
