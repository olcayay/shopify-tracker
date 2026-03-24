import { describe, it, expect } from "vitest";
import { extractReactQueryState, parseWixAppPage, parseWixReviewPage } from "../app-parser.js";
import { buildWixHtml, buildAppDetailHtml } from "./fixtures.js";

// ── extractReactQueryState ──────────────────────────────────────────────

describe("extractReactQueryState", () => {
  it("decodes base64-encoded JSON from __REACT_QUERY_STATE__", () => {
    const state = { queries: [{ queryKey: ["test"], state: { data: "hello" } }] };
    const html = buildWixHtml(state);
    const result = extractReactQueryState(html);
    expect(result).toEqual(state);
  });

  it("returns null when no __REACT_QUERY_STATE__ is found", () => {
    const result = extractReactQueryState("<html><body>No state here</body></html>");
    expect(result).toBe(null);
  });

  it("returns null for invalid base64 content", () => {
    const html = `<html><script>window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('not-valid-base64!!!'))</script></html>`;
    const result = extractReactQueryState(html);
    expect(result).toBe(null);
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
    expect(result?.queries[0].state.data.app.name).toBe("Test");
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
    expect(result.name).toBe("My App");
    expect(result.slug).toBe("my-app");
    expect(result.iconUrl).toBe("https://cdn.wix.com/my-icon.png");
  });

  it("parses rating and review count", () => {
    const html = buildAppDetailHtml({ rating: 4.3, reviewCount: 958 });
    const result = parseWixAppPage(html, "test-app");
    expect(result.averageRating).toBe(4.3);
    expect(result.ratingCount).toBe(958);
  });

  it("parses pricing hint: FREE", () => {
    const html = buildAppDetailHtml({ pricingType: "FREE" });
    const result = parseWixAppPage(html, "test-app");
    expect(result.pricingHint).toBe("Free");
  });

  it("parses pricing hint: FREE_PLAN_AVAILABLE", () => {
    const html = buildAppDetailHtml({ pricingType: "FREE_PLAN_AVAILABLE" });
    const result = parseWixAppPage(html, "test-app");
    expect(result.pricingHint).toBe("Free plan available");
  });

  it("parses pricing hint: PAID", () => {
    const html = buildAppDetailHtml({ pricingType: "PAID" });
    const result = parseWixAppPage(html, "test-app");
    expect(result.pricingHint).toBe("Paid");
  });

  it("parses developer info", () => {
    const html = buildAppDetailHtml({
      developerName: "ACME Corp",
      developerSlug: "acme-corp",
      developerWebsite: "https://acme.com",
    });
    const result = parseWixAppPage(html, "test-app");
    expect(result.developer?.name).toBe("ACME Corp");
    expect(result.developer?.url).toBe("https://www.wix.com/app-market/developer/acme-corp");
    expect(result.developer?.website).toBe("https://acme.com");
  });

  it("returns null developer when companyInfo is missing", () => {
    const html = buildAppDetailHtml({ developerName: undefined });
    // Override to remove companyInfo
    const state = extractReactQueryState(html)!;
    state.queries[0].state.data.companyInfo = null;
    const html2 = buildWixHtml(state);
    const result = parseWixAppPage(html2, "test-app");
    expect(result.developer).toBe(null);
  });

  it("parses platformData.tagline", () => {
    const html = buildAppDetailHtml({ shortDescription: undefined });
    const result = parseWixAppPage(html, "test-app");
    expect(result.platformData.tagline).toBe("A test app");
  });

  it("parses platformData.description (multi-line)", () => {
    const html = buildAppDetailHtml({ description: "Line 1\nLine 2\nLine 3" });
    const result = parseWixAppPage(html, "test-app");
    expect(result.platformData.description).toBe("Line 1\nLine 2\nLine 3");
  });

  it("parses platformData.benefits", () => {
    const html = buildAppDetailHtml({ benefits: ["Fast setup", "No code", "Analytics"] });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.benefits).toEqual(["Fast setup", "No code", "Analytics"]);
  });

  it("parses platformData.demoUrl", () => {
    const html = buildAppDetailHtml({ demoUrl: "https://demo.test.com" });
    const result = parseWixAppPage(html, "test-app");
    expect((result.platformData as any).demoUrl).toBe("https://demo.test.com");
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
    expect(pd.categories.length).toBe(2);
    expect(pd.categories[0].slug).toBe("communication--forms");
    expect(pd.categories[0].parentSlug).toBe("communication");
    expect(pd.categories[1].slug).toBe("marketing--email");
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
    expect(pd.collections.length).toBe(2);
    expect(pd.collections[0].slug).toBe("collect-leads");
    expect(pd.collections[1].name).toBe("Grow Your Business");
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
    expect(pd.screenshots.length).toBe(2);
    expect(pd.screenshots[0]).toBe("https://cdn.wix.com/ss1.png");
    expect(pd.screenshots[1]).toBe("https://cdn.wix.com/ss2.png");
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
    expect(pd.pricingPlans.length).toBe(1);
    expect(pd.pricingPlans[0].name).toBe("Basic");
    expect(pd.pricingPlans[0].monthlyPrice).toBe(9.99);
    expect(pd.pricingPlans[0].yearlyPrice).toBe(7.99);
    expect(pd.pricingPlans[0].isFree).toBe(false);
    expect(pd.pricingPlans[0].benefits).toEqual(["Feature A"]);
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
    expect(pd.pricingPlans[0].isFree).toBe(true);
    expect(pd.pricingPlans[0].monthlyPrice).toBe(null);
  });

  it("parses currency and trial days", () => {
    const html = buildAppDetailHtml({ currency: "EUR", trialDays: 30 });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.currency).toBe("EUR");
    expect(pd.trialDays).toBe(30);
  });

  it("parses languages", () => {
    const html = buildAppDetailHtml({ languages: ["English", "German", "Japanese"] });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.languages).toEqual(["English", "German", "Japanese"]);
  });

  it("parses isAvailableWorldwide", () => {
    const html = buildAppDetailHtml({ isAvailableWorldwide: false });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.isAvailableWorldwide).toBe(false);
  });

  it("parses rating histogram", () => {
    const html = buildAppDetailHtml({
      ratingHistogram: { rating5: 80, rating4: 10, rating3: 5, rating2: 3, rating1: 2 },
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.ratingHistogram.rating5).toBe(80);
    expect(pd.ratingHistogram.rating1).toBe(2);
  });

  it("parses badges", () => {
    const html = buildAppDetailHtml({ badges: ["POPULAR", "NEW"] });
    const result = parseWixAppPage(html, "test-app");
    expect(result.badges).toEqual(["POPULAR", "NEW"]);
  });

  it("parses developer email into platformData", () => {
    const html = buildAppDetailHtml({
      developerName: "Dev Co",
      developerEmail: "support@dev.co",
    });
    const result = parseWixAppPage(html, "test-app");
    const pd = result.platformData as any;
    expect(pd.developerEmail).toBe("support@dev.co");
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
    expect(result.name).toBe("Minimal");
    expect(result.averageRating).toBe(null);
    expect(result.ratingCount).toBe(null);
    expect(result.developer).toBe(null);
    const pd = result.platformData as any;
    expect(pd.benefits).toEqual([]);
    expect(pd.screenshots).toEqual([]);
    expect(pd.collections).toEqual([]);
    expect(pd.pricingPlans).toEqual([]);
    expect(pd.languages).toEqual([]);
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
    expect(result.name).toBe("DOM App");
    expect(result.averageRating).toBe(4.2);
    expect(result.ratingCount).toBe(123);
    expect(result.developer?.name).toBe("DOM Developer");
    expect((result.platformData as any).tagline).toBe("A DOM parsed tagline");
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
    expect(result.reviews.length).toBe(2);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[0].reviewerName).toBe("User1");
    expect(result.reviews[0].content).toBe("Excellent!");
    expect(result.reviews[1].rating).toBe(4);
    expect(result.currentPage).toBe(1);
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
    expect(result.reviews[0].developerReplyText).toBe("Thank you!");
    expect(result.reviews[0].developerReplyDate).toBe("2026-03-02");
  });

  it("handles reviews with no replies", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "Test", userName: "User", rate: 3, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    expect(result.reviews[0].developerReplyText).toBe(null);
    expect(result.reviews[0].developerReplyDate).toBe(null);
  });

  it("uses title as content fallback when description is empty", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "", title: "Great!", userName: "User", rate: 5, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    expect(result.reviews[0].content).toBe("Great!");
  });

  it("handles Anonymous reviewer", () => {
    const html = buildAppDetailHtml({
      reviews: [
        { createdAt: "2026-03-01", description: "Anonymous review", userName: "", rate: 4, replies: [] },
      ],
    });
    const result = parseWixReviewPage(html, 1);
    expect(result.reviews[0].reviewerName).toBe("Anonymous");
  });

  it("returns empty reviews when no review data exists", () => {
    const state = {
      queries: [{ queryKey: ["app-page-empty-en"], state: { data: { reviews: {} } } }],
    };
    const html = buildWixHtml(state);
    const result = parseWixReviewPage(html, 1);
    expect(result.reviews.length).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("returns empty reviews for pages without __REACT_QUERY_STATE__", () => {
    const result = parseWixReviewPage("<html><body>No data</body></html>", 1);
    expect(result.reviews.length).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });
});
