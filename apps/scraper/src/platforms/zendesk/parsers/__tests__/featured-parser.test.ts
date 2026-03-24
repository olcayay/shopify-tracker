import { describe, it, expect } from "vitest";
import { parseZendeskFeaturedSections } from "../featured-parser.js";

/** Build HTML with featured sections containing headings and app cards. */
function makeFeaturedHtml(sections: Array<{
  title: string;
  apps: Array<{ id: string; slug: string; product: string; name: string; icon?: string }>;
}> = []): string {
  const sectionHtml = sections.map((s) => {
    const appCards = s.apps.map((app) => `
      <li class="app-card">
        <a href="/marketplace/apps/${app.product}/${app.id}/${app.slug}/">
          <img src="${app.icon ?? "https://cdn.example.com/icon.png"}" />
          <h4 class="app-title">${app.name}</h4>
        </a>
      </li>
    `).join("");

    return `
      <h2>${s.title}</h2>
      <ul class="app-grid">
        ${appCards}
      </ul>
    `;
  }).join("");

  return `<html><body>${sectionHtml}</body></html>`;
}

describe("parseZendeskFeaturedSections", () => {
  it("should parse featured sections with heading and app cards", () => {
    const html = makeFeaturedHtml([
      {
        title: "Most Popular",
        apps: [
          { id: "972305", slug: "slack", product: "support", name: "Slack" },
          { id: "849231", slug: "stylo-assist", product: "support", name: "Stylo Assist" },
        ],
      },
      {
        title: "New & Noteworthy",
        apps: [
          { id: "111111", slug: "new-app", product: "support", name: "New App" },
        ],
      },
    ]);

    const result = parseZendeskFeaturedSections(html);

    expect(result).toHaveLength(2);
    expect(result[0].sectionTitle).toBe("Most Popular");
    expect(result[0].sectionHandle).toBe("most-popular");
    expect(result[0].surface).toBe("homepage");
    expect(result[0].surfaceDetail).toBe("zendesk-marketplace-homepage");
    expect(result[0].apps).toHaveLength(2);

    expect(result[1].sectionTitle).toBe("New & Noteworthy");
    expect(result[1].sectionHandle).toBe("new-noteworthy");
    expect(result[1].apps).toHaveLength(1);
  });

  it("should parse app details within sections", () => {
    const html = makeFeaturedHtml([
      {
        title: "Staff Picks",
        apps: [
          { id: "972305", slug: "slack", product: "support", name: "Slack", icon: "https://cdn.example.com/slack.png" },
        ],
      },
    ]);

    const result = parseZendeskFeaturedSections(html);
    const app = result[0].apps[0];

    expect(app.slug).toBe("972305--slack");
    expect(app.name).toBe("Slack");
    expect(app.iconUrl).toBe("https://cdn.example.com/slack.png");
    expect(app.position).toBe(1);
  });

  it("should assign sequential positions within each section", () => {
    const html = makeFeaturedHtml([
      {
        title: "Top Apps",
        apps: [
          { id: "1", slug: "first", product: "support", name: "First" },
          { id: "2", slug: "second", product: "support", name: "Second" },
          { id: "3", slug: "third", product: "support", name: "Third" },
        ],
      },
    ]);

    const result = parseZendeskFeaturedSections(html);
    expect(result[0].apps[0].position).toBe(1);
    expect(result[0].apps[1].position).toBe(2);
    expect(result[0].apps[2].position).toBe(3);
  });

  it("should deduplicate apps within a section", () => {
    // Same app linked twice in the same section
    const html = `<html><body>
      <h2>Popular</h2>
      <ul class="app-grid">
        <li class="app-card">
          <a href="/marketplace/apps/support/100/test-app/"><h4 class="title">Test App</h4></a>
        </li>
        <li class="app-card">
          <a href="/marketplace/apps/support/100/test-app/"><h4 class="title">Test App</h4></a>
        </li>
      </ul>
    </body></html>`;

    const result = parseZendeskFeaturedSections(html);
    expect(result[0].apps).toHaveLength(1);
  });

  it("should skip headings with no app cards in their sibling container", () => {
    const html = `<html><body>
      <h2>Empty Section</h2>
      <ul class="app-grid"></ul>
      <h2>Has Apps</h2>
      <ul class="app-grid">
        <li class="app-card">
          <a href="/marketplace/apps/support/100/test/"><h4 class="title">Test</h4></a>
        </li>
      </ul>
    </body></html>`;

    const result = parseZendeskFeaturedSections(html);
    // Only "Has Apps" section should appear, "Empty Section" has no matching app links
    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Has Apps");
  });

  it("should skip category and filter headings", () => {
    const html = `<html><body>
      <h2>Browse by Category</h2>
      <ul class="app-grid">
        <li><a href="/marketplace/apps/support/100/test/"><h4>Test</h4></a></li>
      </ul>
      <h2>Filter Results</h2>
      <ul class="app-grid">
        <li><a href="/marketplace/apps/support/200/test2/"><h4>Test2</h4></a></li>
      </ul>
    </body></html>`;

    const result = parseZendeskFeaturedSections(html);
    expect(result).toHaveLength(0);
  });

  it("should handle empty HTML", () => {
    const result = parseZendeskFeaturedSections("<html><body></body></html>");
    expect(result).toHaveLength(0);
  });

  it("should generate sectionHandle from title by lowercasing and replacing non-alphanumeric chars", () => {
    const html = makeFeaturedHtml([
      {
        title: "AI & Machine Learning Apps!",
        apps: [{ id: "1", slug: "ai-app", product: "support", name: "AI App" }],
      },
    ]);

    const result = parseZendeskFeaturedSections(html);
    expect(result[0].sectionHandle).toBe("ai-machine-learning-apps");
  });

  it("should use text-slug as fallback name when no title element found in card", () => {
    const html = `<html><body>
      <h2>Top</h2>
      <ul class="app-grid">
        <li>
          <a href="/marketplace/apps/support/100/my-cool-app/">
            <img src="https://cdn.example.com/icon.png" />
          </a>
        </li>
      </ul>
    </body></html>`;

    const result = parseZendeskFeaturedSections(html);
    // Name fallback: textSlug.replace(/-/g, " ")
    expect(result[0].apps[0].name).toBe("my cool app");
  });
});
