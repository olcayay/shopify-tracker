import { describe, it, expect } from "vitest";
import { isCompetitorEventEmailWorthy } from "../event-dispatcher.js";
import type { DetectedEvent } from "../event-detector.js";

function makeEvent(type: string, data: Record<string, unknown> = {}): DetectedEvent {
  return {
    type,
    appId: 1,
    platform: "shopify",
    severity: "info",
    data: { appSlug: "competitor-app", appName: "Competitor App", ...data },
  };
}

describe("isCompetitorEventEmailWorthy", () => {
  it("allows competitor_featured events", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_featured"))).toBe(true);
  });

  it("allows competitor_pricing_change events", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_pricing_change"))).toBe(true);
  });

  it("allows competitor_review_surge events", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_review_surge"))).toBe(true);
  });

  it("allows competitor_overtook when entering top 10 from outside 50", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_overtook", {
      competitorPosition: 5,
      previousPosition: 100,
    }))).toBe(true);
  });

  it("allows competitor_overtook when taking #1 position", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_overtook", {
      competitorPosition: 1,
      previousPosition: 3,
    }))).toBe(true);
  });

  it("filters out competitor_overtook for small position changes", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_overtook", {
      competitorPosition: 15,
      previousPosition: 18,
    }))).toBe(false);
  });

  it("filters out competitor_overtook entering top 10 from nearby position", () => {
    // Position 8 from 12 is not a major jump (previousPosition not > 50)
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_overtook", {
      competitorPosition: 8,
      previousPosition: 12,
    }))).toBe(false);
  });

  it("filters out competitor_overtook at position 20 from position 25", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_overtook", {
      competitorPosition: 20,
      previousPosition: 25,
    }))).toBe(false);
  });

  it("returns false for unknown competitor event types", () => {
    expect(isCompetitorEventEmailWorthy(makeEvent("competitor_unknown"))).toBe(false);
  });
});
