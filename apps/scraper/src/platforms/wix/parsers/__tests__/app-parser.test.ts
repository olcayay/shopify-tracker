import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractReactQueryState, parseWixAppPage, parseWixReviewPage } from "../app-parser.js";
import { buildWixHtml, buildAppDetailHtml } from "./fixtures.js";

// ── extractReactQueryState ──────────────────────────────────────────────

describe("extractReactQueryState", () => {
  it("decodes base64-encoded JSON from __REACT_QUERY_STATE__", () => {
    const state = { queries: [{ queryKey: ["test"], state: { data: "hello" } }] };
    const html = buildWixHtml(state);
    const result = extractReactQueryState(html);
    assert.deepEqual(result, state);
  });

  it("returns null when no __REACT_QUERY_STATE__ is found", () => {
    const result = extractReactQueryState("<html><body>No state here</body></html>");
    assert.equal(result, null);
  });

  it("returns null for invalid base64 content", () => {
    const html = `<html><script>window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('not-valid-base64!!!'))</script></html>`;
    const result = extractReactQueryState(html);
    assert.equal(result, null);
  });

  it("handles complex nested JSON structures", () => {
    const state = {
      queries: [
        {
          queryKey: ["app-page-test-en"],
          state: {
            data: {
              app: { name: "Test", reviews: { averageRating: 4.5 } },
              pricingPlans: { plans: [{ name: "Free" }] },
            },
          },
        },
      ],
    };
    const html = buildWixHtml(state);
    const result = extractReactQueryState(html);
    assert.equal(result?.queries[0].state.data.app.name, "Test");
  });
});

// ── parseWixAppPage ─────────────────────────────────────────────────────

