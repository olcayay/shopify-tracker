import { describe, it, expect } from "vitest";
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
    expect(result.name).toBe("Jotform - Powerful forms get it done.");
  });

  it("preserves slug as passed", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.slug).toBe(slug);
  });

  it("parses averageRating from reviewsSummary", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.averageRating).toBe(4.58);
  });

  it("parses ratingCount from reviewsSummary", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.ratingCount).toBe(130);
  });

  it("parses pricingHint from pricing.price_model_type", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.pricingHint).toBe("freemium");
  });

  it("extracts icon URL from plugins logos (Logo type)", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.iconUrl, "should have iconUrl").toBeTruthy();
    expect(result.iconUrl!.includes("ec365892"), "should be the Logo-type image").toBeTruthy();
  });

  it("extracts developer name and website", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect(result.developer?.name).toBe("Jotform Inc.");
    expect(result.developer?.website).toBe("https://www.jotform.com/");
  });

  it("platformData.description is non-empty", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).description.length > 0,
      "description should be non-empty").toBeTruthy();
  });

  it("platformData.fullDescription is non-empty", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).fullDescription.length > 0,
      "fullDescription should be non-empty").toBeTruthy();
  });

  it("platformData.highlights has 6 items", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).highlights.length).toBe(6);
  });

  it('platformData.languages = ["en"]', () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).languages).toEqual(["en"]);
  });

  it("platformData.listingCategories", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).listingCategories).toEqual([
      "Data Management",
      "Sales",
      "Surveys",
    ]);
  });

  it("platformData.productsSupported", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).productsSupported).toEqual([
      "Service Cloud",
      "Experience Cloud",
      "Health Cloud",
    ]);
  });

  it("platformData.productsRequired", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).productsRequired).toEqual(["Sales Cloud"]);
  });

  it("platformData.pricingPlans has 3 plans (Bronze $39, Silver $49, Gold $129)", () => {
    const result = parseSalesforceAppPage(html, slug);
    const plans = (result.platformData as any).pricingPlans;
    expect(plans.length).toBe(3);
    expect(plans[0].plan_name).toBe("Bronze");
    expect(plans[0].price).toBe(39);
    expect(plans[1].plan_name).toBe("Silver");
    expect(plans[1].price).toBe(49);
    expect(plans[2].plan_name).toBe("Gold");
    expect(plans[2].price).toBe(129);
  });

  it("platformData.pricingPlans include currency_code, units, frequency", () => {
    const result = parseSalesforceAppPage(html, slug);
    const plans = (result.platformData as any).pricingPlans;
    for (const plan of plans) {
      expect(plan.currency_code).toBe("USD");
      expect(plan.units).toBe("user");
      expect(plan.frequency).toBe("monthly");
      expect(plan.trial_days).toBe(0);
    }
  });

  it("platformData.publisher has name, email, employees, yearFounded", () => {
    const result = parseSalesforceAppPage(html, slug);
    const pub = (result.platformData as any).publisher;
    expect(pub.name).toBe("Jotform Inc.");
    expect(pub.email).toBe("salesforce-support@jotform.com");
    expect(pub.employees).toBe(489);
    expect(pub.yearFounded).toBe(2006);
  });

  it("platformData.editions", () => {
    const result = parseSalesforceAppPage(html, slug);
    expect((result.platformData as any).editions).toEqual([
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
    expect(plugins, "plugins should exist").toBeTruthy();
    expect(plugins.videos?.length > 0, "should have videos").toBeTruthy();
    expect(plugins.resources?.length > 0, "should have resources").toBeTruthy();
    expect(plugins.carousel?.length > 0, "should have carousel").toBeTruthy();
    expect(plugins.logos?.length > 0, "should have logos").toBeTruthy();
  });

  it("platformData.solution has manifest and namespacePrefix", () => {
    const result = parseSalesforceAppPage(html, slug);
    const sol = (result.platformData as any).solution;
    expect(sol, "solution should exist").toBeTruthy();
    expect(sol.manifest.hasLWC).toBe(true);
    expect(sol.packageId).toBe("0338e000000Gt7CAAS");
    expect(sol.namespacePrefix).toBe("jotform");
  });

  it("fallback: no window.stores → slug as name, null ratings, empty platformData", () => {
    const result = parseSalesforceAppPage("<html><body>no stores</body></html>", slug);
    expect(result.name).toBe(slug);
    expect(result.averageRating).toBe(null);
    expect(result.ratingCount).toBe(null);
    expect(result.platformData).toEqual({});
  });

  it("fallback: empty LISTING object → same behavior", () => {
    const emptyHtml =
      '<html><body><script>window.stores = {"LISTING":{}};</script></body></html>';
    const result = parseSalesforceAppPage(emptyHtml, slug);
    expect(result.name).toBe(slug);
    expect(result.averageRating).toBe(null);
    expect(result.ratingCount).toBe(null);
    expect(result.platformData).toEqual({});
  });
});
