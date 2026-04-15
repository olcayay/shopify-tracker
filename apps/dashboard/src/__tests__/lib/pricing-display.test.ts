import { describe, it, expect } from "vitest";
import { displayPricingModel } from "@/lib/pricing-display";

describe("displayPricingModel — PLA-1109 render-time canonicalization", () => {
  it("maps the 5 canonical values to themselves", () => {
    expect(displayPricingModel("Free")).toBe("Free");
    expect(displayPricingModel("Freemium")).toBe("Freemium");
    expect(displayPricingModel("Free Trial")).toBe("Free Trial");
    expect(displayPricingModel("Free To Install")).toBe("Free To Install");
    expect(displayPricingModel("Paid")).toBe("Paid");
  });

  it("normalizes raw platform strings", () => {
    expect(displayPricingModel("FREE")).toBe("Free");
    expect(displayPricingModel("Free!")).toBe("Free");
    expect(displayPricingModel("Free plan available")).toBe("Freemium");
    expect(displayPricingModel("free_plan_available")).toBe("Freemium");
    expect(displayPricingModel("Free with paid features")).toBe("Freemium");
    expect(displayPricingModel("Free trial")).toBe("Free Trial");
    expect(displayPricingModel("free_trial")).toBe("Free Trial");
    expect(displayPricingModel("Free to install")).toBe("Free To Install");
    expect(displayPricingModel("Subscription")).toBe("Paid");
    expect(displayPricingModel("monthly")).toBe("Paid");
    expect(displayPricingModel("Annually")).toBe("Paid");
  });

  it("normalizes dynamic pricing strings to Paid", () => {
    expect(displayPricingModel("From $9/mo")).toBe("Paid");
    expect(displayPricingModel("From $9.99/mo")).toBe("Paid");
    expect(displayPricingModel("$19/month")).toBe("Paid");
    expect(displayPricingModel("$29/yr")).toBe("Paid");
  });

  it("collapses null, undefined, and empty string to the em-dash placeholder", () => {
    expect(displayPricingModel(null)).toBe("\u2014");
    expect(displayPricingModel(undefined)).toBe("\u2014");
    expect(displayPricingModel("")).toBe("\u2014");
    expect(displayPricingModel("   ")).toBe("\u2014");
  });

  it("collapses unknown/legacy strings to the em-dash placeholder (no leak)", () => {
    expect(displayPricingModel("Enterprise")).toBe("\u2014");
    expect(displayPricingModel("Contact us")).toBe("\u2014");
    expect(displayPricingModel("custom pricing")).toBe("\u2014");
  });
});
