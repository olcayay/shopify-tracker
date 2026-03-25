import { describe, it, expect } from "vitest";
import { parseHubSpotAppDetails, unwrapChirp } from "../app-parser.js";
import { makeChirpAppDetailResponse } from "./fixtures.js";

describe("unwrapChirp", () => {
  it("unwraps string field value", () => {
    const input = { value: "hello", __typename: "com.hubspot.chirp.ext.models.StringFieldValue" };
    expect(unwrapChirp(input)).toBe("hello");
  });

  it("unwraps int field value", () => {
    const input = { value: 42, __typename: "com.hubspot.chirp.ext.models.IntFieldValue" };
    expect(unwrapChirp(input)).toBe(42);
  });

  it("unwraps nested map field value", () => {
    const input = {
      value: {
        name: { value: "Test", __typename: "com.hubspot.chirp.ext.models.StringFieldValue" },
        count: { value: 5, __typename: "com.hubspot.chirp.ext.models.IntFieldValue" },
      },
      __typename: "com.hubspot.chirp.ext.models.MapFieldValue",
    };
    expect(unwrapChirp(input)).toEqual({ name: "Test", count: 5 });
  });

  it("unwraps list field value", () => {
    const input = {
      value: [
        { value: "a", __typename: "com.hubspot.chirp.ext.models.StringFieldValue" },
        { value: "b", __typename: "com.hubspot.chirp.ext.models.StringFieldValue" },
      ],
      __typename: "com.hubspot.chirp.ext.models.ListFieldValue",
    };
    expect(unwrapChirp(input)).toEqual(["a", "b"]);
  });

  it("passes through primitives", () => {
    expect(unwrapChirp("hello")).toBe("hello");
    expect(unwrapChirp(42)).toBe(42);
    expect(unwrapChirp(null)).toBe(null);
    expect(unwrapChirp(undefined)).toBe(undefined);
    expect(unwrapChirp(true)).toBe(true);
  });

  it("strips __typename from plain objects", () => {
    const input = { name: "test", __typename: "SomeType" };
    expect(unwrapChirp(input)).toEqual({ name: "test" });
  });
});

