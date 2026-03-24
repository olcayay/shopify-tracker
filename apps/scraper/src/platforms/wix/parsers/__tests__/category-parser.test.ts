import { describe, it, expect } from "vitest";
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
    expect(result.title).toBe("Marketing");
    expect(result.description).toBe("Grow your business");
    expect(result.slug).toBe("marketing");
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
    expect(result.apps.length).toBe(3);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[2].position).toBe(3);
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
    expect(slugs).toEqual(["marketing--seo", "marketing--analytics", "marketing--email"]);
  });

  it("subcategory links include correct parentSlug", () => {
    const html = buildL1CategoryHtml({
      slug: "communication",
      sections: [{ tagSlug: "forms", title: "Forms", apps: [] }],
    });
    const result = parseWixCategoryPage(html, "communication", 1, 0);
    expect(result.subcategoryLinks[0].parentSlug).toBe("communication");
    expect(result.subcategoryLinks[0].title).toBe("Forms");
  });

  it("builds correct subcategory URLs", () => {
    const html = buildL1CategoryHtml({
      slug: "marketing",
      sections: [{ tagSlug: "seo", title: "SEO", apps: [] }],
    });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    expect(result.subcategoryLinks[0].url).toBe("https://www.wix.com/app-market/category/marketing/seo",);
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
    expect(app.slug).toBe("my-seo-app");
    expect(app.name).toBe("My SEO App");
    expect(app.averageRating).toBe(4.7);
    expect(app.ratingCount).toBe(250);
    expect(app.pricingHint).toBe("Free plan available");
    expect(app.isSponsored).toBe(false);
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
    expect(result.apps[0].position).toBe(11);
    expect(result.apps[1].position).toBe(12);
  });

  it("sets hasNextPage to false (all apps on one page)", () => {
    const html = buildL1CategoryHtml();
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    expect(result.hasNextPage).toBe(false);
  });

  it("builds correct page URL for simple slug", () => {
    const html = buildL1CategoryHtml({ slug: "marketing" });
    const result = parseWixCategoryPage(html, "marketing", 1, 0);
    expect(result.url).toBe("https://www.wix.com/app-market/category/marketing");
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
    expect(result.apps[0].badges).toEqual(["POPULAR"]);
  });
});

// ── L2 Subcategory Page (flat app list) ──────────────────────────────────

describe("parseWixCategoryPage — L2 (flat list)", () => {
  it("parses subcategory title from header data", () => {
    const html = buildL2CategoryHtml({ title: "Search Engine Optimization" });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.title).toBe("Search Engine Optimization");
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
    expect(result.apps.length).toBe(3);
    expect(result.apps[0].slug).toBe("tool-1");
    expect(result.apps[2].slug).toBe("tool-3");
  });

  it("sequential positions starting from 1", () => {
    const html = buildL2CategoryHtml({
      apps: [
        { slug: "a", name: "A" },
        { slug: "b", name: "B" },
      ],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
  });

  it("applies offset to positions", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "a", name: "A" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 20);
    expect(result.apps[0].position).toBe(21);
  });

  it("parses paging total", () => {
    const html = buildL2CategoryHtml({ total: 42, apps: [{ slug: "a", name: "A" }] });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.appCount).toBe(42);
  });

  it("respects hasNext from paging", () => {
    const html = buildL2CategoryHtml({ hasNext: true });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.hasNextPage).toBe(true);
  });

  it("converts compound slug to URL with /", () => {
    const html = buildL2CategoryHtml();
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.url).toBe("https://www.wix.com/app-market/category/marketing/seo");
  });

  it("pricing hint parsing: FREE", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "free-app", name: "Free App", pricingType: "FREE" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.apps[0].pricingHint).toBe("Free");
  });

  it("pricing hint parsing: Paid", () => {
    const html = buildL2CategoryHtml({
      apps: [{ slug: "paid-app", name: "Paid App", pricingType: "SUBSCRIPTION" }],
    });
    const result = parseWixCategoryPage(html, "marketing--seo", 1, 0);
    expect(result.apps[0].pricingHint).toBe("Paid");
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
    expect(result.subcategoryLinks.length > 0).toBeTruthy();
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

    expect(result.apps.length).toBe(0);
    expect(result.appCount).toBe(0);
    expect(result.subcategoryLinks.length).toBe(3);
    expect(result.subcategoryLinks[0].slug).toBe("media--gallery");
    expect(result.subcategoryLinks[1].slug).toBe("media--music");
    expect(result.subcategoryLinks[2].slug).toBe("media--video");
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
    expect(result.title).toBe("Media & Content");
  });

  it("returns fallback when no data and no sidebar", () => {
    const html = buildWixHtml({ queries: [] });
    const result = parseWixCategoryPage(html, "unknown-cat", 1, 0);
    expect(result.apps.length).toBe(0);
    expect(result.subcategoryLinks.length).toBe(0);
    expect(result.slug).toBe("unknown-cat");
    expect(result.title).toBe("unknown-cat");
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
    expect(result.subcategoryLinks[0].url).toBe("https://www.wix.com/app-market/category/design-elements/maps--navigation",);
  });
});

// ── Compound slug handling ───────────────────────────────────────────────

describe("parseWixCategoryPage — compound slug handling", () => {
  it("converts -- to / in URL for compound slug", () => {
    const html = buildL2CategoryHtml({ parentSlug: "booking", childSlug: "events" });
    const result = parseWixCategoryPage(html, "booking--events", 1, 0);
    expect(result.url).toBe("https://www.wix.com/app-market/category/booking/events");
  });

  it("does not convert -- in slug for the result slug field", () => {
    const html = buildL2CategoryHtml({ parentSlug: "booking", childSlug: "events" });
    const result = parseWixCategoryPage(html, "booking--events", 1, 0);
    expect(result.slug).toBe("booking--events");
  });

  it("handles triple compound slug correctly (only first -- converted)", () => {
    const html = buildL2CategoryHtml({ childSlug: "shipping--delivery" });
    // The URL builder only replaces the first -- with /
    const result = parseWixCategoryPage(html, "ecommerce--shipping--delivery", 1, 0);
    expect(result.url).toBe("https://www.wix.com/app-market/category/ecommerce/shipping--delivery",);
  });
});
