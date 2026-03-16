import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePlan } from "../app-details-scraper.js";

describe("normalizePlan", () => {
  it("produces consistent key order regardless of input key order", () => {
    const planA = { name: "Starter", price: "30", period: "month", features: ["A"], trial_text: null, yearly_price: null, discount_text: null };
    const planB = { features: ["A"], trial_text: null, discount_text: null, yearly_price: null, name: "Starter", period: "month", price: "30" };
    assert.equal(JSON.stringify(normalizePlan(planA)), JSON.stringify(normalizePlan(planB)));
  });

  it("converts price to string", () => {
    const plan = normalizePlan({ name: "Pro", price: 30, period: "month" });
    assert.equal(plan.price, "30");
  });

  it("converts yearly_price to string", () => {
    const plan = normalizePlan({ name: "Pro", price: "30", yearly_price: 252 });
    assert.equal(plan.yearly_price, "252");
  });

  it("handles null/missing fields with defaults", () => {
    const plan = normalizePlan({ name: "Free" });
    assert.equal(plan.name, "Free");
    assert.equal(plan.price, null);
    assert.equal(plan.period, null);
    assert.equal(plan.yearly_price, null);
    assert.equal(plan.discount_text, null);
    assert.equal(plan.trial_text, null);
    assert.deepEqual(plan.features, []);
    assert.equal(plan.currency_code, null);
    assert.equal(plan.units, null);
  });

  it("maps plan_name to name", () => {
    const plan = normalizePlan({ plan_name: "Starter" });
    assert.equal(plan.name, "Starter");
  });

  it("prefers name over plan_name", () => {
    const plan = normalizePlan({ name: "Pro", plan_name: "Starter" });
    assert.equal(plan.name, "Pro");
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
    assert.equal(oldNormalized, newNormalized);
  });

  it("detects actual price change after normalization", () => {
    const oldPlans = [{ name: "Starter", price: "30", period: "month", features: [], trial_text: null, yearly_price: null, discount_text: null }];
    const newPlans = [{ name: "Starter", price: "35", period: "month", features: [], trial_text: null, yearly_price: null, discount_text: null }];
    const oldNormalized = JSON.stringify(oldPlans.map(normalizePlan));
    const newNormalized = JSON.stringify(newPlans.map(normalizePlan));
    assert.notEqual(oldNormalized, newNormalized);
  });

  it("detects feature change after normalization", () => {
    const oldPlans = [{ name: "Pro", price: "30", period: "month", features: ["Custom KB"], trial_text: null, yearly_price: null, discount_text: null }];
    const newPlans = [{ name: "Pro", price: "30", period: "month", features: ["Advanced KB"], trial_text: null, yearly_price: null, discount_text: null }];
    const oldNormalized = JSON.stringify(oldPlans.map(normalizePlan));
    const newNormalized = JSON.stringify(newPlans.map(normalizePlan));
    assert.notEqual(oldNormalized, newNormalized);
  });
});
