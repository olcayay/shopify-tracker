import { describe, it, expect } from "vitest";
import { parseHubSpotFeaturedSections } from "../featured-parser.js";
import { makeFeaturedPageHtml } from "./fixtures.js";

describe("parseHubSpotFeaturedSections", () => {
  it("parses featured sections from homepage", () => {
    const html = makeFeaturedPageHtml();
    const result = parseHubSpotFeaturedSections(html);

    expect(result).toHaveLength(2);
  });

  it("parses section titles and handles", () => {
    const html = makeFeaturedPageHtml();
    const result = parseHubSpotFeaturedSections(html);

    expect(result[0].sectionTitle).toBe("Top Rated Apps");
    expect(result[0].sectionHandle).toBe("top-rated-apps");
    expect(result[1].sectionTitle).toBe("New & Noteworthy");
    expect(result[1].sectionHandle).toBe("new-noteworthy");
  });

  it("parses apps within each section", () => {
    const html = makeFeaturedPageHtml();
    const result = parseHubSpotFeaturedSections(html);

    expect(result[0].apps).toHaveLength(2);
    expect(result[0].apps[0]).toMatchObject({
      slug: "mailchimp",
      name: "Mailchimp",
      iconUrl: "https://cdn.hubspot.com/mc.png",
      position: 1,
    });
    expect(result[0].apps[1]).toMatchObject({
      slug: "zapier",
      name: "Zapier",
      position: 2,
    });

    expect(result[1].apps).toHaveLength(3);
    expect(result[1].apps[0].slug).toBe("drift");
    expect(result[1].apps[2].slug).toBe("databox");
  });

  it("sets correct surface metadata", () => {
    const html = makeFeaturedPageHtml();
    const result = parseHubSpotFeaturedSections(html);

    for (const section of result) {
      expect(section.surface).toBe("homepage");
      expect(section.surfaceDetail).toBe("hubspot-marketplace-homepage");
    }
  });

  it("assigns sequential positions within each section", () => {
    const html = makeFeaturedPageHtml();
    const result = parseHubSpotFeaturedSections(html);

    expect(result[1].apps.map((a) => a.position)).toEqual([1, 2, 3]);
  });

  it("skips category/browse/filter headings", () => {
    const html = makeFeaturedPageHtml({
      sections: [
        { title: "Browse Categories", apps: [{ slug: "should-skip", name: "Skip" }] },
        { title: "Filter by Type", apps: [{ slug: "also-skip", name: "Skip" }] },
        { title: "Popular Integrations", apps: [{ slug: "real-app", name: "Real" }] },
      ],
    });
    const result = parseHubSpotFeaturedSections(html);

    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Popular Integrations");
  });

  it("skips sections with no apps", () => {
    const html = `<html><body>
      <h2>Empty Section</h2>
      <div class="grid"></div>
      <h2>Has Apps</h2>
      <div class="grid">
        <div class="card"><a href="/marketplace/listing/real"><h4 class="title">Real App</h4></a></div>
      </div>
    </body></html>`;
    const result = parseHubSpotFeaturedSections(html);

    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Has Apps");
  });

  it("deduplicates apps within a section", () => {
    const html = `<html><body>
      <h2>Duplicated</h2>
      <div class="grid">
        <div class="card"><a href="/marketplace/listing/dup"><h4 class="title">App</h4></a></div>
        <div class="card"><a href="/marketplace/listing/dup"><h4 class="title">App</h4></a></div>
        <div class="card"><a href="/marketplace/listing/other"><h4 class="title">Other</h4></a></div>
      </div>
    </body></html>`;
    const result = parseHubSpotFeaturedSections(html);

    expect(result[0].apps).toHaveLength(2);
    expect(result[0].apps[0].slug).toBe("dup");
    expect(result[0].apps[1].slug).toBe("other");
  });

  it("uses slug-derived name when title element not found", () => {
    const html = `<html><body>
      <h2>Section</h2>
      <div class="grid">
        <div class="card"><a href="/marketplace/listing/my-cool-app"></a></div>
      </div>
    </body></html>`;
    const result = parseHubSpotFeaturedSections(html);

    expect(result[0].apps[0].name).toBe("my cool app");
  });

  it("handles empty page", () => {
    const html = "<html><body></body></html>";
    const result = parseHubSpotFeaturedSections(html);

    expect(result).toEqual([]);
  });

  it("handles h3 headings as section titles", () => {
    const html = `<html><body>
      <h3>Editor's Picks</h3>
      <div class="list">
        <div class="card"><a href="/marketplace/listing/picked"><h4 class="title">Picked</h4></a></div>
      </div>
    </body></html>`;
    const result = parseHubSpotFeaturedSections(html);

    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Editor's Picks");
  });
});
