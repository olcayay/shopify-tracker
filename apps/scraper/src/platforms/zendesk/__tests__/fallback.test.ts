import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZendeskModule } from "../index.js";
import { BrowserClient } from "../../../browser-client.js";

/**
 * Build a minimal Algolia response containing the given hits.
 */
function makeAlgoliaResponse(hits: Array<Record<string, any>>, nbHits = hits.length) {
  return JSON.stringify({
    results: [{
      hits,
      nbHits,
      page: 0,
      nbPages: 1,
      hitsPerPage: 24,
    }],
  });
}

describe("ZendeskModule fallback", () => {
  let browserClient: BrowserClient;
  let mod: ZendeskModule;

  // Keep a reference to the original global fetch
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    browserClient = new BrowserClient();
    mod = new ZendeskModule(undefined, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses browser primary when it succeeds", async () => {
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>zendesk app detail</html>");

      const result = await mod.fetchAppPage("972305--slack");
      expect(result).toBe("<html>zendesk app detail</html>");
    });

    it("falls back to Algolia search when browser fails", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("Cloudflare blocked"));

      // Mock the Algolia fetch (used internally)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(makeAlgoliaResponse([{
          id: 972305,
          name: "Slack",
          url: "/apps/support/972305/slack/",
          icon_url: "https://example.com/slack.png",
          short_description: "Slack integration",
          author_name: "Slack Technologies",
          rating: { average: 4.2, total_count: 150 },
          tile_display_price: "Free",
          products: ["support"],
        }])),
      } as any);

      const result = await mod.fetchAppPage("972305--slack");
      const envelope = JSON.parse(result);
      expect(envelope._fromAlgolia).toBe(true);
      expect(envelope._parsed.name).toBe("Slack");
      expect(envelope._parsed.slug).toBe("972305--slack");
    });

    it("parseAppDetails handles Algolia envelope transparently", async () => {
      const envelope = JSON.stringify({
        _fromAlgolia: true,
        _parsed: {
          name: "Slack",
          slug: "972305--slack",
          averageRating: 4.2,
          ratingCount: 150,
          pricingHint: "Free",
          iconUrl: "https://example.com/slack.png",
          developer: { name: "Slack Technologies" },
          badges: [],
          platformData: { source: "algolia" },
        },
      });
      const details = mod.parseAppDetails(envelope, "972305--slack");
      expect(details.name).toBe("Slack");
      expect(details.platformData.source).toBe("algolia");
    });

    it("parseAppDetails still works with regular HTML", () => {
      const html = '<html><body><h1>Slack</h1><script type="application/ld+json">{"@type":"SoftwareApplication","name":"Slack"}</script></body></html>';
      const details = mod.parseAppDetails(html, "972305--slack");
      expect(details.name).toBe("Slack");
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("Cloudflare"));
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(makeAlgoliaResponse([])),
      } as any);

      await expect(mod.fetchAppPage("999--nonexistent")).rejects.toThrow("Cloudflare");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>primary</html>");
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(makeAlgoliaResponse([{
          id: 972305,
          name: "Slack",
          url: "/apps/support/972305/slack/",
          icon_url: "",
          short_description: "",
          author_name: "",
          rating: { average: 4, total_count: 100 },
          tile_display_price: "Free",
          products: ["support"],
        }])),
      } as any);

      const result = await mod.fetchAppPage("972305--slack");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
      const envelope = JSON.parse(result);
      expect(envelope._fromAlgolia).toBe(true);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses Algolia primary when it succeeds", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(makeAlgoliaResponse([{ id: 1, name: "App1" }])),
      } as any);
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchCategoryPage("ai-and-bots");
      const data = JSON.parse(result);
      expect(data.results[0].hits).toHaveLength(1);
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when Algolia fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as any);
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><a href="/marketplace/apps/support/100/test-app/">Test App</a></body></html>',
      );

      const result = await mod.fetchCategoryPage("ai-and-bots");
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
      expect(parsed._parsed).toBeDefined();
    });

    it("parseCategoryPage handles HTML envelope", () => {
      const envelope = JSON.stringify({
        _fromHtml: true,
        _parsed: {
          slug: "ai-and-bots",
          url: "",
          title: "AI and Bots",
          description: "",
          appCount: 2,
          apps: [{ slug: "100--test", name: "Test", position: 1 }],
          subcategoryLinks: [],
          hasNextPage: false,
        },
      });
      const result = mod.parseCategoryPage(envelope, "?categories.name=AI+and+Bots");
      expect(result.slug).toBe("ai-and-bots");
      expect(result.apps).toHaveLength(1);
    });
  });

  describe("fetchSearchPage", () => {
    it("uses Algolia primary when it succeeds", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(makeAlgoliaResponse([{ id: 1, name: "Result" }])),
      } as any);

      const result = await mod.fetchSearchPage("automation");
      const data = JSON.parse(result!);
      expect(data.results[0].hits).toHaveLength(1);
    });

    it("falls back to browser when Algolia fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as any);
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><a href="/marketplace/apps/support/200/slack/">Slack</a></body></html>',
      );

      const result = await mod.fetchSearchPage("automation");
      const parsed = JSON.parse(result!);
      expect(parsed._fromHtml).toBe(true);
    });

    it("parseSearchPage handles HTML envelope", () => {
      const envelope = JSON.stringify({
        _fromHtml: true,
        _parsed: {
          keyword: "automation",
          page: 1,
          apps: [{ slug: "200--slack", name: "Slack", position: 1 }],
          totalCount: 1,
          hasNextPage: false,
        },
      });
      const result = mod.parseSearchPage(envelope, "automation", 1);
      expect(result.keyword).toBe("automation");
      expect(result.apps).toHaveLength(1);
    });
  });
});
