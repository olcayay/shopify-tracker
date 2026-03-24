import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSalesforceSearchPage } from "../search-parser.js";

// Load sample data
const sampleApiPath = resolve(
  import.meta.dirname,
  "../../../../../../../files/salesforce/sample-outputs/keyword-form-api.json"
);

describe("parseSalesforceSearchPage", () => {
  const rawData = JSON.parse(readFileSync(sampleApiPath, "utf-8"));
  // The sample file is an array of {url, payload} entries
  const page1Entry = rawData[0];
  const page1Json = JSON.stringify(page1Entry.payload);

  it("parses total results count", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    expect(result.totalResults).toBe(1456);
  });

  it("parses keyword", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    expect(result.keyword).toBe("form");
  });

  it("extracts sponsored/featured apps from page 1", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    expect(sponsoredApps.length > 0, "should have sponsored apps on page 1").toBeTruthy();

    // Verify first sponsored app has correct fields
    const first = sponsoredApps[0];
    expect(first.appSlug, "should have appSlug (oafId)").toBeTruthy();
    expect(first.appName, "should have appName").toBeTruthy();
    expect(first.isSponsored).toBe(true);
    expect(first.position).toBe(1);
  });

  it("extracts organic listings", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    expect(organicApps.length).toBe(12, "should have 12 organic listings");

    // Verify first organic app starts at position 1
    expect(organicApps[0].position).toBe(1);
  });

  it("extracts logo URL (prefers Logo type)", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    // All apps should have logo URLs
    for (const app of organicApps) {
      expect(app.logoUrl, `app ${app.appSlug} should have logoUrl`).toBeTruthy();
    }
  });

  it("extracts rating and review count", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    // Find an app with known rating
    const appWithRating = result.apps.find((a) => a.averageRating > 0);
    expect(appWithRating, "should find at least one app with rating > 0").toBeTruthy();
    expect(typeof appWithRating.ratingCount === "number",
      "ratingCount should be a number").toBeTruthy();
  });

  it("includes publisher and categories in extra data", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    if (sponsoredApps.length > 0) {
      const first = sponsoredApps[0];
      expect(first.extra?.publisher, "sponsored app should have publisher").toBeTruthy();
      expect(Array.isArray(first.extra?.listingCategories),
        "should have listingCategories array").toBeTruthy();
    }
  });

  it("detects listing ID type correctly", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    for (const app of result.apps) {
      const idType = app.extra?.listingIdType;
      expect(idType === "salesforce" || idType === "uuid",
        `idType should be salesforce or uuid, got ${idType}`).toBeTruthy();
    }
  });

  it("does not include featured on page 2+", () => {
    // Simulate page 2 with the same data but page=2
    const result = parseSalesforceSearchPage(page1Json, "form", 2, 12);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    expect(sponsoredApps.length).toBe(0, "page 2 should have no sponsored apps");
  });

  it("applies organic offset for page 2+", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 2, 12);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    expect(organicApps[0].position).toBe(13,
      "first organic app on page 2 should start at position 13");
  });

  it("reports hasNextPage correctly", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    expect(result.hasNextPage).toBe(true, "should have next page with 1456 total results");
  });

  it("reports currentPage", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    expect(result.currentPage).toBe(1);
  });
});
