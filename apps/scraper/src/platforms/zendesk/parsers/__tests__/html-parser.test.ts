import { describe, it, expect } from "vitest";
import { parseCategoryHtml, parseSearchHtml } from "../html-parser.js";

function buildMarketplaceHtml(apps: Array<{ id: number; slug: string; name: string; product?: string }>) {
  const cards = apps.map((app) => `
    <article class="app-card">
      <a href="/marketplace/apps/${app.product || "support"}/${app.id}/${app.slug}/">
        <img src="https://cdn.example.com/${app.slug}.png" />
        <h3 class="appName">${app.name}</h3>
        <p class="description">Short description for ${app.name}</p>
        <div class="rating">4.5 (42)</div>
        <span class="pricing">Free</span>
      </a>
    </article>
  `).join("\n");

  return `<html><body><div class="app-list">${cards}</div></body></html>`;
}

describe("parseCategoryHtml", () => {
  it("extracts apps from marketplace HTML", () => {
    const html = buildMarketplaceHtml([
      { id: 100, slug: "slack", name: "Slack" },
      { id: 200, slug: "zendesk-chat", name: "Zendesk Chat" },
    ]);

    const result = parseCategoryHtml(html, "ai-and-bots");

    expect(result.slug).toBe("ai-and-bots");
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].slug).toBe("100--slack");
    expect(result.apps[0].name).toBe("Slack");
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].slug).toBe("200--zendesk-chat");
    expect(result.apps[1].position).toBe(2);
  });

  it("extracts logo URL from img element", () => {
    const html = buildMarketplaceHtml([{ id: 100, slug: "test", name: "Test" }]);
    const result = parseCategoryHtml(html, "test-cat");
    expect(result.apps[0].logoUrl).toBe("https://cdn.example.com/test.png");
  });

  it("deduplicates apps by slug", () => {
    const html = `<html><body>
      <a href="/marketplace/apps/support/100/slack/"><h3>Slack</h3></a>
      <a href="/marketplace/apps/support/100/slack/"><h3>Slack Again</h3></a>
    </body></html>`;

    const result = parseCategoryHtml(html, "test-cat");
    expect(result.apps).toHaveLength(1);
  });

  it("returns empty apps for page with no app links", () => {
    const result = parseCategoryHtml("<html><body>No apps here</body></html>", "empty-cat");
    expect(result.apps).toEqual([]);
    expect(result.appCount).toBeNull();
  });

  it("preserves product type in externalId", () => {
    const html = buildMarketplaceHtml([
      { id: 100, slug: "slack", name: "Slack", product: "sell" },
    ]);
    const result = parseCategoryHtml(html, "test-cat");
    expect(result.apps[0].externalId).toBe("sell");
  });

  it("sets hasNextPage to false (can't determine from HTML)", () => {
    const html = buildMarketplaceHtml([{ id: 1, slug: "test", name: "T" }]);
    const result = parseCategoryHtml(html, "test-cat");
    expect(result.hasNextPage).toBe(false);
  });
});

describe("parseSearchHtml", () => {
  it("extracts search results from marketplace HTML", () => {
    const html = buildMarketplaceHtml([
      { id: 100, slug: "slack", name: "Slack" },
      { id: 200, slug: "teams", name: "Teams" },
    ]);

    const result = parseSearchHtml(html, "collaboration", 1);

    expect(result.keyword).toBe("collaboration");
    expect(result.page).toBe(1);
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].slug).toBe("100--slack");
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
  });

  it("returns empty results for no matches", () => {
    const result = parseSearchHtml("<html><body>No results</body></html>", "nonexistent", 1);
    expect(result.apps).toEqual([]);
    expect(result.totalCount).toBeNull();
  });
});
