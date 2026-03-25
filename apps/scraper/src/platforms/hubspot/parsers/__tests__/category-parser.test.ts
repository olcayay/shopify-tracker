import { describe, it, expect } from "vitest";
import { parseHubSpotCategoryPage } from "../category-parser.js";
import { makeCategoryPageHtml } from "./fixtures.js";

describe("parseHubSpotCategoryPage", () => {
  const URL = "https://ecosystem.hubspot.com/marketplace/apps/sales";

  it("parses apps from card layout", () => {
    const html = makeCategoryPageHtml();
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.slug).toBe("sales");
    expect(result.url).toBe(URL);
    expect(result.apps).toHaveLength(3);
    expect(result.apps[0]).toMatchObject({
      position: 1,
      slug: "mailchimp",
      name: "Mailchimp",
      averageRating: 4.3,
      ratingCount: 187,
      isSponsored: false,
      badges: [],
    });
    expect(result.apps[1].slug).toBe("salesforce-hubspot");
    expect(result.apps[2].slug).toBe("zapier");
  });

  it("assigns sequential positions", () => {
    const html = makeCategoryPageHtml();
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps.map((a) => a.position)).toEqual([1, 2, 3]);
  });

  it("parses rating and rating count", () => {
    const html = makeCategoryPageHtml({
      apps: [
        { slug: "rated-app", name: "Rated", rating: "4.8", ratingCount: "1,543" },
      ],
    });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps[0].averageRating).toBe(4.8);
    expect(result.apps[0].ratingCount).toBe(1543);
  });

  it("defaults rating to 0 when missing", () => {
    const html = makeCategoryPageHtml({
      apps: [{ slug: "no-rating", name: "No Rating App" }],
    });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps[0].averageRating).toBe(0);
    expect(result.apps[0].ratingCount).toBe(0);
  });

  it("parses icon URL from img", () => {
    const html = makeCategoryPageHtml({
      apps: [{ slug: "icon-app", name: "Icon App", iconUrl: "https://cdn.example.com/icon.png" }],
    });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps[0].logoUrl).toBe("https://cdn.example.com/icon.png");
  });

  it("parses short description", () => {
    const html = makeCategoryPageHtml({
      apps: [{ slug: "desc-app", name: "Desc App", description: "A useful description" }],
    });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps[0].shortDescription).toBe("A useful description");
  });

  it("extracts total count from total-results element", () => {
    const html = makeCategoryPageHtml({ totalCount: 142 });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.appCount).toBe(142);
  });

  it("extracts category title from h1", () => {
    const html = makeCategoryPageHtml({ categoryTitle: "Marketing Tools" });
    const result = parseHubSpotCategoryPage(html, "marketing", URL);

    expect(result.title).toBe("Marketing Tools");
  });

  it("falls back to slug-based title when h1 is missing", () => {
    const html = `<html><body>
      <div class="app-card">
        <a href="/marketplace/listing/test-app"><h3>Test</h3></a>
      </div>
    </body></html>`;
    const result = parseHubSpotCategoryPage(html, "sales--automation", URL);

    expect(result.title).toBe("Sales > Automation");
  });

  it("returns empty description and subcategoryLinks", () => {
    const html = makeCategoryPageHtml();
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.description).toBe("");
    expect(result.subcategoryLinks).toEqual([]);
  });

  // -- Fallback (link-based) parsing --

  it("falls back to link-based parsing when no card classes", () => {
    const html = makeCategoryPageHtml({ useCardLayout: false });
    const result = parseHubSpotCategoryPage(html, "operations", URL);

    expect(result.apps).toHaveLength(3);
    expect(result.apps[0].slug).toBe("mailchimp");
    expect(result.apps[1].slug).toBe("salesforce-hubspot");
    expect(result.apps[2].slug).toBe("zapier");
  });

  it("deduplicates slugs in fallback mode", () => {
    const html = `<html><body>
      <a href="/marketplace/listing/dup-app">First link</a>
      <a href="/marketplace/listing/dup-app">Duplicate link</a>
      <a href="/marketplace/listing/other-app">Other</a>
    </body></html>`;
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].slug).toBe("dup-app");
    expect(result.apps[1].slug).toBe("other-app");
  });

  // -- hasNextPage --

  it("detects hasNextPage when pagination link and >= 20 apps", () => {
    const apps = Array.from({ length: 24 }, (_, i) => ({
      slug: `app-${i}`,
      name: `App ${i}`,
    }));
    const html = makeCategoryPageHtml({ apps, hasNextPage: true });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.hasNextPage).toBe(true);
  });

  it("returns hasNextPage false when fewer than 20 apps", () => {
    const html = makeCategoryPageHtml({ apps: [{ slug: "single", name: "Single" }], hasNextPage: true });
    const result = parseHubSpotCategoryPage(html, "sales", URL);

    expect(result.hasNextPage).toBe(false);
  });

  // -- Empty page --

  it("handles empty page with no apps", () => {
    const html = "<html><body><h1>Empty Category</h1></body></html>";
    const result = parseHubSpotCategoryPage(html, "empty", URL);

    expect(result.apps).toEqual([]);
    expect(result.appCount).toBeNull();
    expect(result.title).toBe("Empty Category");
  });
});
