import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    assert.equal(result.totalResults, 1456);
  });

  it("parses keyword", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    assert.equal(result.keyword, "form");
  });

  it("extracts sponsored/featured apps from page 1", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    assert.ok(sponsoredApps.length > 0, "should have sponsored apps on page 1");

    // Verify first sponsored app has correct fields
    const first = sponsoredApps[0];
    assert.ok(first.appSlug, "should have appSlug (oafId)");
    assert.ok(first.appName, "should have appName");
    assert.equal(first.isSponsored, true);
    assert.equal(first.position, 1);
  });

  it("extracts organic listings", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    assert.equal(organicApps.length, 12, "should have 12 organic listings");

    // Verify first organic app starts at position 1
    assert.equal(organicApps[0].position, 1);
  });

  it("extracts logo URL (prefers Logo type)", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    // All apps should have logo URLs
    for (const app of organicApps) {
      assert.ok(app.logoUrl, `app ${app.appSlug} should have logoUrl`);
    }
  });

  it("extracts rating and review count", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    // Find an app with known rating
    const appWithRating = result.apps.find((a) => a.averageRating > 0);
    assert.ok(appWithRating, "should find at least one app with rating > 0");
    assert.ok(
      typeof appWithRating.ratingCount === "number",
      "ratingCount should be a number"
    );
  });

  it("includes publisher and categories in extra data", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    if (sponsoredApps.length > 0) {
      const first = sponsoredApps[0];
      assert.ok(first.extra?.publisher, "sponsored app should have publisher");
      assert.ok(
        Array.isArray(first.extra?.listingCategories),
        "should have listingCategories array"
      );
    }
  });

  it("detects listing ID type correctly", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    for (const app of result.apps) {
      const idType = app.extra?.listingIdType;
      assert.ok(
        idType === "salesforce" || idType === "uuid",
        `idType should be salesforce or uuid, got ${idType}`
      );
    }
  });

  it("does not include featured on page 2+", () => {
    // Simulate page 2 with the same data but page=2
    const result = parseSalesforceSearchPage(page1Json, "form", 2, 12);
    const sponsoredApps = result.apps.filter((a) => a.isSponsored);
    assert.equal(sponsoredApps.length, 0, "page 2 should have no sponsored apps");
  });

  it("applies organic offset for page 2+", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 2, 12);
    const organicApps = result.apps.filter((a) => !a.isSponsored);
    assert.equal(
      organicApps[0].position,
      13,
      "first organic app on page 2 should start at position 13"
    );
  });

  it("reports hasNextPage correctly", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    assert.equal(result.hasNextPage, true, "should have next page with 1456 total results");
  });

  it("reports currentPage", () => {
    const result = parseSalesforceSearchPage(page1Json, "form", 1, 0);
    assert.equal(result.currentPage, 1);
  });
});
