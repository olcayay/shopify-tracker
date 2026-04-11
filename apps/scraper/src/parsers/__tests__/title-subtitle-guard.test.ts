import { describe, it, expect } from "vitest";
import { parseSearchPage } from "../search-parser.js";
import { parseCategoryPage } from "../category-parser.js";

/**
 * Tests that extractDescription() fallback rejects text matching the app title,
 * preventing the title from being stored as the subtitle (PLA-1001).
 */

function makeSearchCard(opts: {
  slug: string;
  name: string;
  subtitle?: string;
  includeSubtitleDiv?: boolean;
}): string {
  const subtitleDiv = opts.includeSubtitleDiv && opts.subtitle
    ? `<div class="tw-text-fg-secondary tw-text-body-xs">${opts.subtitle}</div>`
    : "";
  // When subtitle div is absent, fallback searches <p> and <div> for longest text.
  // If the app name is the longest text, it should be rejected.
  const fallbackContent = !opts.includeSubtitleDiv
    ? `<div>${opts.name}</div><p>short</p>`
    : "";

  return `
    <div data-controller="app-card"
         data-app-card-handle-value="${opts.slug}"
         data-app-card-name-value="${opts.name}"
         data-app-card-icon-url-value="https://example.com/icon.png"
         data-app-card-app-link-value="https://apps.shopify.com/${opts.slug}">
      ${subtitleDiv}
      ${fallbackContent}
      <span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">Free</span>
    </div>
  `;
}

function wrapInSearchPage(cards: string): string {
  return `<html><body>${cards}</body></html>`;
}

describe("extractDescription() title guard — search parser", () => {
  it("returns correct subtitle when primary selector matches", () => {
    const html = wrapInSearchPage(
      makeSearchCard({
        slug: "my-app",
        name: "My Amazing App",
        subtitle: "Boost your sales with AI",
        includeSubtitleDiv: true,
      })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].short_description).toBe("Boost your sales with AI");
  });

  it("rejects app title in fallback — returns empty instead of title", () => {
    const html = wrapInSearchPage(
      makeSearchCard({
        slug: "my-app",
        name: "My Amazing App",
        includeSubtitleDiv: false,
      })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps).toHaveLength(1);
    // The fallback should NOT return the app title as the subtitle
    expect(result.apps[0].short_description).not.toBe("My Amazing App");
  });

  it("returns real subtitle from fallback when title is not the longest text", () => {
    const html = `<html><body>
      <div data-controller="app-card"
           data-app-card-handle-value="cool-app"
           data-app-card-name-value="Cool App"
           data-app-card-icon-url-value="https://example.com/icon.png"
           data-app-card-app-link-value="https://apps.shopify.com/cool-app">
        <div>Cool App</div>
        <p>A really great tool for managing your store inventory efficiently</p>
        <span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">Free</span>
      </div>
    </body></html>`;
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps).toHaveLength(1);
    // Should pick the longer non-title text
    expect(result.apps[0].short_description).toBe(
      "A really great tool for managing your store inventory efficiently"
    );
  });
});

function makeCategoryCard(opts: {
  slug: string;
  name: string;
  subtitle?: string;
  includeSubtitleDiv?: boolean;
}): string {
  const subtitleDiv = opts.includeSubtitleDiv && opts.subtitle
    ? `<div class="tw-text-fg-secondary tw-text-body-xs">${opts.subtitle}</div>`
    : "";
  const fallbackContent = !opts.includeSubtitleDiv
    ? `<div>${opts.name}</div><p>short</p>`
    : "";

  return `
    <div data-controller="app-card"
         data-app-card-handle-value="${opts.slug}"
         data-app-card-name-value="${opts.name}"
         data-app-card-icon-url-value="https://example.com/icon.png"
         data-app-card-app-link-value="https://apps.shopify.com/${opts.slug}"
         data-app-card-intra-position-value="1">
      ${subtitleDiv}
      ${fallbackContent}
      <span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">Free</span>
    </div>
  `;
}

describe("extractDescription() title guard — category parser", () => {
  const categoryUrl = "https://apps.shopify.com/categories/store-management";

  it("rejects app title in fallback path", () => {
    const html = `<html><body>
      <h1>Store management</h1>
      ${makeCategoryCard({ slug: "test-app", name: "Test Application Pro", includeSubtitleDiv: false })}
    </body></html>`;
    const result = parseCategoryPage(html, categoryUrl);
    expect(result.first_page_apps).toHaveLength(1);
    expect(result.first_page_apps[0].short_description).not.toBe("Test Application Pro");
  });

  it("returns subtitle from primary selector correctly", () => {
    const html = `<html><body>
      <h1>Store management</h1>
      ${makeCategoryCard({
        slug: "test-app",
        name: "Test Application Pro",
        subtitle: "The best testing tool for Shopify",
        includeSubtitleDiv: true,
      })}
    </body></html>`;
    const result = parseCategoryPage(html, categoryUrl);
    expect(result.first_page_apps).toHaveLength(1);
    expect(result.first_page_apps[0].short_description).toBe("The best testing tool for Shopify");
  });
});

describe("Title-subtitle conflict detection logic", () => {
  /**
   * Simulates the guard in keyword-scraper.ts:
   * A subtitle change should be rejected if the new subtitle matches the app name.
   */
  function shouldRecordSubtitleChange(
    newSubtitle: string,
    appName: string,
    existingAppName: string | null,
    existingSubtitle: string | null
  ): boolean {
    // Guard 1: new subtitle matches parsed app name
    if (newSubtitle.toLowerCase() === appName.toLowerCase()) return false;
    // Guard 2: new subtitle matches DB app name
    if (existingAppName && existingAppName.toLowerCase() === newSubtitle.toLowerCase()) return false;
    // Guard 3: no change from existing
    if (existingSubtitle === newSubtitle) return false;
    return true;
  }

  it("rejects subtitle change when new value equals app name (parsed)", () => {
    expect(shouldRecordSubtitleChange("My App", "My App", null, "Old subtitle")).toBe(false);
  });

  it("rejects subtitle change when new value equals DB app name", () => {
    expect(shouldRecordSubtitleChange("My App", "other", "My App", "Old subtitle")).toBe(false);
  });

  it("rejects case-insensitive match", () => {
    expect(shouldRecordSubtitleChange("my app", "My App", null, "Old subtitle")).toBe(false);
  });

  it("allows legitimate subtitle change", () => {
    expect(shouldRecordSubtitleChange("Boost your sales", "My App", "My App", "Old subtitle")).toBe(true);
  });

  it("allows change when subtitle and name are different", () => {
    expect(shouldRecordSubtitleChange("New subtitle", "Different App", "Different App", "Old subtitle")).toBe(true);
  });

  it("rejects when no actual change (same as existing)", () => {
    expect(shouldRecordSubtitleChange("Same", "App", "App", "Same")).toBe(false);
  });
});
