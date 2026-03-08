import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSalesforceAppPage } from "../app-parser.js";

// Load canonical fixture and transform to raw window.stores format
const fixturePath = resolve(
  import.meta.dirname,
  "../../../../../../../files/salesforce/sample-outputs/listing-canonical-a0N4V00000JTeWyUAL.json"
);
const canonical = JSON.parse(readFileSync(fixturePath, "utf-8"));

/**
 * The canonical fixture has normalized fields (extension, plugins as object,
 * flat solution). The parser expects the raw window.stores format with
 * extensions array, plugins array with pluginType, and nested solution.
 */
function toRawListing(c: any): any {
  return {
    listingId: c.listingId,
    id: c.id,
    appExchangeId: c.appExchangeId,
    name: c.name,
    title: c.title,
    description: c.description,
    fullDescription: c.fullDescription,
    technology: c.technology,
    publisher: c.publisher,
    pricing: c.pricing,
    reviewsSummary: c.reviewsSummary,
    businessNeeds: c.businessNeeds,
    // extensions array with typed entry
    extensions: c.extension
      ? [
          {
            extensionType: "listing/extensions/force/listings/Listing",
            data: c.extension,
          },
        ]
      : [],
    // nested solution
    solution: c.solution ? { solution: c.solution } : null,
    // plugins as array with pluginType
    plugins: toRawPlugins(c.plugins),
  };
}

function toRawPlugins(p: any): any[] {
  if (!p || typeof p !== "object") return [];
  const arr: any[] = [];
  if (p.logos?.length) {
    arr.push({
      pluginType: "listing/plugins/LogoSet",
      data: {
        items: p.logos.map((l: any) => ({
          data: { mediaId: l.url, logoType: l.logoType },
        })),
      },
    });
  }
  if (p.videos?.length) {
    arr.push({
      pluginType: "listing/plugins/Demo",
      data: {
        items: p.videos.map((v: any) => ({
          data: { url: v.url, type: v.type, title: v.caption },
        })),
      },
    });
  }
  if (p.resources?.length) {
    arr.push({
      pluginType: "listing/plugins/Content",
      data: {
        items: p.resources.map((r: any) => ({
          data: { url: r.url, type: r.type, title: r.title },
        })),
      },
    });
  }
  if (p.carousel?.length) {
    arr.push({
      pluginType: "listing/plugins/Carousel",
      data: {
        items: p.carousel.map((c: any) => ({
          data: { mediaId: c.url, caption: c.caption, altText: c.altText },
        })),
      },
    });
  }
  return arr;
}

function wrapHtml(listing: any): string {
  const json = JSON.stringify({ LISTING: { listing } });
  return `<html><head><title>Test</title></head><body><script>window.stores = ${json};</script></body></html>`;
}

const slug = "a0N4V00000JTeWyUAL";
const rawListing = toRawListing(canonical);
const html = wrapHtml(rawListing);

