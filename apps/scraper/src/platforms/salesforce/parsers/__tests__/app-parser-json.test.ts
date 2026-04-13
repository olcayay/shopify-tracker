import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseListingJson, parseSalesforceAppPage } from "../app-parser.js";

const fixturePath = resolve(
  __dirname,
  "../../__fixtures__/partners-listing-detail.json",
);
const listingJson = JSON.parse(readFileSync(fixturePath, "utf8"));
const SLUG = "20bda0b1-fdc1-4ba4-ac41-2156880a3ffe";

describe("parseListingJson (partners/experience response)", () => {
  it("returns a NormalizedAppDetails shape", () => {
    const out = parseListingJson(listingJson, SLUG);
    expect(out.slug).toBe(SLUG);
    expect(out.name).toBeTruthy();
  });

  it("populates fullDescription from the JSON", () => {
    const out = parseListingJson(listingJson, SLUG);
    expect(out.platformData.fullDescription).toBe(listingJson.fullDescription);
    expect(String(out.platformData.fullDescription).length).toBeGreaterThan(50);
  });

  it("populates the short description", () => {
    const out = parseListingJson(listingJson, SLUG);
    expect(out.platformData.description).toBe(listingJson.description);
  });

  it("extracts averageRating and ratingCount from reviewsSummary", () => {
    const out = parseListingJson(listingJson, SLUG);
    expect(out.averageRating).toBe(listingJson.reviewsSummary.averageRating);
    const expectedCount =
      listingJson.reviewsSummary.reviewCount ??
      listingJson.reviewsSummary.totalReviewCount;
    expect(out.ratingCount).toBe(expectedCount);
  });

  it("normalizes publisher fields", () => {
    const out = parseListingJson(listingJson, SLUG);
    expect(out.developer?.name).toBe(listingJson.publisher.name);
    expect(out.developer?.website).toBe(listingJson.publisher.website);
    const pub = out.platformData.publisher as Record<string, unknown>;
    expect(pub.name).toBe(listingJson.publisher.name);
    expect(pub.employees).toBe(listingJson.publisher.employees);
  });

  it("extracts highlights/languages/editions from extensions[0].data", () => {
    const out = parseListingJson(listingJson, SLUG);
    const ext = listingJson.extensions[0].data;
    expect(out.platformData.highlights).toEqual(ext.highlights);
    expect(out.platformData.languages).toEqual(ext.languages);
    expect(out.platformData.editions).toEqual(ext.editions);
    expect(out.platformData.listingCategories).toEqual(ext.listingCategories);
    expect(out.platformData.productsSupported).toEqual(ext.productsSupported);
    expect(out.platformData.supportedIndustries).toEqual(ext.supportedIndustries);
    expect(out.platformData.targetUserPersona).toEqual(ext.targetUserPersona);
  });

  it("normalizes pricing plans", () => {
    const out = parseListingJson(listingJson, SLUG);
    const plans = out.platformData.pricingPlans as Array<Record<string, unknown>>;
    const rawPlans = listingJson.pricing.model.plans;
    expect(plans).toHaveLength(rawPlans.length);
    expect(plans[0].plan_name).toBe(rawPlans[0].plan_name);
    expect(plans[0].price).toBe(rawPlans[0].price);
    expect(plans[0].currency_code).toBe(rawPlans[0].currency_code);
    expect(plans[0].frequency).toBe(rawPlans[0].frequency);
  });

  it("normalizes solution inner fields", () => {
    const out = parseListingJson(listingJson, SLUG);
    const sol = out.platformData.solution as Record<string, unknown>;
    expect(sol.packageId).toBe(listingJson.solution.solution.packageId);
    expect(sol.latestVersionDate).toBe(
      listingJson.solution.solution.latestVersionDate,
    );
  });

  it("collects carousel/content/logos from plugins", () => {
    const out = parseListingJson(listingJson, SLUG);
    const plugins = out.platformData.plugins as Record<string, unknown[]>;
    expect(plugins).toBeTruthy();
    const carousel = listingJson.plugins.find(
      (p: any) => p.pluginType === "listing/plugins/Carousel",
    );
    if (carousel) expect(plugins.carousel?.length).toBeGreaterThan(0);
  });

  it("returns empty fallback when payload is not an object", () => {
    const out = parseListingJson(null, SLUG);
    expect(out.slug).toBe(SLUG);
    expect(out.name).toBe(SLUG);
    expect(out.platformData).toEqual({});
  });

  // PLA-1070: hardening against publisher shape drift on the HTTP path.
  describe("publisher missing/empty (PLA-1070)", () => {
    it("returns developer null when publisher is absent", () => {
      const stripped = { ...listingJson, publisher: undefined };
      const out = parseListingJson(stripped, SLUG);
      expect(out.developer).toBeNull();
    });

    it("returns developer null when publisher is an empty object", () => {
      const stripped = { ...listingJson, publisher: {} };
      const out = parseListingJson(stripped, SLUG);
      expect(out.developer).toBeNull();
    });

    it("returns developer name when publisher is a string", () => {
      const stripped = { ...listingJson, publisher: "Acme Corp" };
      const out = parseListingJson(stripped, SLUG);
      expect(out.developer?.name).toBe("Acme Corp");
    });

    it("returns developer null when publisher object has empty name", () => {
      const stripped = { ...listingJson, publisher: { name: "", website: "x" } };
      const out = parseListingJson(stripped, SLUG);
      expect(out.developer).toBeNull();
    });
  });

  it("matches parseSalesforceAppPage output when given the same listing via HTML", () => {
    const htmlEmbed = `<html><body><script>window.stores = ${JSON.stringify({ LISTING: { listing: listingJson } })};</script></body></html>`;
    const fromJson = parseListingJson(listingJson, SLUG);
    const fromHtml = parseSalesforceAppPage(htmlEmbed, SLUG);

    expect(fromHtml.name).toBe(fromJson.name);
    expect(fromHtml.averageRating).toBe(fromJson.averageRating);
    expect(fromHtml.ratingCount).toBe(fromJson.ratingCount);
    expect(fromHtml.platformData.fullDescription).toBe(
      fromJson.platformData.fullDescription,
    );
    expect(fromHtml.platformData.highlights).toEqual(
      fromJson.platformData.highlights,
    );
    expect(fromHtml.platformData.pricingPlans).toEqual(
      fromJson.platformData.pricingPlans,
    );
  });
});
