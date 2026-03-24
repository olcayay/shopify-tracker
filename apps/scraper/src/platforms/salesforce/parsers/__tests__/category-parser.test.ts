import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSalesforceCategoryPage } from "../category-parser.js";

// Load sample data
const sampleApiPath = resolve(
  import.meta.dirname,
  "../../../../../../../files/salesforce/sample-outputs/category-marketing-api.json"
);

describe("parseSalesforceCategoryPage", () => {
  const rawData = JSON.parse(readFileSync(sampleApiPath, "utf-8"));
  const page1Entry = rawData[0];
  const page1Json = JSON.stringify(page1Entry.payload);

  it("parses category slug", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.slug).toBe("marketing");
  });

  it("parses app count from totalCount", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.appCount).toBe(898);
  });

  it("generates category title from slug", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.title).toBe("Marketing");
  });

  it("generates title from camelCase slug", () => {
    const fakeJson = JSON.stringify({ totalCount: 0, listings: [], featured: [] });
    const result = parseSalesforceCategoryPage(fakeJson, "campaignManagement", 1, 0);
    expect(result.title).toBe("Campaign Management");
  });

  it("extracts sponsored apps from page 1", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    const sponsored = result.apps.filter((a) => a.isSponsored);
    expect(sponsored.length > 0, "should have sponsored apps on page 1").toBeTruthy();
    expect(sponsored[0].isSponsored).toBe(true);
  });

  it("extracts organic listings", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    const organic = result.apps.filter((a) => !a.isSponsored);
    expect(organic.length).toBe(12, "should have 12 organic listings");
  });

  it("assigns correct positions to organic apps", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    const organic = result.apps.filter((a) => !a.isSponsored);
    expect(organic[0].position).toBe(1);
    expect(organic[11].position).toBe(12);
  });

  it("has no subcategory links (flat structure)", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.subcategoryLinks.length).toBe(0);
  });

  it("reports hasNextPage correctly", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.hasNextPage).toBe(false);
  });

  it("builds correct URL", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    expect(result.url).toBe("https://appexchange.salesforce.com/explore/business-needs?category=marketing");
  });

  it("extracts logo URLs", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    for (const app of result.apps) {
      expect(app.logoUrl, `app ${app.slug} should have logoUrl`).toBeTruthy();
    }
  });

  it("extracts rating and review count", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 1, 0);
    const appWithRating = result.apps.find((a) => a.averageRating > 0);
    expect(appWithRating, "should find at least one app with rating > 0").toBeTruthy();
  });

  it("does not include sponsored on page 2+", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 2, 12);
    const sponsored = result.apps.filter((a) => a.isSponsored);
    expect(sponsored.length).toBe(0, "page 2 should have no sponsored apps");
  });

  it("applies organic offset for page 2+", () => {
    const result = parseSalesforceCategoryPage(page1Json, "marketing", 2, 12);
    const organic = result.apps.filter((a) => !a.isSponsored);
    expect(organic[0].position).toBe(13,
      "first organic app on page 2 should start at position 13");
  });

  it("parses all 5 pages correctly", () => {
    let totalOrganicApps = 0;
    for (let i = 0; i < rawData.length; i++) {
      const entry = rawData[i];
      const json = JSON.stringify(entry.payload);
      const page = i + 1;
      const result = parseSalesforceCategoryPage(json, "marketing", page, totalOrganicApps);
      const organic = result.apps.filter((a) => !a.isSponsored);
      totalOrganicApps += organic.length;
    }
    // 5 pages * 12 apps per page = 60 organic apps
    expect(totalOrganicApps).toBe(60);
  });
});
