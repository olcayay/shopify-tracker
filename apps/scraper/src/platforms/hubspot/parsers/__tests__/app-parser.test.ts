import { describe, it, expect } from "vitest";
import { parseHubSpotAppDetails } from "../app-parser.js";
import { makeJsonLdAppHtml, makeDomAppHtml } from "./fixtures.js";

// ---------------------------------------------------------------------------
// JSON-LD parsing
// ---------------------------------------------------------------------------
describe("parseHubSpotAppDetails — JSON-LD", () => {
  it("parses basic fields from JSON-LD", () => {
    const html = makeJsonLdAppHtml();
    const result = parseHubSpotAppDetails(html, "mailchimp");

    expect(result.slug).toBe("mailchimp");
    expect(result.name).toBe("Mailchimp");
    expect(result.averageRating).toBe(4.3);
    expect(result.ratingCount).toBe(187);
    expect(result.iconUrl).toBe("https://cdn.hubspot.com/mailchimp-icon.png");
    expect(result.badges).toEqual([]);
    expect(result.platformData.source).toBe("json-ld");
  });

  it("parses author info from JSON-LD object", () => {
    const html = makeJsonLdAppHtml({
      author: { name: "Acme Corp", url: "https://acme.com" },
    });
    const result = parseHubSpotAppDetails(html, "acme-app");

    expect(result.developer).toEqual({ name: "Acme Corp", url: "https://acme.com" });
  });

  it("parses author from string value", () => {
    const html = makeJsonLdAppHtml({ author: "Simple Author" });
    const result = parseHubSpotAppDetails(html, "simple-app");

    expect(result.developer).toEqual({ name: "Simple Author", url: undefined });
  });

  it("parses softwareVersion from JSON-LD", () => {
    const html = makeJsonLdAppHtml({ softwareVersion: "3.1.0" });
    const result = parseHubSpotAppDetails(html, "versioned-app");

    expect(result.platformData.version).toBe("3.1.0");
  });

  it("handles missing aggregateRating", () => {
    const html = makeJsonLdAppHtml({ aggregateRating: null });
    const result = parseHubSpotAppDetails(html, "no-rating-app");

    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
  });

  it("extracts pricing from DOM even with JSON-LD", () => {
    const html = makeJsonLdAppHtml();
    const result = parseHubSpotAppDetails(html, "mailchimp");

    expect(result.pricingHint).toBe("Free plan available");
    expect(result.platformData.pricing).toBe("Free plan available");
  });

  it("extracts categories from page links", () => {
    const html = makeJsonLdAppHtml();
    const result = parseHubSpotAppDetails(html, "mailchimp");

    const cats = result.platformData.categories as Array<{ slug: string; name?: string }>;
    expect(cats).toHaveLength(2);
    expect(cats[0].slug).toBe("marketing");
    expect(cats[0].name).toBe("Marketing");
    expect(cats[1].slug).toBe("marketing--email");
    expect(cats[1].name).toBe("Email Marketing");
  });

  it("ignores non-SoftwareApplication JSON-LD types", () => {
    const html = makeJsonLdAppHtml({ "@type": "Organization" });
    const result = parseHubSpotAppDetails(html, "org-type-app");

    // Should fall back to DOM parsing
    expect(result.platformData.source).toBe("dom-fallback");
  });

  it("uses slug as fallback name when JSON-LD name is empty", () => {
    const html = makeJsonLdAppHtml({ name: "" });
    const result = parseHubSpotAppDetails(html, "fallback-slug");

    // JSON-LD with empty name uses slug
    expect(result.name).toBe("fallback-slug");
  });

  it("accepts WebApplication @type", () => {
    const html = makeJsonLdAppHtml({ "@type": "WebApplication" });
    const result = parseHubSpotAppDetails(html, "web-app");

    expect(result.platformData.source).toBe("json-ld");
    expect(result.name).toBe("Mailchimp");
  });
});

