import { describe, it, expect } from "vitest";
import { parseHubSpotSearchPage } from "../search-parser.js";
import { makeSearchPageHtml } from "./fixtures.js";

describe("parseHubSpotSearchPage", () => {
  it("parses apps from card layout", () => {
    const html = makeSearchPageHtml();
    const result = parseHubSpotSearchPage(html, "email marketing", 1);

    expect(result.keyword).toBe("email marketing");
    expect(result.currentPage).toBe(1);
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0]).toMatchObject({
      position: 1,
      appSlug: "mailchimp",
      appName: "Mailchimp",
      shortDescription: "Email marketing and automation",
      averageRating: 4.3,
      ratingCount: 187,
      isSponsored: false,
      badges: [],
    });
  });

  it("parses icon URLs", () => {
    const html = makeSearchPageHtml();
    const result = parseHubSpotSearchPage(html, "test", 1);

    expect(result.apps[0].logoUrl).toBe("https://cdn.hubspot.com/mc.png");
    expect(result.apps[1].logoUrl).toBe("https://cdn.hubspot.com/cc.png");
  });

  it("assigns sequential positions", () => {
    const html = makeSearchPageHtml();
    const result = parseHubSpotSearchPage(html, "test", 1);

    expect(result.apps.map((a) => a.position)).toEqual([1, 2]);
  });

  it("extracts total results count", () => {
    const html = makeSearchPageHtml({ totalResults: 57 });
    const result = parseHubSpotSearchPage(html, "crm", 1);

    expect(result.totalResults).toBe(57);
  });

  it("falls back totalResults to apps count when no total element", () => {
    const html = `<html><body>
      <div class="ResultCard">
        <a href="/marketplace/listing/app1"><h4 class="Name">App 1</h4></a>
      </div>
    </body></html>`;
    const result = parseHubSpotSearchPage(html, "test", 1);

    expect(result.totalResults).toBe(1);
  });

  it("defaults rating to 0 when not present", () => {
    const html = makeSearchPageHtml({
      apps: [{ slug: "no-rating", name: "No Rating" }],
    });
    const result = parseHubSpotSearchPage(html, "test", 1);

    expect(result.apps[0].averageRating).toBe(0);
    expect(result.apps[0].ratingCount).toBe(0);
  });

  // -- Fallback (link-based) parsing --

  it("falls back to link-based parsing when no card classes", () => {
    const html = makeSearchPageHtml({ useCardLayout: false });
    const result = parseHubSpotSearchPage(html, "email", 1);

    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].appSlug).toBe("mailchimp");
    expect(result.apps[1].appSlug).toBe("constant-contact");
  });

  it("deduplicates slugs in fallback mode", () => {
    const html = `<html><body>
      <a href="/marketplace/listing/dup-app">First</a>
      <a href="/marketplace/listing/dup-app">Second</a>
      <a href="/marketplace/listing/other">Other</a>
    </body></html>`;
    const result = parseHubSpotSearchPage(html, "test", 1);

    expect(result.apps).toHaveLength(2);
  });

  // -- hasNextPage --

  it("detects hasNextPage when >= 20 apps and pagination present", () => {
    const apps = Array.from({ length: 24 }, (_, i) => ({
      slug: `app-${i}`,
      name: `App ${i}`,
    }));
    const html = makeSearchPageHtml({ apps, hasNextPage: true });
    const result = parseHubSpotSearchPage(html, "crm", 1);

    expect(result.hasNextPage).toBe(true);
  });

  it("returns hasNextPage false when fewer than 20 apps", () => {
    const html = makeSearchPageHtml({ hasNextPage: true });
    const result = parseHubSpotSearchPage(html, "test", 1);

    // Only 2 apps, so hasNextPage should be false even with pagination link
    expect(result.hasNextPage).toBe(false);
  });

  // -- Empty results --

  it("handles empty search results", () => {
    const html = "<html><body><div>No results found</div></body></html>";
    const result = parseHubSpotSearchPage(html, "nonexistent", 1);

    expect(result.apps).toEqual([]);
    expect(result.totalResults).toBeNull();
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("preserves page number", () => {
    const html = makeSearchPageHtml();
    const result = parseHubSpotSearchPage(html, "test", 3);

    expect(result.currentPage).toBe(3);
  });
});
