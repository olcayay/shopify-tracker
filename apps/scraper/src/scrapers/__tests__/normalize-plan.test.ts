import { describe, it, expect } from "vitest";
import { normalizePlan } from "../app-details-scraper.js";

describe("normalizePlan", () => {
  it("produces consistent key order regardless of input key order", () => {
    const planA = { name: "Starter", price: "30", period: "month", features: ["A"], trial_text: null, yearly_price: null, discount_text: null };
    const planB = { features: ["A"], trial_text: null, discount_text: null, yearly_price: null, name: "Starter", period: "month", price: "30" };
    expect(JSON.stringify(normalizePlan(planA))).toBe(JSON.stringify(normalizePlan(planB)));
  });

  it("converts price to string", () => {
    const plan = normalizePlan({ name: "Pro", price: 30, period: "month" });
    expect(plan.price).toBe("30");
  });

  it("converts yearly_price to string", () => {
    const plan = normalizePlan({ name: "Pro", price: "30", yearly_price: 252 });
    expect(plan.yearly_price).toBe("252");
  });

  it("handles null/missing fields with defaults", () => {
    const plan = normalizePlan({ name: "Free" });
    expect(plan.name).toBe("Free");
    expect(plan.price).toBe(null);
    expect(plan.period).toBe(null);
    expect(plan.yearly_price).toBe(null);
    expect(plan.discount_text).toBe(null);
    expect(plan.trial_text).toBe(null);
    expect(plan.features).toEqual([]);
    expect(plan.currency_code).toBe(null);
    expect(plan.units).toBe(null);
  });

  it("maps plan_name to name", () => {
    const plan = normalizePlan({ plan_name: "Starter" });
    expect(plan.name).toBe("Starter");
  });

  it("prefers name over plan_name", () => {
    const plan = normalizePlan({ name: "Pro", plan_name: "Starter" });
    expect(plan.name).toBe("Pro");
  });

  it("prevents false positive from key reordering", () => {
    const oldPlans = [
      { name: "Free", price: null, period: null, features: ["AI chats"], trial_text: null, yearly_price: null, discount_text: null },
    ];
    const newPlans = [
      { name: "Free", price: null, period: null, yearly_price: null, discount_text: null, trial_text: null, features: ["AI chats"] },
    ];
    const oldNormalized = JSON.stringify(oldPlans.map(normalizePlan));
    const newNormalized = JSON.stringify(newPlans.map(normalizePlan));
    expect(oldNormalized).toBe(newNormalized);
  });

  it("detects actual price change after normalization", () => {
    const oldPlans = [{ name: "Starter", price: "30", period: "month", features: [], trial_text: null, yearly_price: null, discount_text: null }];
    const newPlans = [{ name: "Starter", price: "35", period: "month", features: [], trial_text: null, yearly_price: null, discount_text: null }];
    const oldNormalized = JSON.stringify(oldPlans.map(normalizePlan));
    const newNormalized = JSON.stringify(newPlans.map(normalizePlan));
    expect(oldNormalized).not.toBe(newNormalized);
  });

  it("detects feature change after normalization", () => {
    const oldPlans = [{ name: "Pro", price: "30", period: "month", features: ["Custom KB"], trial_text: null, yearly_price: null, discount_text: null }];
    const newPlans = [{ name: "Pro", price: "30", period: "month", features: ["Advanced KB"], trial_text: null, yearly_price: null, discount_text: null }];
    const oldNormalized = JSON.stringify(oldPlans.map(normalizePlan));
    const newNormalized = JSON.stringify(newPlans.map(normalizePlan));
    expect(oldNormalized).not.toBe(newNormalized);
  });
});
