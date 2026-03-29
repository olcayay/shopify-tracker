import { describe, it, expect } from "vitest";
import { parseAppPage, parseSimilarApps } from "../../parsers/app-parser.js";

// ---------------------------------------------------------------------------
// Helpers to build HTML fixtures
// ---------------------------------------------------------------------------

function wrapHtml(body: string, head = ""): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

function jsonLdScript(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

const FULL_JSON_LD = {
  "@type": "SoftwareApplication",
  name: "TestApp",
  image: "https://cdn.shopify.com/icon.png",
  aggregateRating: { ratingValue: 4.8, ratingCount: 1234 },
};

const FULL_APP_HTML = wrapHtml(
  `
  ${jsonLdScript(FULL_JSON_LD)}
  <div id="app-details">
    <h2>Build forms easily</h2>
    <p class="lg:tw-block">TestApp helps you build forms easily and collect customer feedback efficiently.</p>
    <div data-truncate-content-copy>Fallback truncated content for mobile view here.</div>
    <ul class="tw-list-disc">
      <li>Feature one description here</li>
      <li>Feature two description here</li>
      <li>Feature three goes here</li>
    </ul>
  </div>
  <a href="/partners/test-dev">Test Developer</a>
  <a href="https://test-dev.com">Website</a>
  <a href="https://demo.test.com">View demo</a>
  Free plan available
  <p>Languages </p>
  <p> English, French, and German </p>
  <p>Works with </p>
  <p> Checkout, Shopify Flow </p>
  <p>Categories</p>
  <p>Launched</p>
  <p>January 15, 2024</p>
  <section id="adp-developer" data-developer-support-email="support@test.com">
    <a href="https://help.test.com">Support portal</a>
  </section>
  <div class="app-details-pricing-plan-card">
    <span>Free</span>
    <ul><li>Up to 100 submissions</li><li>Email notifications</li></ul>
  </div>
  <div class="app-details-pricing-plan-card">
    <span>Pro $9.99 / month</span>
    <span>14-day free trial</span>
    <ul><li>Unlimited submissions</li><li>Custom branding</li></ul>
  </div>
  `,
  `<title>TestApp \u2011 Form Builder | Shopify App Store</title>
   <meta name="description" content="Great app for building forms">`
);

// ---------------------------------------------------------------------------
// parseAppPage
// ---------------------------------------------------------------------------

describe("parseAppPage", () => {
  it("parses app name from JSON-LD structured data", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.app_name).toBe("TestApp");
  });

  it("falls back to h1 for app name when no JSON-LD", () => {
    const html = wrapHtml(`<h1>My Great App</h1>`);
    const result = parseAppPage(html, "my-great-app");
    expect(result.app_name).toBe("My Great App");
  });

  it("falls back to slug when no h1 either", () => {
    const html = wrapHtml("<p>Nothing useful here</p>");
    const result = parseAppPage(html, "fallback-slug");
    expect(result.app_name).toBe("fallback-slug");
  });

  it("parses rating and ratingCount from JSON-LD aggregateRating", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.average_rating).toBe(4.8);
    expect(result.rating_count).toBe(1234);
  });

  it("returns null for rating when no JSON-LD", () => {
    const html = wrapHtml("<h1>NoRating App</h1>");
    const result = parseAppPage(html, "no-rating");
    expect(result.average_rating).toBeNull();
    expect(result.rating_count).toBeNull();
  });

  it("parses app introduction from #app-details h2", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.app_introduction).toBe("Build forms easily");
  });

  it("parses app details from #app-details p.lg:tw-block", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.app_details).toContain("TestApp helps you build forms easily");
  });

  it("falls back to data-truncate-content-copy for details", () => {
    const html = wrapHtml(`
      <div id="app-details">
        <h2>Intro heading text</h2>
        <div data-truncate-content-copy>Fallback truncated content for the mobile view here.</div>
      </div>
    `);
    const result = parseAppPage(html, "test");
    expect(result.app_details).toContain("Fallback truncated content");
  });

  it("parses SEO title, strips '| Shopify App Store' suffix", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    // The parser strips the app name prefix and the suffix
    expect(result.seo_title).not.toContain("Shopify App Store");
    expect(result.seo_title.length).toBeGreaterThan(0);
  });

  it("parses meta description", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.seo_meta_description).toBe("Great app for building forms");
  });

  it("parses features from ul.tw-list-disc li inside #app-details", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.features).toHaveLength(3);
    expect(result.features[0]).toBe("Feature one description here");
    expect(result.features[1]).toBe("Feature two description here");
    expect(result.features[2]).toBe("Feature three goes here");
  });

  it("parses pricing summary (Free plan available)", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.pricing).toBe("Free plan available");
  });

  it("parses pricing summary (Free trial available)", () => {
    const html = wrapHtml("Free trial available");
    const result = parseAppPage(html, "test");
    expect(result.pricing).toBe("Free trial available");
  });

  it("parses pricing summary (From $X/month)", () => {
    const html = wrapHtml("From $29.99/month");
    const result = parseAppPage(html, "test");
    expect(result.pricing).toBe("From $29.99/month");
  });

  it("parses developer name and URL from partner link", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.developer.name).toBe("Test Developer");
    expect(result.developer.url).toContain("/partners/test-dev");
  });

  it("parses developer website", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.developer.website).toBe("https://test-dev.com");
  });

  it("parses demo store URL", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.demo_store_url).toBe("https://demo.test.com");
  });

  it("parses languages", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.languages).toContain("English");
    expect(result.languages).toContain("French");
    expect(result.languages).toContain("German");
  });

  it("parses integrations from Works with section", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.integrations).toContain("Checkout");
    expect(result.integrations).toContain("Shopify Flow");
  });

  it("parses launched date", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.launched_date).toBeInstanceOf(Date);
    expect(result.launched_date!.getFullYear()).toBe(2024);
    expect(result.launched_date!.getMonth()).toBe(0); // January = 0
  });

  it("parses support email from data-developer-support-email", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.support).not.toBeNull();
    expect(result.support!.email).toBe("support@test.com");
  });

  it("parses support portal URL", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.support!.portal_url).toBe("https://help.test.com");
  });

  it("parses pricing plans with name, price, period, trial text", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.pricing_plans.length).toBeGreaterThanOrEqual(2);

    const freePlan = result.pricing_plans[0];
    expect(freePlan.name).toBe("Free");

    const proPlan = result.pricing_plans[1];
    expect(proPlan.name).toBe("Pro");
    expect(proPlan.price).toBe("9.99");
    expect(proPlan.period).toBe("month");
    expect(proPlan.trial_text).toBe("14-day free trial");
  });

  it("parses pricing plan features list", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    const freePlan = result.pricing_plans[0];
    expect(freePlan.features).toContain("Up to 100 submissions");
    expect(freePlan.features).toContain("Email notifications");
  });

  it("returns sensible defaults for empty/broken HTML", () => {
    const result = parseAppPage("<html><body></body></html>", "empty-app");
    expect(result.app_slug).toBe("empty-app");
    expect(result.app_name).toBe("empty-app");
    expect(result.icon_url).toBeNull();
    expect(result.app_introduction).toBe("");
    expect(result.app_details).toBe("");
    expect(result.seo_title).toBe("");
    expect(result.seo_meta_description).toBe("");
    expect(result.features).toEqual([]);
    expect(result.pricing).toBe("");
    expect(result.average_rating).toBeNull();
    expect(result.rating_count).toBeNull();
    expect(result.developer).toEqual({ name: "", url: "", website: undefined });
    expect(result.launched_date).toBeNull();
    expect(result.demo_store_url).toBeNull();
    expect(result.languages).toEqual([]);
    expect(result.integrations).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.pricing_plans).toEqual([]);
    expect(result.support).toBeNull();
  });

  it("parses icon URL from JSON-LD image field", () => {
    const result = parseAppPage(FULL_APP_HTML, "test-app");
    expect(result.icon_url).toBe("https://cdn.shopify.com/icon.png");
  });

  it("returns null icon_url when no JSON-LD", () => {
    const html = wrapHtml("<h1>No Icon App</h1>");
    const result = parseAppPage(html, "no-icon");
    expect(result.icon_url).toBeNull();
  });

  it("filters out short features (<=5 chars)", () => {
    const html = wrapHtml(`
      <div id="app-details">
        <ul class="tw-list-disc">
          <li>OK</li>
          <li>This is a valid feature description</li>
        </ul>
      </div>
    `);
    const result = parseAppPage(html, "test");
    expect(result.features).toEqual(["This is a valid feature description"]);
  });

  it("strips 'and' prefix from last language", () => {
    const html = wrapHtml(`
      <p>Languages </p><p> Spanish, and Portuguese </p><p>Works with</p>
    `);
    const result = parseAppPage(html, "test");
    expect(result.languages).toContain("Portuguese");
    expect(result.languages.every((l) => !l.startsWith("and "))).toBe(true);
  });

  it("returns empty languages when no Languages section", () => {
    const html = wrapHtml("<p>Nothing relevant</p>");
    const result = parseAppPage(html, "test");
    expect(result.languages).toEqual([]);
  });

  it("returns empty screenshots when no gallery images", () => {
    const html = wrapHtml("<p>No screenshots here</p>");
    const result = parseAppPage(html, "test");
    expect(result.screenshots).toEqual([]);
  });

  it("extracts screenshot URLs from CDN images with screenshot paths", () => {
    const html = wrapHtml(`
      <img src="https://cdn.shopify.com/screenshots/ss1.png" />
      <img src="https://cdn.shopify.com/screenshots/ss2.png" />
      <img src="https://cdn.shopify.com/avatar/small.png" />
    `);
    const result = parseAppPage(html, "test");
    expect(result.screenshots).toHaveLength(2);
    expect(result.screenshots![0]).toContain("screenshots/ss1.png");
    expect(result.screenshots![1]).toContain("screenshots/ss2.png");
  });

  it("extracts screenshots from gallery class containers", () => {
    const html = wrapHtml(`
      <div class="image-gallery">
        <img src="https://example.com/slide1.jpg" />
        <img src="https://example.com/slide2.jpg" />
      </div>
    `);
    const result = parseAppPage(html, "test");
    expect(result.screenshots).toHaveLength(2);
  });

  it("limits screenshots to 10 max", () => {
    const imgs = Array.from({ length: 15 }, (_, i) =>
      `<img src="https://cdn.shopify.com/screenshots/ss${i}.png" />`
    ).join("");
    const html = wrapHtml(imgs);
    const result = parseAppPage(html, "test");
    expect(result.screenshots!.length).toBeLessThanOrEqual(10);
  });

  it("deduplicates screenshot URLs", () => {
    const html = wrapHtml(`
      <img src="https://cdn.shopify.com/screenshots/same.png" />
      <img src="https://cdn.shopify.com/screenshots/same.png" />
    `);
    const result = parseAppPage(html, "test");
    expect(result.screenshots).toHaveLength(1);
  });

  it("does not include mega-menu partner links as developer", () => {
    const html = wrapHtml(`
      <div class="megamenu-component">
        <a href="/partners/mega-dev">Mega Dev</a>
      </div>
      <a href="/partners/real-dev">Real Developer</a>
    `);
    const result = parseAppPage(html, "test");
    expect(result.developer.name).toBe("Real Developer");
  });
});

