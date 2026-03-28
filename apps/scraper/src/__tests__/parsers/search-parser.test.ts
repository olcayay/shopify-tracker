import { describe, it, expect } from "vitest";
import { parseSearchPage } from "../../parsers/search-parser.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapHtml(body: string): string {
  return `<html><head></head><body>${body}</body></html>`;
}

function searchCardHtml(opts: {
  slug: string;
  name: string;
  link?: string;
  rating?: string;
  reviewCount?: number;
  bfs?: boolean;
  pricingHint?: string;
}): string {
  const link =
    opts.link ?? `https://apps.shopify.com/${opts.slug}?surface_type=search`;
  const ratingText = opts.rating
    ? `<span>${opts.rating} out of 5 stars</span><span>(${opts.reviewCount ?? 0}) ${opts.reviewCount ?? 0} total reviews</span>`
    : "";
  const bfsBadge = opts.bfs
    ? `<span class="built-for-shopify">Built for Shopify</span>`
    : "";
  const pricing = opts.pricingHint
    ? `<span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">${opts.pricingHint}</span>`
    : "";

  return `
    <div data-controller="app-card"
         data-app-card-handle-value="${opts.slug}"
         data-app-card-name-value="${opts.name}"
         data-app-card-icon-url-value="https://cdn.shopify.com/${opts.slug}.png"
         data-app-card-app-link-value="${link}">
      ${ratingText}
      ${bfsBadge}
      ${pricing}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// parseSearchPage
// ---------------------------------------------------------------------------

describe("parseSearchPage", () => {
  it("parses organic search results with position", () => {
    const html = wrapHtml(`
      <p>42 results for "forms"</p>
      ${searchCardHtml({ slug: "form-builder", name: "Form Builder", rating: "4.9", reviewCount: 500 })}
      ${searchCardHtml({ slug: "contact-us", name: "Contact Us", rating: "4.5", reviewCount: 200 })}
    `);
    const result = parseSearchPage(html, "forms", 1);
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[0].app_slug).toBe("form-builder");
    expect(result.apps[0].is_sponsored).toBe(false);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[1].app_slug).toBe("contact-us");
  });

  it("parses sponsored results with position 0", () => {
    const html = wrapHtml(`
      ${searchCardHtml({
        slug: "sponsored-form",
        name: "Sponsored Form App",
        link: "https://apps.shopify.com/sponsored-form?surface_type=search_ad",
        rating: "4.0",
        reviewCount: 100,
      })}
      ${searchCardHtml({ slug: "organic-app", name: "Organic App", rating: "4.5", reviewCount: 300 })}
    `);
    const result = parseSearchPage(html, "forms", 1);

    const sponsored = result.apps.find((a) => a.app_slug === "sponsored-form");
    expect(sponsored).toBeDefined();
    expect(sponsored!.is_sponsored).toBe(true);
    expect(sponsored!.position).toBe(0);

    const organic = result.apps.find((a) => a.app_slug === "organic-app");
    expect(organic).toBeDefined();
    expect(organic!.is_sponsored).toBe(false);
    expect(organic!.position).toBe(1);
  });

  it("skips built-in features (bif: prefix)", () => {
    const html = wrapHtml(`
      ${searchCardHtml({ slug: "bif:discounts", name: "Discounts", link: "https://apps.shopify.com/bif:discounts" })}
      ${searchCardHtml({ slug: "real-app", name: "Real App", rating: "4.0", reviewCount: 50 })}
    `);
    const result = parseSearchPage(html, "discounts", 1);

    const builtIn = result.apps.find((a) => a.app_slug === "bif:discounts");
    expect(builtIn).toBeDefined();
    expect(builtIn!.is_built_in).toBe(true);
    expect(builtIn!.position).toBe(0);
    expect(builtIn!.app_url).toContain("built-in-features/discounts");

    const realApp = result.apps.find((a) => a.app_slug === "real-app");
    expect(realApp!.position).toBe(1);
  });

  it("detects pagination", () => {
    const html = wrapHtml(`
      ${searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })}
      <a rel="next" href="?page=2&q=test">Next</a>
    `);
    const result = parseSearchPage(html, "test", 1);
    expect(result.has_next_page).toBe(true);
  });

  it("returns false for has_next_page when no next link", () => {
    const html = wrapHtml(
      searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.has_next_page).toBe(false);
  });

  it("parses total results count from 'X results for'", () => {
    const html = wrapHtml(`
      <p>1,234 results for "email marketing"</p>
      ${searchCardHtml({ slug: "mail-app", name: "Mail App", rating: "4.0", reviewCount: 10 })}
    `);
    const result = parseSearchPage(html, "email marketing", 1);
    expect(result.total_results).toBe(1234);
  });

  it("parses total results count from 'X apps'", () => {
    const html = wrapHtml(`
      <p>56 apps</p>
      ${searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })}
    `);
    const result = parseSearchPage(html, "test", 1);
    expect(result.total_results).toBe(56);
  });

  it("returns null for total_results when count not found", () => {
    const html = wrapHtml(
      searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.total_results).toBeNull();
  });

  it("deduplicates by slug per type (sponsored/organic)", () => {
    const html = wrapHtml(`
      ${searchCardHtml({
        slug: "dup-app",
        name: "Dup Sponsored",
        link: "https://apps.shopify.com/dup-app?surface_type=search_ad",
      })}
      ${searchCardHtml({
        slug: "dup-app",
        name: "Dup Sponsored Again",
        link: "https://apps.shopify.com/dup-app?surface_type=search_ad",
      })}
      ${searchCardHtml({ slug: "dup-app", name: "Dup Organic" })}
      ${searchCardHtml({ slug: "dup-app", name: "Dup Organic Again" })}
    `);
    const result = parseSearchPage(html, "test", 1);
    // Should have 1 sponsored + 1 organic = 2
    const sponsored = result.apps.filter((a) => a.is_sponsored);
    const organic = result.apps.filter((a) => !a.is_sponsored);
    expect(sponsored).toHaveLength(1);
    expect(organic).toHaveLength(1);
  });

  it("position offset works correctly", () => {
    const html = wrapHtml(`
      ${searchCardHtml({ slug: "page2-app1", name: "Page 2 App 1", rating: "4.0", reviewCount: 10 })}
      ${searchCardHtml({ slug: "page2-app2", name: "Page 2 App 2", rating: "4.0", reviewCount: 10 })}
    `);
    const result = parseSearchPage(html, "test", 2, 24);
    expect(result.apps[0].position).toBe(25);
    expect(result.apps[1].position).toBe(26);
  });

  it("extracts pricing hints", () => {
    const html = wrapHtml(
      searchCardHtml({
        slug: "paid-app",
        name: "Paid App",
        rating: "4.0",
        reviewCount: 10,
        pricingHint: "From $9.99/month",
      })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps[0].pricing_hint).toBe("From $9.99/month");
  });

  it("sets keyword from argument", () => {
    const html = wrapHtml(
      searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })
    );
    const result = parseSearchPage(html, "email marketing", 1);
    expect(result.keyword).toBe("email marketing");
  });

  it("sets current_page from argument", () => {
    const html = wrapHtml(
      searchCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })
    );
    const result = parseSearchPage(html, "test", 5);
    expect(result.current_page).toBe(5);
  });

  it("returns empty apps for page with no app cards", () => {
    const html = wrapHtml("<p>No results found</p>");
    const result = parseSearchPage(html, "nonexistent", 1);
    expect(result.apps).toEqual([]);
  });

  it("parses rating and review count correctly", () => {
    const html = wrapHtml(
      searchCardHtml({
        slug: "rated-app",
        name: "Rated App",
        rating: "4.7",
        reviewCount: 2500,
      })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps[0].average_rating).toBe(4.7);
    expect(result.apps[0].rating_count).toBe(2500);
  });

  it("generates correct app_url for regular apps", () => {
    const html = wrapHtml(
      searchCardHtml({ slug: "my-app", name: "My App", rating: "4.0", reviewCount: 10 })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps[0].app_url).toBe("https://apps.shopify.com/my-app");
  });

  it("detects Built for Shopify badge", () => {
    const html = wrapHtml(
      searchCardHtml({
        slug: "bfs-app",
        name: "BFS App",
        rating: "4.9",
        reviewCount: 3000,
        bfs: true,
      })
    );
    const result = parseSearchPage(html, "test", 1);
    expect(result.apps[0].is_built_for_shopify).toBe(true);
  });
});
