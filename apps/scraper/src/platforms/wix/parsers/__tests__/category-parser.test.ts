import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWixCategoryPage } from "../category-parser.js";
import {
  buildL1CategoryHtml,
  buildL2CategoryHtml,
  buildWixHtml,
  buildSidebarCategoryLink,
} from "./fixtures.js";

// ── L1 Category Page (grouped sections) ─────────────────────────────────

describe("parseWixCategoryPage — L1 (grouped sections)", () => {
  it("parses category title and description", () => {
    const html = buildL1CategoryHtml({
      slug: "marketing",
      name: "Marketing",
      description: "Grow your business",
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.equal(result.title, "Marketing");
    assert.equal(result.description, "Grow your business");
    assert.equal(result.slug, "marketing");
  });

  it("flattens apps from all sections with sequential positions", () => {
    const html = buildL1CategoryHtml({
      slug: "marketing",
      sections: [
        {
          tagSlug: "seo",
          title: "SEO",
          apps: [
            { slug: "app-1", name: "App 1" },
            { slug: "app-2", name: "App 2" },
          ],
        },
        {
          tagSlug: "ads",
          title: "Ads",
          apps: [
            { slug: "app-3", name: "App 3" },
          ],
        },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.equal(result.apps.length, 3);
    assert.equal(result.apps[0].position, 1);
    assert.equal(result.apps[1].position, 2);
    assert.equal(result.apps[2].position, 3);
  });

  it("generates compound subcategory slugs from sections", () => {
    const html = buildL1CategoryHtml({
      slug: "marketing",
      sections: [
        { tagSlug: "seo", title: "SEO", apps: [] },
        { tagSlug: "analytics", title: "Analytics", apps: [] },
        { tagSlug: "email", title: "Email", apps: [] },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    const slugs = result.subcategoryLinks.map((s) => s.slug);
    assert.deepEqual(slugs, ["marketing--seo", "marketing--analytics", "marketing--email"]);
  });

  it("subcategory links include correct parentSlug", () => {
    const html = buildL1CategoryHtml({
      slug: "communication",
      sections: [{ tagSlug: "forms", title: "Forms", apps: [] }],
    });
    const result = parseWixCategoryPage(html, "communication", 1, 0);
    assert.equal(result.subcategoryLinks[0].parentSlug, "communication");
    assert.equal(result.subcategoryLinks[0].title, "Forms");
  });

  it("builds correct subcategory URLs", () => {
    const html = buildL1CategoryHtml({
      slug: "marketing",
      sections: [{ tagSlug: "seo", title: "SEO", apps: [] }],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.equal(
      result.subcategoryLinks[0].url,
      "https://www.wix.com/app-market/category/marketing/seo",
    );
  });

  it("parses app card fields", () => {
    const html = buildL1CategoryHtml({
      sections: [
        {
          tagSlug: "seo",
          title: "SEO",
          apps: [
            {
              slug: "my-seo-app",
              name: "My SEO App",
              shortDescription: "Best SEO",
              rating: 4.7,
              reviewCount: 250,
              pricingType: "FREE_PLAN_AVAILABLE",
            },
          ],
        },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    const app = result.apps[0];
    assert.equal(app.slug, "my-seo-app");
    assert.equal(app.name, "My SEO App");
    assert.equal(app.averageRating, 4.7);
    assert.equal(app.ratingCount, 250);
    assert.equal(app.pricingHint, "Free plan available");
    assert.equal(app.isSponsored, false);
  });

  it("applies offset to positions", () => {
    const html = buildL1CategoryHtml({
      sections: [
        {
          tagSlug: "seo",
          title: "SEO",
          apps: [{ slug: "a1", name: "A1" }, { slug: "a2", name: "A2" }],
        },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 10);
    assert.equal(result.apps[0].position, 11);
    assert.equal(result.apps[1].position, 12);
  });

  it("sets hasNextPage to false (all apps on one page)", () => {
    const html = buildL1CategoryHtml();
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.equal(result.hasNextPage, false);
  });

  it("builds correct page URL for simple slug", () => {
    const html = buildL1CategoryHtml({ slug: "marketing" });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.equal(result.url, "https://www.wix.com/app-market/category/marketing");
  });

  it("parses badges from app cards", () => {
    const html = buildL1CategoryHtml({
      sections: [
        {
          tagSlug: "seo",
          title: "SEO",
          apps: [{ slug: "badged-app", name: "Badged", badges: ["POPULAR"] }],
        },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    assert.deepEqual(result.apps[0].badges, ["POPULAR"]);
  });
});

// ── L2 Subcategory Page (flat app list) ──────────────────────────────────

describe("parseWixCategoryPage — L2 (flat list)", () => {
  it("parses subcategory title from header data", () => {
    const html = buildL2CategoryHtml({ title: "Search Engine Optimization" });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.title, "Search Engine Optimization");
  });

  it("parses flat list of apps", () => {
    const html = buildL2CategoryHtml({
      apps: [
        { slug: "tool-1", name: "Tool 1", rating: 4.5, reviewCount: 100 },
        { slug: "tool-2", name: "Tool 2", rating: 4.0, reviewCount: 50 },
        { slug: "tool-3", name: "Tool 3", rating: 3.5, reviewCount: 25 },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.apps.length, 3);
    assert.equal(result.apps[0].slug, "tool-1");
    assert.equal(result.apps[2].slug, "tool-3");
  });

  it("sequential positions starting from 1", () => {
    const html = buildL2CategoryHtml({
      apps: [
        { slug: "a", name: "A" },
        { slug: "b", name: "B" },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.apps[0].position, 1);
    assert.equal(result.apps[1].position, 2);
  });

  it("applies offset to positions", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "a", name: "A" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 20);
    assert.equal(result.apps[0].position, 21);
  });

  it("parses paging total", () => {
    const html = buildL2CategoryHtml({ total: 42, apps: [{ slug: "a", name: "A" }] });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.appCount, 42);
  });

  it("respects hasNext from paging", () => {
    const html = buildL2CategoryHtml({ hasNext: true });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.hasNextPage, true);
  });

  it("converts compound slug to URL with /", () => {
    const html = buildL2CategoryHtml();
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.url, "https://www.wix.com/app-market/category/marketing/seo");
  });

  it("pricing hint parsing: FREE", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "free-app", name: "Free App", pricingType: "FREE" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.apps[0].pricingHint, "Free");
  });

  it("pricing hint parsing: Paid", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "paid-app", name: "Paid App", pricingType: "SUBSCRIPTION" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    assert.equal(result.apps[0].pricingHint, "Paid");
  });

  it("merges sidebar subcategory links when category is also a parent", () => {
    const sidebar = [
      buildSidebarCategoryLink("marketing", "Marketing", [
        { slug: "seo", label: "SEO" },
        { slug: "ads", label: "Ads" },
      ]),
    ];
    const html = buildL2CategoryHtml({
      parentSlug: "marketing",
      childSlug: "seo",
      sidebarCategories: sidebar,
    });
    // This L2 page is for marketing--seo, but the sidebar shows marketing's subcategories
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    // Since the slug is "marketing" and the sidebar has "marketing" entry, subcategories merge
    assert.ok(result.subcategoryLinks.length > 0);
  });
});

// ── Virtual Category (no apps, sidebar-only) ─────────────────────────────

describe("parseWixCategoryPage — Virtual category", () => {
  it("returns subcategory links from sidebar when no category data exists", () => {
    const sidebar = [
      buildSidebarCategoryLink("media", "Media & Content", [
        { slug: "gallery", label: "Gallery" },
        { slug: "music", label: "Music" },
        { slug: "video", label: "Video" },
      ]),
    ];
    // Build HTML with only sidebar data (no category-page or initial-apps-fetch query)
    const state = {
      queries: [
        {
          queryKey: ["app-market-sidebar"],
          state: { data: [sidebar] },
        },
        // Some unrelated query that doesn't match our patterns
        {
          queryKey: ["query-tag-media-en"],
          state: { data: { someData: true } },
        },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixCategoryPage(html, "media", 1, 0);

    assert.equal(result.apps.length, 0);
    assert.equal(result.appCount, 0);
    assert.equal(result.subcategoryLinks.length, 3);
    assert.equal(result.subcategoryLinks[0].slug, "media--gallery");
    assert.equal(result.subcategoryLinks[1].slug, "media--music");
    assert.equal(result.subcategoryLinks[2].slug, "media--video");
  });

  it("uses sidebar label as title for virtual category", () => {
    const sidebar = [
      buildSidebarCategoryLink("media", "Media & Content", [
        { slug: "gallery", label: "Gallery" },
      ]),
    ];
    const state = {
      queries: [
        { queryKey: ["app-market-sidebar"], state: { data: [sidebar] } },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixCategoryPage(html, "media", 1, 0);
    assert.equal(result.title, "Media & Content");
  });

  it("returns fallback when no data and no sidebar", () => {
    const html = buildWixHtml({ queries: [] });
    const result = parseWixCategoryPage(html, "unknown-cat", 1, 0);
    assert.equal(result.apps.length, 0);
    assert.equal(result.subcategoryLinks.length, 0);
    assert.equal(result.slug, "unknown-cat");
    assert.equal(result.title, "unknown-cat");
  });

  it("generates correct URLs for sidebar subcategory links", () => {
    const sidebar = [
      buildSidebarCategoryLink("design-elements", "Design Elements", [
        { slug: "maps--navigation", label: "Maps & Navigation" },
      ]),
    ];
    const state = {
      queries: [
        { queryKey: ["app-market-sidebar"], state: { data: [sidebar] } },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixCategoryPage(html, "design-elements", 1, 0);
    assert.equal(
      result.subcategoryLinks[0].url,
      "https://www.wix.com/app-market/category/design-elements/maps--navigation",
    );
  });
});

// ── Compound slug handling ───────────────────────────────────────────────

describe("parseWixCategoryPage — compound slug handling", () => {
  it("converts -- to / in URL for compound slug", () => {
    const html = buildL2CategoryHtml({ parentSlug: "booking", childSlug: "events" });
    const result = parseWixCategoryPage(html, "booking--events", 1, 0);
    assert.equal(result.url, "https://www.wix.com/app-market/category/booking/events");
  });

  it("does not convert -- in slug for the result slug field", () => {
    const html = buildL2CategoryHtml({ parentSlug: "booking", childSlug: "events" });
    const result = parseWixCategoryPage(html, "booking--events", 1, 0);
    assert.equal(result.slug, "booking--events");
  });

  it("handles triple compound slug correctly (only first -- converted)", () => {
    const html = buildL2CategoryHtml({ childSlug: "shipping--delivery" });
    // The URL builder only replaces the first -- with /
    const result = parseWixCategoryPage(html, "ecommerce--shipping--delivery", 1, 0);
    assert.equal(
      result.url,
      "https://www.wix.com/app-market/category/ecommerce/shipping--delivery",
    );
  });
});
