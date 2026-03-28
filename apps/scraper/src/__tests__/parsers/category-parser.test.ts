import { describe, it, expect } from "vitest";
import {
  parseCategoryPage,
  shouldUseAllPage,
  hasNextPage,
  computeMetrics,
} from "../../parsers/category-parser.js";
import type { FirstPageApp } from "@appranks/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapHtml(body: string, head = ""): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

function appCardHtml(opts: {
  slug: string;
  name: string;
  position?: number;
  link?: string;
  rating?: string;
  reviewCount?: number;
  bfs?: boolean;
  pricingHint?: string;
}): string {
  const link = opts.link ?? `https://apps.shopify.com/${opts.slug}?surface_type=category`;
  const ratingText = opts.rating
    ? `<span>${opts.rating} out of 5 stars</span><span>(${opts.reviewCount ?? 0}) ${opts.reviewCount ?? 0} total reviews</span>`
    : "";
  const bfsBadge = opts.bfs ? `<span class="built-for-shopify">Built for Shopify</span>` : "";
  const pricing = opts.pricingHint
    ? `<span class="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis">${opts.pricingHint}</span>`
    : "";
  return `
    <div data-controller="app-card"
         data-app-card-handle-value="${opts.slug}"
         data-app-card-name-value="${opts.name}"
         data-app-card-icon-url-value="https://cdn.shopify.com/${opts.slug}.png"
         data-app-card-app-link-value="${link}"
         ${opts.position != null ? `data-app-card-intra-position-value="${opts.position}"` : ""}>
      ${ratingText}
      ${bfsBadge}
      ${pricing}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// parseCategoryPage
// ---------------------------------------------------------------------------

describe("parseCategoryPage", () => {
  it("extracts slug from URL", () => {
    const html = wrapHtml("<h1>Forms</h1>");
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.slug).toBe("forms");
  });

  it("extracts slug from URL with /all suffix", () => {
    const html = wrapHtml("<h1>Forms</h1>");
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms/all");
    expect(result.slug).toBe("forms");
  });

  it("parses title from h1, strips trailing 'apps'", () => {
    const html = wrapHtml("<h1>Contact form apps</h1>");
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/contact-form");
    expect(result.title).toBe("Contact form");
  });

  it("parses app cards from data-controller='app-card' elements", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({ slug: "form-builder", name: "Form Builder", position: 1, rating: "4.9", reviewCount: 500 })}
      ${appCardHtml({ slug: "contact-us", name: "Contact Us", position: 2, rating: "4.5", reviewCount: 200 })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.first_page_apps).toHaveLength(2);
    expect(result.first_page_apps[0].name).toBe("Form Builder");
    expect(result.first_page_apps[1].name).toBe("Contact Us");
  });

  it("parses rating and review count from card text", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({ slug: "rated-app", name: "Rated App", rating: "4.7", reviewCount: 1500 })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    const app = result.first_page_apps[0];
    expect(app.average_rating).toBe(4.7);
    expect(app.rating_count).toBe(1500);
  });

  it("detects sponsored apps from surface_type=category_ad", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({
        slug: "sponsored-app",
        name: "Sponsored App",
        link: "https://apps.shopify.com/sponsored-app?surface_type=category_ad",
        rating: "4.0",
        reviewCount: 50,
      })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.first_page_apps[0].is_sponsored).toBe(true);
  });

  it("detects Built for Shopify badge", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({ slug: "bfs-app", name: "BFS App", bfs: true, rating: "4.9", reviewCount: 3000 })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.first_page_apps[0].is_built_for_shopify).toBe(true);
  });

  it("limits to 24 apps maximum", () => {
    const cards = Array.from({ length: 30 }, (_, i) =>
      appCardHtml({ slug: `app-${i}`, name: `App ${i}`, position: i + 1, rating: "4.0", reviewCount: 10 })
    ).join("\n");
    const html = wrapHtml(`<h1>Big Category</h1>${cards}`);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/big");
    expect(result.first_page_apps.length).toBeLessThanOrEqual(24);
  });

  it("returns empty first_page_apps for page without app cards", () => {
    const html = wrapHtml("<h1>Empty Category</h1><p>No apps here</p>");
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/empty");
    expect(result.first_page_apps).toEqual([]);
    expect(result.first_page_metrics).toBeNull();
  });

  it("sets app_url as https://apps.shopify.com/{slug}", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({ slug: "my-form-app", name: "My Form App", rating: "4.0", reviewCount: 10 })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.first_page_apps[0].app_url).toBe("https://apps.shopify.com/my-form-app");
  });

  it("deduplicates apps by slug", () => {
    const html = wrapHtml(`
      <h1>Forms</h1>
      ${appCardHtml({ slug: "dup-app", name: "Dup App", position: 1, rating: "4.0", reviewCount: 10 })}
      ${appCardHtml({ slug: "dup-app", name: "Dup App Copy", position: 2, rating: "4.5", reviewCount: 20 })}
    `);
    const result = parseCategoryPage(html, "https://apps.shopify.com/categories/forms");
    expect(result.first_page_apps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// shouldUseAllPage
// ---------------------------------------------------------------------------

describe("shouldUseAllPage", () => {
  it("returns true when no app cards on page", () => {
    const html = wrapHtml("<p>Landing page with subcategory links only</p>");
    expect(shouldUseAllPage(html)).toBe(true);
  });

  it("returns true when 'view all' link present", () => {
    const html = wrapHtml(`
      ${appCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })}
      <a href="/categories/forms/all">View all</a>
    `);
    expect(shouldUseAllPage(html)).toBe(true);
  });

  it("returns false when app cards exist and no 'view all' link", () => {
    const html = wrapHtml(`
      ${appCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })}
      <a href="/categories/forms">Category home</a>
    `);
    expect(shouldUseAllPage(html)).toBe(false);
  });

  it("returns true when 'see all' link present", () => {
    const html = wrapHtml(`
      ${appCardHtml({ slug: "app-1", name: "App 1", rating: "4.0", reviewCount: 10 })}
      <a href="/categories/forms/all">See all apps</a>
    `);
    expect(shouldUseAllPage(html)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasNextPage
// ---------------------------------------------------------------------------

describe("hasNextPage", () => {
  it('returns true when a[rel="next"] exists', () => {
    const html = wrapHtml(`<a rel="next" href="?page=2">Next</a>`);
    expect(hasNextPage(html)).toBe(true);
  });

  it("returns false when no next link", () => {
    const html = wrapHtml("<p>No pagination</p>");
    expect(hasNextPage(html)).toBe(false);
  });

  it("returns false when only prev link exists", () => {
    const html = wrapHtml(`<a rel="prev" href="?page=1">Previous</a>`);
    expect(hasNextPage(html)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe("computeMetrics", () => {
  function makeApp(overrides: Partial<FirstPageApp> = {}): FirstPageApp {
    return {
      name: "Test App",
      short_description: "Test",
      average_rating: 4.5,
      rating_count: 100,
      app_url: "https://apps.shopify.com/test",
      logo_url: "",
      is_sponsored: false,
      is_built_for_shopify: false,
      ...overrides,
    };
  }

  it("computes sponsored_count and built_for_shopify_count", () => {
    const apps = [
      makeApp({ is_sponsored: true }),
      makeApp({ is_sponsored: true }),
      makeApp({ is_built_for_shopify: true }),
      makeApp(),
    ];
    const metrics = computeMetrics(apps);
    expect(metrics.sponsored_count).toBe(2);
    expect(metrics.built_for_shopify_count).toBe(1);
  });

  it("computes top_4_avg_rating and top_4_avg_rating_count", () => {
    const apps = [
      makeApp({ average_rating: 5.0, rating_count: 1000 }),
      makeApp({ average_rating: 4.0, rating_count: 800 }),
      makeApp({ average_rating: 3.0, rating_count: 600 }),
      makeApp({ average_rating: 2.0, rating_count: 400 }),
      makeApp({ average_rating: 1.0, rating_count: 200 }),
    ];
    const metrics = computeMetrics(apps);

    // Top 4 by rating_count: 1000, 800, 600, 400
    expect(metrics.top_4_avg_rating).toBeCloseTo((5.0 + 4.0 + 3.0 + 2.0) / 4);
    expect(metrics.top_4_avg_rating_count).toBe((1000 + 800 + 600 + 400) / 4);
  });

  it("computes concentration metrics (top_1_pct, top_4_pct, top_8_pct)", () => {
    const apps = Array.from({ length: 10 }, (_, i) =>
      makeApp({ rating_count: (10 - i) * 100 }) // 1000, 900, 800, ..., 100
    );
    const metrics = computeMetrics(apps);
    const total = 5500; // sum 100..1000

    expect(metrics.top_1_pct_reviews).toBeCloseTo(1000 / total);
    expect(metrics.top_4_pct_reviews).toBeCloseTo((1000 + 900 + 800 + 700) / total);
    expect(metrics.top_8_pct_reviews).toBeCloseTo(
      (1000 + 900 + 800 + 700 + 600 + 500 + 400 + 300) / total
    );
  });

  it("returns 0 for empty arrays in metrics", () => {
    const metrics = computeMetrics([]);
    expect(metrics.sponsored_count).toBe(0);
    expect(metrics.built_for_shopify_count).toBe(0);
    expect(metrics.total_reviews).toBe(0);
    expect(metrics.top_4_avg_rating).toBe(0);
    expect(metrics.top_4_avg_rating_count).toBe(0);
    expect(metrics.top_1_pct_reviews).toBe(0);
    expect(metrics.top_4_pct_reviews).toBe(0);
    expect(metrics.top_8_pct_reviews).toBe(0);
  });

  it("computes count_100_plus_reviews and count_1000_plus_reviews", () => {
    const apps = [
      makeApp({ rating_count: 50 }),
      makeApp({ rating_count: 150 }),
      makeApp({ rating_count: 1500 }),
    ];
    const metrics = computeMetrics(apps);
    expect(metrics.count_100_plus_reviews).toBe(2);
    expect(metrics.count_1000_plus_reviews).toBe(1);
  });

  it("computes total_reviews", () => {
    const apps = [
      makeApp({ rating_count: 100 }),
      makeApp({ rating_count: 200 }),
      makeApp({ rating_count: 300 }),
    ];
    const metrics = computeMetrics(apps);
    expect(metrics.total_reviews).toBe(600);
  });
});