describe("parseWixAppPage", () => {
  it("parses basic app info (name, slug, icon)", () => {
    const html = buildAppDetailHtml({
      slug: "my-app",
      name: "My App",
      icon: "https://cdn.wix.com/my-icon.png",
    });
    const result = parseWixAppPage(html, "my-app");
    assert.equal(result.name, "My App");
    assert.equal(result.slug, "my-app");
    assert.equal(result.iconUrl, "https://cdn.wix.com/my-icon.png");
  });

  it("parses rating and review count", () => {
    const html = buildAppDetailHtml({ rating: 4.3, reviewCount: 958 });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.averageRating, 4.3);
    assert.equal(result.ratingCount, 958);
  });

  it("parses pricing hint: FREE", () => {
    const html = buildAppDetailHtml({ pricingType: "FREE" });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.pricingHint, "Free");
  });

  it("parses pricing hint: FREE_PLAN_AVAILABLE", () => {
    const html = buildAppDetailHtml({ pricingType: "FREE_PLAN_AVAILABLE" });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.pricingHint, "Free plan available");
  });

  it("parses pricing hint: PAID", () => {
    const html = buildAppDetailHtml({ pricingType: "PAID" });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.pricingHint, "Paid");
  });

  it("parses developer info", () => {
    const html = buildAppDetailHtml({
      developerName: "ACME Corp",
      developerSlug: "acme-corp",
      developerWebsite: "https://acme.com",
    });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.developer?.name, "ACME Corp");
    assert.equal(result.developer?.url, "https://www.wix.com/app-market/developer/acme-corp");
    assert.equal(result.developer?.website, "https://acme.com");
  });

  it("returns null developer when companyInfo is missing", () => {
    const html = buildAppDetailHtml({ developerName: undefined });
    // Override to remove companyInfo
    const state = extractReactQueryState(html)!;
    state.queries[0].state.data.companyInfo = null;
    const html2 = buildWixHtml(state);
    const result = parseWixAppPage(html2, "test-app");
    assert.equal(result.developer, null);
  });

  it("parses platformData.tagline", () => {
    const html = buildAppDetailHtml({ shortDescription: undefined });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.platformData.tagline, "A test app");
  });

  it("parses platformData.description (multi-line)", () => {
    const html = buildAppDetailHtml({ description: "Line 1\nLine 2\nLine 3" });
    const result = parseWixAppPage(html, "test-app");
    assert.equal(result.platformData.description, "Line 1\nLine 2\nLine 3");
  });

  it("parses platformData.benefits", () => {
    const html = buildAppDetailHtml({ benefits: ["Fast setup", "No code", "Analytics"] });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.deepEqual(pd.benefits, ["Fast setup", "No code", "Analytics"]);
  });

  it("parses platformData.demoUrl", () => {
    const html = buildAppDetailHtml({ demoUrl: "https://demo.test.com" });
    const result = parseWixAppPage(html, "test-app");
    assert.equal((result.platformData as any).demoUrl, "https://demo.test.com");
  });

  it("parses platformData.categories with compound slug", () => {
    const html = buildAppDetailHtml({
      categories: [
        { slug: "forms", name: "Forms", parentSlug: "communication", parentName: "Communication" },
        { slug: "email", name: "Email", parentSlug: "marketing", parentName: "Marketing" },
      ],
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.categories.length, 2);
    assert.equal(pd.categories[0].slug, "communication--forms");
    assert.equal(pd.categories[0].parentSlug, "communication");
    assert.equal(pd.categories[1].slug, "marketing--email");
  });

  it("parses platformData.collections", () => {
    const html = buildAppDetailHtml({
      collections: [
        { slug: "collect-leads", name: "Collect Leads" },
        { slug: "grow-your-business", name: "Grow Your Business" },
      ],
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.collections.length, 2);
    assert.equal(pd.collections[0].slug, "collect-leads");
    assert.equal(pd.collections[1].name, "Grow Your Business");
  });

  it("parses screenshots (only IMAGE type, excludes VIDEO)", () => {
    const html = buildAppDetailHtml({
      screenshots: [
        { type: "IMAGE", url: "https://cdn.wix.com/ss1.png" },
        { type: "IMAGE", url: "https://cdn.wix.com/ss2.png" },
        { type: "VIDEO", url: "https://cdn.wix.com/video.mp4" },
      ],
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.screenshots.length, 2);
    assert.equal(pd.screenshots[0], "https://cdn.wix.com/ss1.png");
    assert.equal(pd.screenshots[1], "https://cdn.wix.com/ss2.png");
  });

  it("parses pricing plans with monthly/yearly prices", () => {
    const html = buildAppDetailHtml({
      pricingPlans: [
        {
          name: "Basic",
          isFree: false,
          monthlyPrice: { price: 9.99 },
          yearlyPrice: { price: 7.99 },
          oneTimePrice: null,
          type: "RECURRING",
          description: { benefits: ["Feature A"] },
        },
      ],
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.pricingPlans.length, 1);
    assert.equal(pd.pricingPlans[0].name, "Basic");
    assert.equal(pd.pricingPlans[0].monthlyPrice, 9.99);
    assert.equal(pd.pricingPlans[0].yearlyPrice, 7.99);
    assert.equal(pd.pricingPlans[0].isFree, false);
    assert.deepEqual(pd.pricingPlans[0].benefits, ["Feature A"]);
  });

  it("parses free pricing plan", () => {
    const html = buildAppDetailHtml({
      pricingPlans: [
        {
          name: "Free",
          isFree: true,
          monthlyPrice: null,
          yearlyPrice: null,
          oneTimePrice: null,
          type: "FREE",
          description: { benefits: ["Basic features"] },
        },
      ],
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.pricingPlans[0].isFree, true);
    assert.equal(pd.pricingPlans[0].monthlyPrice, null);
  });

  it("parses currency and trial days", () => {
    const html = buildAppDetailHtml({ currency: "EUR", trialDays: 30 });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.currency, "EUR");
    assert.equal(pd.trialDays, 30);
  });

  it("parses languages", () => {
    const html = buildAppDetailHtml({ languages: ["English", "German", "Japanese"] });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.deepEqual(pd.languages, ["English", "German", "Japanese"]);
  });

  it("parses isAvailableWorldwide", () => {
    const html = buildAppDetailHtml({ isAvailableWorldwide: false });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.isAvailableWorldwide, false);
  });

  it("parses rating histogram", () => {
    const html = buildAppDetailHtml({
      ratingHistogram: { rating5: 80, rating4: 10, rating3: 5, rating2: 3, rating1: 2 },
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.ratingHistogram.rating5, 80);
    assert.equal(pd.ratingHistogram.rating1, 2);
  });

  it("parses badges", () => {
    const html = buildAppDetailHtml({ badges: ["POPULAR", "NEW"] });
    const result = parseWixAppPage(html, "test-app");
    assert.deepEqual(result.badges, ["POPULAR", "NEW"]);
  });

  it("parses developer email into platformData", () => {
    const html = buildAppDetailHtml({
      developerName: "Dev Co",
      developerEmail: "support@dev.co",
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    assert.equal(pd.developerEmail, "support@dev.co");
  });

  it("handles missing optional fields gracefully", () => {
    const state = {
      queries: [
        {
          queryKey: ["app-page-minimal-en"],
          state: {
            data: {
              app: { name: "Minimal", slug: "minimal" },
              overview: {},
              companyInfo: null,
              reviews: {},
              quickInfo: {},
              properties: {},
              pricingPlans: {},
            },
          },
        },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixAppPage(html, "minimal");
    assert.equal(result.name, "Minimal");
    assert.equal(result.averageRating, null);
    assert.equal(result.ratingCount, null);
    assert.equal(result.developer, null);
    const pd = result.platformData as any;
    assert.deepEqual(pd.benefits, []);
    assert.deepEqual(pd.screenshots, []);
    assert.deepEqual(pd.collections, []);
    assert.deepEqual(pd.pricingPlans, []);
    assert.deepEqual(pd.languages, []);
  });

  it("falls back to DOM parsing when no JSON data", () => {
    const html = `<html><body>
      <div data-hook="app-name-heading">DOM App</div>
      <div data-hook="average-rating-heading">4.2 out of 5</div>
      <div data-hook="reviews-number-subtitle">123 reviews</div>
      <div data-hook="company-info-name">DOM Developer</div>
      <p data-hook="app-overview-description">A DOM parsed tagline</p>
    </body></html>`;
    const result = parseWixAppPage(html, "dom-app");
    assert.equal(result.name, "DOM App");
    assert.equal(result.averageRating, 4.2);
    assert.equal(result.ratingCount, 123);
    assert.equal(result.developer?.name, "DOM Developer");
    assert.equal((result.platformData as any).tagline, "A DOM parsed tagline");
  });
});

// ── parseWixReviewPage ──────────────────────────────────────────────────

describe("parseWixReviewPage", () => {
  it("extracts reviews from app detail page", () => {
    const html = buildAppDetailHtml({
      slug: "review-app",
      reviews: [
        { createdAt: "2026-03-01", description: "Excellent!", userName: "User1", rate: 5, replies: [] },
        { createdAt: "2026-02-15", description: "Good but slow", userName: "User2", rate: 4, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews.length, 2);
    assert.equal(result.reviews[0].rating, 5);
    assert.equal(result.reviews[0].reviewerName, "User1");
    assert.equal(result.reviews[0].content, "Excellent!");
    assert.equal(result.reviews[1].rating, 4);
    assert.equal(result.currentPage, 1);
  });

  it("extracts developer reply", () => {
    const html = buildAppDetailHtml({
      reviews: [
        {
          createdAt: "2026-03-01",
          description: "Nice app",
          userName: "Reviewer",
          rate: 4,
          replies: [{ createdAt: "2026-03-02", description: "Thank you!" }],
        },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews[0].developerReplyText, "Thank you!");
    assert.equal(result.reviews[0].developerReplyDate, "2026-03-02");
  });

  it("handles reviews with no replies", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "Test", userName: "User", rate: 3, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews[0].developerReplyText, null);
    assert.equal(result.reviews[0].developerReplyDate, null);
  });

  it("uses title as content fallback when description is empty", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "", title: "Great!", userName: "User", rate: 5, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews[0].content, "Great!");
  });

  it("handles Anonymous reviewer", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "Anonymous review", userName: "", rate: 4, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews[0].reviewerName, "Anonymous");
  });

  it("returns empty reviews when no review data exists", () => {
    const state = {
      queries: [{ queryKey: ["app-page-empty-en"], state: { data: { reviews: {} } } }],
    };
    const html = buildWixHtml(state);
    const result = parseWixReviewPage(html, 1);
    assert.equal(result.reviews.length, 0);
    assert.equal(result.hasNextPage, false);
  });

  it("returns empty reviews for pages without __REACT_QUERY_STATE__", () => {
    const result = parseWixReviewPage("<html><body>No data</body></html>", 1);
    assert.equal(result.reviews.length, 0);
    assert.equal(result.hasNextPage, false);
  });
});
