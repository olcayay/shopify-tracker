import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SalesforceModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("SalesforceModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: SalesforceModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new SalesforceModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses browser primary when it succeeds", async () => {
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>salesforce SPA</html>");
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"items":[]}');

      const result = await mod.fetchAppPage("a0N4V00000JTeWyUAL");
      expect(result).toBe("<html>salesforce SPA</html>");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to search API when browser fails", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("SPA timeout"));
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(JSON.stringify({
        items: [{
          oafId: "a0N4V00000JTeWyUAL",
          title: "Test App",
          publisher: "Test Publisher",
          averageRating: 4.5,
          reviewsAmount: 100,
          pricing: "Free",
          description: "A test app",
          listingCategories: ["sales"],
          logos: [{ mediaId: "https://example.com/logo.png", logoType: "Logo" }],
        }],
      }));

      const result = await mod.fetchAppPage("a0N4V00000JTeWyUAL");
      const envelope = JSON.parse(result);
      expect(envelope._fromSearch).toBe(true);
      expect(envelope._parsed.name).toBe("Test App");
      expect(envelope._parsed.slug).toBe("a0N4V00000JTeWyUAL");
    });

    it("parseAppDetails handles search API envelope transparently", async () => {
      const envelope = JSON.stringify({
        _fromSearch: true,
        _parsed: {
          name: "Test App",
          slug: "a0N4V00000JTeWyUAL",
          averageRating: 4.5,
          ratingCount: 100,
          pricingHint: "Free",
          iconUrl: "https://example.com/logo.png",
          developer: { name: "Test Publisher" },
          badges: [],
          platformData: { source: "search-api" },
        },
      });
      const details = mod.parseAppDetails(envelope, "a0N4V00000JTeWyUAL");
      expect(details.name).toBe("Test App");
      expect(details.platformData.source).toBe("search-api");
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("SPA broken"));
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));

      await expect(mod.fetchAppPage("a0N4V00000JTeWyUAL")).rejects.toThrow("SPA broken");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>primary</html>");
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(JSON.stringify({
        items: [{
          oafId: "test-id",
          title: "Forced Fallback App",
          publisher: "Publisher",
          averageRating: 3.0,
          reviewsAmount: 5,
          logos: [],
        }],
      }));

      const result = await mod.fetchAppPage("test-id");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
      const envelope = JSON.parse(result);
      expect(envelope._fromSearch).toBe(true);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"items":[{"oafId":"a1"}]}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchCategoryPage("sales");
      expect(JSON.parse(result).items).toHaveLength(1);
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>category page</html>");

      const result = await mod.fetchCategoryPage("sales");
      expect(result).toBe("<html>category page</html>");
    });
  });

  describe("fetchSearchPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"items":[{"oafId":"a1"}]}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchSearchPage("document");
      expect(JSON.parse(result!).items).toHaveLength(1);
    });

    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("timeout"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>search results</html>");

      const result = await mod.fetchSearchPage("document");
      expect(result).toBe("<html>search results</html>");
    });
  });

  describe("fetchReviewPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"reviews":[]}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchReviewPage("test-id");
      expect(JSON.parse(result!).reviews).toBeDefined();
    });

    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API gone"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>app with reviews</html>");

      const result = await mod.fetchReviewPage("test-id");
      expect(result).toBe("<html>app with reviews</html>");
    });
  });
});
