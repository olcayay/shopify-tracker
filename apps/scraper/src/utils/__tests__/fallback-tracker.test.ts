import { describe, it, expect } from "vitest";
import { FallbackTracker } from "../fallback-tracker.js";

describe("FallbackTracker", () => {
  it("starts with no fallbacks", () => {
    const tracker = new FallbackTracker();
    expect(tracker.fallbackUsed).toBe(false);
    expect(tracker.fallbackCount).toBe(0);
    expect(tracker.contexts).toEqual([]);
  });

  it("records a single fallback", () => {
    const tracker = new FallbackTracker();
    tracker.recordFallback("shopify/fetchAppPage/mailchimp");
    expect(tracker.fallbackUsed).toBe(true);
    expect(tracker.fallbackCount).toBe(1);
    expect(tracker.contexts).toEqual(["shopify/fetchAppPage/mailchimp"]);
  });

  it("records multiple fallbacks", () => {
    const tracker = new FallbackTracker();
    tracker.recordFallback("shopify/fetchAppPage/mailchimp");
    tracker.recordFallback("shopify/fetchCategoryPage/email-marketing");
    expect(tracker.fallbackCount).toBe(2);
    expect(tracker.contexts).toEqual([
      "shopify/fetchAppPage/mailchimp",
      "shopify/fetchCategoryPage/email-marketing",
    ]);
  });

  it("toMetadata returns empty when no fallbacks", () => {
    const tracker = new FallbackTracker();
    expect(tracker.toMetadata()).toEqual({});
  });

  it("toMetadata returns fallback info when fallbacks recorded", () => {
    const tracker = new FallbackTracker();
    tracker.recordFallback("wix/fetchAppPage/some-app");
    tracker.recordFallback("wix/fetchSearchPage/crm");
    expect(tracker.toMetadata()).toEqual({
      fallback_used: true,
      fallback_count: 2,
      fallback_contexts: ["wix/fetchAppPage/some-app", "wix/fetchSearchPage/crm"],
    });
  });

  it("contexts is readonly (immutable reference)", () => {
    const tracker = new FallbackTracker();
    tracker.recordFallback("test/context");
    const ctxRef = tracker.contexts;
    expect(ctxRef).toHaveLength(1);
    // Adding more fallbacks doesn't affect previously retrieved reference
    tracker.recordFallback("test/context2");
    expect(tracker.fallbackCount).toBe(2);
  });
});