describe("parseSalesforceAppPage", () => {
  it("parses name from listing.title", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.name, "Jotform - Powerful forms get it done.");
  });

  it("preserves slug as passed", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.slug, slug);
  });

  it("parses averageRating from reviewsSummary", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.averageRating, 4.58);
  });

  it("parses ratingCount from reviewsSummary", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.ratingCount, 130);
  });

  it("parses pricingHint from pricing.price_model_type", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.pricingHint, "freemium");
  });

  it("extracts icon URL from plugins logos (Logo type)", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.ok(result.iconUrl, "should have iconUrl");
    assert.ok(result.iconUrl!.includes("ec365892"), "should be the Logo-type image");
  });

  it("extracts developer name and website", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal(result.developer?.name, "Jotform Inc.");
    assert.equal(result.developer?.website, "https://www.jotform.com/");
  });

  it("platformData.description is non-empty", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.ok(
      (result.platformData as any).description.length > 0,
      "description should be non-empty"
    );
  });

  it("platformData.fullDescription is non-empty", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.ok(
      (result.platformData as any).fullDescription.length > 0,
      "fullDescription should be non-empty"
    );
  });

  it("platformData.highlights has 6 items", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.equal((result.platformData as any).highlights.length, 6);
  });

  it('platformData.languages = ["en"]', () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.deepEqual((result.platformData as any).languages, ["en"]);
  });

  it("platformData.listingCategories", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.deepEqual((result.platformData as any).listingCategories, [
      "Data Management",
      "Sales",
      "Surveys",
    ]);
  });

  it("platformData.productsSupported", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.deepEqual((result.platformData as any).productsSupported, [
      "Service Cloud",
      "Experience Cloud",
      "Health Cloud",
    ]);
  });

  it("platformData.productsRequired", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.deepEqual((result.platformData as any).productsRequired, ["Sales Cloud"]);
  });

  it("platformData.pricingPlans has 3 plans (Bronze $39, Silver $49, Gold $129)", () => {
    const result = parseSalesforceAppPage(html, slug);
    const plans = (result.platformData as any).pricingPlans;
    assert.equal(plans.length, 3);
    assert.equal(plans[0].plan_name, "Bronze");
    assert.equal(plans[0].price, 39);
    assert.equal(plans[1].plan_name, "Silver");
    assert.equal(plans[1].price, 49);
    assert.equal(plans[2].plan_name, "Gold");
    assert.equal(plans[2].price, 129);
  });

  it("platformData.pricingPlans include currency_code, units, frequency", () => {
    const result = parseSalesforceAppPage(html, slug);
    const plans = (result.platformData as any).pricingPlans;
    for (const plan of plans) {
      assert.equal(plan.currency_code, "USD");
      assert.equal(plan.units, "user");
      assert.equal(plan.frequency, "monthly");
      assert.equal(plan.trial_days, 0);
    }
  });

  it("platformData.publisher has name, email, employees, yearFounded", () => {
    const result = parseSalesforceAppPage(html, slug);
    const pub = (result.platformData as any).publisher;
    assert.equal(pub.name, "Jotform Inc.");
    assert.equal(pub.email, "salesforce-support@jotform.com");
    assert.equal(pub.employees, 489);
    assert.equal(pub.yearFounded, 2006);
  });

  it("platformData.editions", () => {
    const result = parseSalesforceAppPage(html, slug);
    assert.deepEqual((result.platformData as any).editions, [
      "PE",
      "EE",
      "UE",
      "DE",
      "PP",
    ]);
  });

  it("platformData.plugins has videos, resources, carousel, logos", () => {
    const result = parseSalesforceAppPage(html, slug);
    const plugins = (result.platformData as any).plugins;
    assert.ok(plugins, "plugins should exist");
    assert.ok(plugins.videos?.length > 0, "should have videos");
    assert.ok(plugins.resources?.length > 0, "should have resources");
    assert.ok(plugins.carousel?.length > 0, "should have carousel");
    assert.ok(plugins.logos?.length > 0, "should have logos");
  });

  it("platformData.solution has manifest and namespacePrefix", () => {
    const result = parseSalesforceAppPage(html, slug);
    const sol = (result.platformData as any).solution;
    assert.ok(sol, "solution should exist");
    assert.equal(sol.manifest.hasLWC, true);
    assert.equal(sol.packageId, "0338e000000Gt7CAAS");
    assert.equal(sol.namespacePrefix, "jotform");
  });

  it("fallback: no window.stores → slug as name, null ratings, empty platformData", () => {
    const result = parseSalesforceAppPage("<html><body>no stores</body></html>", slug);
    assert.equal(result.name, slug);
    assert.equal(result.averageRating, null);
    assert.equal(result.ratingCount, null);
    assert.deepEqual(result.platformData, {});
  });

  it("fallback: empty LISTING object → same behavior", () => {
    const emptyHtml =
      '<html><body><script>window.stores = {"LISTING":{}};</script></body></html>';
    const result = parseSalesforceAppPage(emptyHtml, slug);
    assert.equal(result.name, slug);
    assert.equal(result.averageRating, null);
    assert.equal(result.ratingCount, null);
    assert.deepEqual(result.platformData, {});
  });
});
