import { describe, it, expect } from "vitest";
import { normalizePricingModel, PRICING_MODELS } from "../normalize-pricing.js";

describe("normalizePricingModel", () => {
  // --- Free ---
  it.each([
    ["Free", "Free"],
    ["free", "Free"],
    ["FREE", "Free"],
    ["  free  ", "Free"],
    ["Free!", "Free"],
  ])('maps "%s" to "Free"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Freemium ---
  it.each([
    ["Freemium", "Freemium"],
    ["freemium", "Freemium"],
    ["Free plan available", "Freemium"],
    ["free plan available", "Freemium"],
    ["FREE_PLAN_AVAILABLE", "Freemium"],
    ["Free with paid features", "Freemium"],
  ])('maps "%s" to "Freemium"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Free trial ---
  it.each([
    ["Free trial", "Free trial"],
    ["Free trial available", "Free trial"],
    ["free_trial", "Free trial"],
    ["FREE TRIAL", "Free trial"],
  ])('maps "%s" to "Free trial"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Free to install ---
  it.each([
    ["Free to install", "Free to install"],
    ["free to install", "Free to install"],
  ])('maps "%s" to "Free to install"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Paid ---
  it.each([
    ["Paid", "Paid"],
    ["paid", "Paid"],
    ["PAID", "Paid"],
    ["monthly", "Paid"],
    ["MONTHLY", "Paid"],
    ["annual", "Paid"],
    ["annually", "Paid"],
  ])('maps "%s" to "Paid"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Dynamic pricing strings → Paid ---
  it.each([
    ["From $9.99/month", "Paid"],
    ["From $5/mo", "Paid"],
    ["From $99/yr", "Paid"],
    ["$4.99/mo", "Paid"],
    ["$29/month", "Paid"],
  ])('maps dynamic pricing "%s" to "Paid"', (raw, expected) => {
    expect(normalizePricingModel(raw)).toBe(expected);
  });

  // --- Null / empty / unknown ---
  it("returns null for null", () => {
    expect(normalizePricingModel(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizePricingModel(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePricingModel("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizePricingModel("   ")).toBeNull();
  });

  it("returns null for unknown string", () => {
    expect(normalizePricingModel("something random")).toBeNull();
  });

  it("returns null for 'unknown'", () => {
    expect(normalizePricingModel("unknown")).toBeNull();
  });
});

describe("PRICING_MODELS", () => {
  it("has all expected values", () => {
    expect(PRICING_MODELS.FREE).toBe("Free");
    expect(PRICING_MODELS.FREEMIUM).toBe("Freemium");
    expect(PRICING_MODELS.FREE_TRIAL).toBe("Free trial");
    expect(PRICING_MODELS.FREE_TO_INSTALL).toBe("Free to install");
    expect(PRICING_MODELS.PAID).toBe("Paid");
  });
});