// ---------------------------------------------------------------------------
// parseSimilarApps
// ---------------------------------------------------------------------------

describe("parseSimilarApps", () => {
  it("returns empty array when no 'More apps like this' section", () => {
    const html = wrapHtml("<p>No similar apps here</p>");
    const result = parseSimilarApps(html);
    expect(result).toEqual([]);
  });

  it("parses app cards with slug, name, icon_url from data attributes", () => {
    const html = wrapHtml(`
      <section>
        <h2>More apps like this</h2>
        <div class="tw-grid">
          <div data-controller="app-card"
               data-app-card-handle-value="cool-app"
               data-app-card-name-value="Cool App"
               data-app-card-icon-url-value="https://cdn.shopify.com/cool.png"
               data-app-card-intra-position-value="1">
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="another-app"
               data-app-card-name-value="Another App"
               data-app-card-icon-url-value="https://cdn.shopify.com/another.png"
               data-app-card-intra-position-value="2">
          </div>
        </div>
      </section>
    `);
    const result = parseSimilarApps(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      slug: "cool-app",
      name: "Cool App",
      icon_url: "https://cdn.shopify.com/cool.png",
      position: 1,
    });
    expect(result[1]).toEqual({
      slug: "another-app",
      name: "Another App",
      icon_url: "https://cdn.shopify.com/another.png",
      position: 2,
    });
  });

  it("deduplicates apps by slug", () => {
    const html = wrapHtml(`
      <section>
        <h2>More apps like this</h2>
        <div class="tw-grid">
          <div data-controller="app-card"
               data-app-card-handle-value="dup-app"
               data-app-card-name-value="Dup App"
               data-app-card-icon-url-value="https://cdn.shopify.com/dup.png"
               data-app-card-intra-position-value="1">
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="dup-app"
               data-app-card-name-value="Dup App Again"
               data-app-card-icon-url-value="https://cdn.shopify.com/dup2.png"
               data-app-card-intra-position-value="2">
          </div>
        </div>
      </section>
    `);
    const result = parseSimilarApps(html);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("dup-app");
  });

  it("sets position from data-app-card-intra-position-value", () => {
    const html = wrapHtml(`
      <section>
        <h2>More apps like this</h2>
        <div class="tw-grid">
          <div data-controller="app-card"
               data-app-card-handle-value="pos-app"
               data-app-card-name-value="Positioned App"
               data-app-card-icon-url-value=""
               data-app-card-intra-position-value="5">
          </div>
        </div>
      </section>
    `);
    const result = parseSimilarApps(html);
    expect(result[0].position).toBe(5);
  });

  it("sets position to undefined when data-app-card-intra-position-value is absent", () => {
    const html = wrapHtml(`
      <section>
        <h2>More apps like this</h2>
        <div class="tw-grid">
          <div data-controller="app-card"
               data-app-card-handle-value="no-pos"
               data-app-card-name-value="No Position App"
               data-app-card-icon-url-value="">
          </div>
        </div>
      </section>
    `);
    const result = parseSimilarApps(html);
    expect(result[0].position).toBeUndefined();
  });

  it("skips cards without slug or name", () => {
    const html = wrapHtml(`
      <section>
        <h2>More apps like this</h2>
        <div class="tw-grid">
          <div data-controller="app-card"
               data-app-card-handle-value=""
               data-app-card-name-value="No Slug"
               data-app-card-icon-url-value="">
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="no-name"
               data-app-card-name-value=""
               data-app-card-icon-url-value="">
          </div>
          <div data-controller="app-card"
               data-app-card-handle-value="valid"
               data-app-card-name-value="Valid App"
               data-app-card-icon-url-value="">
          </div>
        </div>
      </section>
    `);
    const result = parseSimilarApps(html);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("valid");
  });
});