describe("parseHubSpotAppDetails", () => {
  it("parses app name from CHIRP response", () => {
    const json = makeChirpAppDetailResponse({ name: "Slack" });
    const result = parseHubSpotAppDetails(json, "slack");
    expect(result.name).toBe("Slack");
  });

  it("parses slug pass-through", () => {
    const json = makeChirpAppDetailResponse();
    const result = parseHubSpotAppDetails(json, "my-app");
    expect(result.slug).toBe("my-app");
  });

  it("parses developer info", () => {
    const json = makeChirpAppDetailResponse({ companyName: "Acme Corp", companyUrl: "https://acme.com" });
    const result = parseHubSpotAppDetails(json, "acme-app");
    expect(result.developer).toEqual({ name: "Acme Corp", url: "https://acme.com" });
  });

  it("parses icon URL from listingIcon", () => {
    const json = makeChirpAppDetailResponse({ iconUrl: "https://example.com/icon.png" });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.iconUrl).toBe("https://example.com/icon.png");
  });

  it("parses categories", () => {
    const json = makeChirpAppDetailResponse({ category: ["EMAIL", "MARKETING_AUTOMATION"] });
    const result = parseHubSpotAppDetails(json, "test-app");
    const cats = result.platformData.categories as Array<{ slug: string; name: string }>;
    expect(cats).toHaveLength(2);
    expect(cats[0].slug).toBe("EMAIL");
    expect(cats[1].slug).toBe("MARKETING_AUTOMATION");
  });

  it("formats category names from slugs", () => {
    const json = makeChirpAppDetailResponse({ category: ["SALES_ENABLEMENT"] });
    const result = parseHubSpotAppDetails(json, "test-app");
    const cats = result.platformData.categories as Array<{ slug: string; name: string }>;
    expect(cats[0].name).toBe("Sales Enablement");
  });

  it("parses pricing hint with free plan", () => {
    const json = makeChirpAppDetailResponse({
      pricingPlans: [{ pricingName: "Free", pricingModel: ["FREE"] }],
    });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.pricingHint).toBe("Free plan available");
  });

  it("parses pricing hint with monthly price", () => {
    const json = makeChirpAppDetailResponse({
      pricingPlans: [
        { pricingName: "Pro", pricingModel: ["MONTHLY"], pricingMonthlyCenticents: 200000 },
      ],
    });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.pricingHint).toBe("From $20/mo");
  });

  it("returns null pricing hint when no plans", () => {
    const json = makeChirpAppDetailResponse({ pricingPlans: [] });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.pricingHint).toBeNull();
  });

  it("parses install count in platformData", () => {
    const json = makeChirpAppDetailResponse({ installCount: 50000 });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.installCount).toBe(50000);
  });

  it("parses launched date from firstPublishedAt", () => {
    const json = makeChirpAppDetailResponse({ firstPublishedAt: 1473676354857 });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.launchedDate).toBe("2016-09-12");
  });

  it("returns null launched date when not present", () => {
    const json = makeChirpAppDetailResponse({ firstPublishedAt: null });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.launchedDate).toBeNull();
  });

  it("parses Certified badge", () => {
    const json = makeChirpAppDetailResponse({ certifiedAt: 1713539903755 });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.badges).toContain("Certified");
  });

  it("parses Built by HubSpot badge", () => {
    const json = makeChirpAppDetailResponse({ builtByHubSpot: true });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.badges).toContain("Built by HubSpot");
  });

  it("returns empty badges when not certified or HubSpot-built", () => {
    const json = makeChirpAppDetailResponse({ certifiedAt: null, builtByHubSpot: false });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.badges).toEqual([]);
  });

  it("strips HTML from overview for longDescription", () => {
    const json = makeChirpAppDetailResponse({ overview: "<p>This is <strong>bold</strong> text.</p>" });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.longDescription).toBe("This is bold text.");
  });

  it("parses short description from tagline", () => {
    const json = makeChirpAppDetailResponse({ tagline: "Quick CRM sync" });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.shortDescription).toBe("Quick CRM sync");
  });

  it("always returns null rating (not in API)", () => {
    const json = makeChirpAppDetailResponse();
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
  });

  it("sets source to chirp-api", () => {
    const json = makeChirpAppDetailResponse();
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.platformData.source).toBe("chirp-api");
  });

  it("returns minimal details for invalid JSON", () => {
    const result = parseHubSpotAppDetails("not json", "broken-app");
    expect(result.name).toBe("broken-app");
    expect(result.slug).toBe("broken-app");
    expect(result.platformData.source).toBe("chirp-api-empty");
  });

  it("returns minimal details for empty response", () => {
    const result = parseHubSpotAppDetails(JSON.stringify({}), "empty-app");
    expect(result.name).toBe("empty-app");
  });

  it("returns developer null when no company name", () => {
    const json = makeChirpAppDetailResponse({ companyName: "" });
    const result = parseHubSpotAppDetails(json, "test-app");
    expect(result.developer).toBeNull();
  });

  it("formats pricing plans in platformData", () => {
    const json = makeChirpAppDetailResponse({
      pricingPlans: [
        { pricingName: "Basic", pricingModel: ["MONTHLY"], pricingMonthlyCenticents: 130000, pricingFeatures: ["Feature A"] },
      ],
    });
    const result = parseHubSpotAppDetails(json, "test-app");
    const plans = result.platformData.pricingPlans as any[];
    expect(plans).toHaveLength(1);
    expect(plans[0].name).toBe("Basic");
    expect(plans[0].monthlyPrice).toBe(13);
    expect(plans[0].features).toEqual(["Feature A"]);
  });

  it("handles multiple categories", () => {
    const json = makeChirpAppDetailResponse({ category: ["CRM", "SALES_ENABLEMENT", "E_COMMERCE"] });
    const result = parseHubSpotAppDetails(json, "multi-cat");
    const cats = result.platformData.categories as any[];
    expect(cats).toHaveLength(3);
    expect(cats.map((c: any) => c.slug)).toEqual(["CRM", "SALES_ENABLEMENT", "E_COMMERCE"]);
  });
});
