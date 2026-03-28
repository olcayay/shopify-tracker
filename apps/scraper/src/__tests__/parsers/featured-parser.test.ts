import { describe, it, expect } from "vitest";
import { parseFeaturedSections } from "../../parsers/featured-parser.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapHtml(body: string): string {
  return `<html><head></head><body>${body}</body></html>`;
}

function waypointSection(opts: {
  handle: string;
  surface: string;
  surfaceDetail?: string;
  title?: string;
  cards?: { slug: string; name: string; iconUrl?: string; position?: number }[];
}): string {
  const cards = (opts.cards ?? [])
    .map(
      (c) => `
      <div data-controller="app-card"
           data-app-card-handle-value="${c.slug}"
           data-app-card-name-value="${c.name}"
           data-app-card-icon-url-value="${c.iconUrl ?? ""}"
           ${c.position != null ? `data-app-card-intra-position-value="${c.position}"` : ""}>
      </div>`
    )
    .join("\n");

  const titleTag = opts.title ? `<h2>${opts.title}</h2>` : "";

  return `
    <div data-monorail-waypoint="AppStoreSurfaceWaypoint"
         data-waypoint-app-grouping-handle="${opts.handle}"
         data-waypoint-surface="${opts.surface}"
         data-waypoint-surface-detail="${opts.surfaceDetail ?? ""}">
      ${titleTag}
      ${cards}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// parseFeaturedSections
// ---------------------------------------------------------------------------

describe("parseFeaturedSections", () => {
  it("returns empty array for HTML without waypoint elements", () => {
    const html = wrapHtml("<p>No featured sections here</p>");
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("parses sections with sectionHandle, surface, surfaceDetail", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "trending-apps",
        surface: "home",
        surfaceDetail: "trending",
        title: "Trending This Week",
        cards: [{ slug: "app-1", name: "App One", position: 1 }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result).toHaveLength(1);
    expect(result[0].sectionHandle).toBe("trending-apps");
    expect(result[0].surface).toBe("home");
    expect(result[0].surfaceDetail).toBe("trending");
  });

  it("extracts section title from inner h2", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "staff-picks",
        surface: "home",
        title: "Staff Picks",
        cards: [{ slug: "app-1", name: "App One" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result[0].sectionTitle).toBe("Staff Picks");
  });

  it("falls back to handle when no h2 title", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "no-title-section",
        surface: "category",
        cards: [{ slug: "app-1", name: "App One" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result[0].sectionTitle).toBe("no-title-section");
  });

  it("extracts app cards with slug, name, iconUrl, position", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "top-rated",
        surface: "home",
        title: "Top Rated",
        cards: [
          { slug: "app-a", name: "App A", iconUrl: "https://cdn.shopify.com/a.png", position: 1 },
          { slug: "app-b", name: "App B", iconUrl: "https://cdn.shopify.com/b.png", position: 2 },
        ],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result[0].apps).toHaveLength(2);
    expect(result[0].apps[0]).toEqual({
      slug: "app-a",
      name: "App A",
      iconUrl: "https://cdn.shopify.com/a.png",
      position: 1,
    });
    expect(result[0].apps[1]).toEqual({
      slug: "app-b",
      name: "App B",
      iconUrl: "https://cdn.shopify.com/b.png",
      position: 2,
    });
  });

  it("sets position to null when not provided", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "featured",
        surface: "home",
        title: "Featured",
        cards: [{ slug: "no-pos", name: "No Position" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result[0].apps[0].position).toBeNull();
  });

  it("excludes sections with excluded handles (shopify-apps)", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "shopify-apps",
        surface: "home",
        title: "Made by Shopify",
        cards: [{ slug: "shopify-inbox", name: "Shopify Inbox" }],
      }) +
      waypointSection({
        handle: "real-section",
        surface: "home",
        title: "Real Section",
        cards: [{ slug: "real-app", name: "Real App" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result).toHaveLength(1);
    expect(result[0].sectionHandle).toBe("real-section");
  });

  it("excludes TestimonialComponent handle", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "TestimonialComponent",
        surface: "home",
        cards: [{ slug: "testimonial-app", name: "Testimonial App" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("excludes story-page-crosslink handle", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "story-page-crosslink",
        surface: "home",
        cards: [{ slug: "story-app", name: "Story App" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("excludes 'home' and 'category' handles", () => {
    const homeHtml = waypointSection({
      handle: "home",
      surface: "home",
      cards: [{ slug: "home-app", name: "Home App" }],
    });
    const categoryHtml = waypointSection({
      handle: "category",
      surface: "category",
      cards: [{ slug: "cat-app", name: "Category App" }],
    });
    const html = wrapHtml(homeHtml + categoryHtml);
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("deduplicates sections by surface:surfaceDetail:handle key", () => {
    const section = waypointSection({
      handle: "trending",
      surface: "home",
      surfaceDetail: "main",
      title: "Trending",
      cards: [{ slug: "app-1", name: "App One", position: 1 }],
    });
    // Same key repeated
    const html = wrapHtml(section + section);
    const result = parseFeaturedSections(html);
    // Should have 1 section (deduplicated)
    expect(result).toHaveLength(1);
  });

  it("appends apps when duplicate section found", () => {
    const section1 = `
      <div data-monorail-waypoint="AppStoreSurfaceWaypoint"
           data-waypoint-app-grouping-handle="trending"
           data-waypoint-surface="home"
           data-waypoint-surface-detail="main">
        <h2>Trending</h2>
        <div data-controller="app-card"
             data-app-card-handle-value="app-1"
             data-app-card-name-value="App One"
             data-app-card-icon-url-value=""
             data-app-card-intra-position-value="1">
        </div>
      </div>
    `;
    const section2 = `
      <div data-monorail-waypoint="AppStoreSurfaceWaypoint"
           data-waypoint-app-grouping-handle="trending"
           data-waypoint-surface="home"
           data-waypoint-surface-detail="main">
        <div data-controller="app-card"
             data-app-card-handle-value="app-2"
             data-app-card-name-value="App Two"
             data-app-card-icon-url-value=""
             data-app-card-intra-position-value="2">
        </div>
      </div>
    `;
    const html = wrapHtml(section1 + section2);
    const result = parseFeaturedSections(html);
    expect(result).toHaveLength(1);
    expect(result[0].apps).toHaveLength(2);
    expect(result[0].apps[0].slug).toBe("app-1");
    expect(result[0].apps[1].slug).toBe("app-2");
  });

  it("skips waypoint sections with no app cards", () => {
    const html = wrapHtml(`
      <div data-monorail-waypoint="AppStoreSurfaceWaypoint"
           data-waypoint-app-grouping-handle="empty-section"
           data-waypoint-surface="home"
           data-waypoint-surface-detail="">
        <h2>Empty Section</h2>
        <p>No cards here</p>
      </div>
    `);
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("skips waypoint elements without handle or surface", () => {
    const html = wrapHtml(`
      <div data-monorail-waypoint="AppStoreSurfaceWaypoint"
           data-waypoint-surface="home">
        <div data-controller="app-card"
             data-app-card-handle-value="app"
             data-app-card-name-value="App"
             data-app-card-icon-url-value="">
        </div>
      </div>
    `);
    const result = parseFeaturedSections(html);
    expect(result).toEqual([]);
  });

  it("parses multiple distinct sections", () => {
    const html = wrapHtml(
      waypointSection({
        handle: "trending",
        surface: "home",
        surfaceDetail: "trending",
        title: "Trending",
        cards: [{ slug: "t-1", name: "Trending 1" }],
      }) +
      waypointSection({
        handle: "new-arrivals",
        surface: "home",
        surfaceDetail: "new",
        title: "New Arrivals",
        cards: [{ slug: "n-1", name: "New 1" }],
      })
    );
    const result = parseFeaturedSections(html);
    expect(result).toHaveLength(2);
    expect(result[0].sectionHandle).toBe("trending");
    expect(result[1].sectionHandle).toBe("new-arrivals");
  });
});