// ---------------------------------------------------------------------------
// DOM fallback parsing
// ---------------------------------------------------------------------------
describe("parseHubSpotAppDetails — DOM fallback", () => {
  it("parses app name from h1", () => {
    const html = makeDomAppHtml({ name: "My Cool Extension" });
    const result = parseHubSpotAppDetails(html, "my-cool-extension");

    expect(result.name).toBe("My Cool Extension");
    expect(result.slug).toBe("my-cool-extension");
    expect(result.platformData.source).toBe("dom-fallback");
  });

  it("parses rating from DOM selectors", () => {
    const html = makeDomAppHtml({ ratingValue: "4.7", ratingCount: "1,234" });
    const result = parseHubSpotAppDetails(html, "rated-app");

    expect(result.averageRating).toBe(4.7);
    expect(result.ratingCount).toBe(1234);
  });

  it("returns null rating when no rating elements present", () => {
    const html = makeDomAppHtml({ ratingValue: "", ratingCount: "" });
    const result = parseHubSpotAppDetails(html, "no-rating");

    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
  });

  it("parses icon URL from app-icon class", () => {
    const html = makeDomAppHtml({ iconUrl: "https://example.com/icon.png" });
    const result = parseHubSpotAppDetails(html, "icon-app");

    expect(result.iconUrl).toBe("https://example.com/icon.png");
  });

  it("parses developer info", () => {
    const html = makeDomAppHtml({ developerName: "DevCorp", developerUrl: "https://devcorp.com" });
    const result = parseHubSpotAppDetails(html, "dev-app");

    expect(result.developer).toEqual({ name: "DevCorp", url: "https://devcorp.com" });
  });

  it("parses short description from tagline class", () => {
    const html = makeDomAppHtml({ shortDescription: "Quick CRM sync" });
    const result = parseHubSpotAppDetails(html, "tagline-app");

    expect(result.platformData.shortDescription).toBe("Quick CRM sync");
  });

  it("parses long description", () => {
    const html = makeDomAppHtml({ longDescription: "A very long and detailed description." });
    const result = parseHubSpotAppDetails(html, "desc-app");

    expect(result.platformData.longDescription).toBe("A very long and detailed description.");
  });

  it("parses pricing from DOM", () => {
    const html = makeDomAppHtml({ pricing: "$99/month" });
    const result = parseHubSpotAppDetails(html, "paid-app");

    expect(result.pricingHint).toBe("$99/month");
    expect(result.platformData.pricing).toBe("$99/month");
  });

  it("parses categories from links", () => {
    const html = makeDomAppHtml({
      categories: [
        { slug: "operations", name: "Operations" },
        { slug: "operations/data-sync", name: "Data Sync" },
      ],
    });
    const result = parseHubSpotAppDetails(html, "ops-app");

    const cats = result.platformData.categories as Array<{ slug: string; name?: string }>;
    expect(cats).toHaveLength(2);
    expect(cats[0].slug).toBe("operations");
    expect(cats[1].slug).toBe("operations--data-sync");
  });

  it("uses slug as name when h1 is empty", () => {
    const html = `<html><body><h1></h1></body></html>`;
    const result = parseHubSpotAppDetails(html, "empty-h1-app");

    expect(result.name).toBe("empty-h1-app");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("parseHubSpotAppDetails — edge cases", () => {
  it("handles completely empty HTML", () => {
    const html = "<html><body></body></html>";
    const result = parseHubSpotAppDetails(html, "empty-page");

    expect(result.slug).toBe("empty-page");
    expect(result.name).toBe("empty-page");
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
    expect(result.iconUrl).toBeNull();
    expect(result.developer).toBeNull();
    expect(result.platformData.source).toBe("dom-fallback");
  });

  it("handles malformed JSON-LD gracefully", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{ invalid json }</script>
      </head><body>
        <h1>Fallback Name</h1>
      </body></html>
    `;
    const result = parseHubSpotAppDetails(html, "bad-json");

    expect(result.name).toBe("Fallback Name");
    expect(result.platformData.source).toBe("dom-fallback");
  });

  it("handles multiple JSON-LD scripts, uses first SoftwareApplication", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name: "Org" })}</script>
        <script type="application/ld+json">${JSON.stringify({ "@type": "SoftwareApplication", name: "The App", aggregateRating: { ratingValue: 4.0, ratingCount: 50 } })}</script>
      </head><body><h1>Page Title</h1></body></html>
    `;
    const result = parseHubSpotAppDetails(html, "multi-ld");

    expect(result.name).toBe("The App");
    expect(result.averageRating).toBe(4.0);
    expect(result.platformData.source).toBe("json-ld");
  });
});
