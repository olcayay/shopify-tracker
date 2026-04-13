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
    it("uses HTTP detail primary when it succeeds (PLA-1056)", async () => {
      // HTTP primary returns a listing JSON; parser wraps it in _fromJsonApi envelope.
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(JSON.stringify({
        id: "listing-uuid",
        appExchangeId: "a0N4V00000JTeWyUAL",
        name: "HTTP App",
        publisher: { name: "P" },
        pricing: {},
        reviewsSummary: { averageRating: 4.2, totalReviewCount: 10 },
      }));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>should not be used</html>");

      const result = await mod.fetchAppPage("a0N4V00000JTeWyUAL");
      const envelope = JSON.parse(result);
      expect(envelope._fromJsonApi).toBe(true);
      expect(envelope._parsed.name).toBe("HTTP App");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to search API when HTTP and browser both fail", async () => {
      const http = vi.spyOn(httpClient, "fetchPage");
      // partners/experience fails, then search-api succeeds.
      http.mockImplementation(async (url: string) => {
        if (url.includes("partners/experience")) throw new Error("partners down");
        return JSON.stringify({
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
        });
      });
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("SPA timeout"));

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

    it("throws primary (HTTP) error when all attempts fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("SPA broken"));

      await expect(mod.fetchAppPage("a0N4V00000JTeWyUAL")).rejects.toThrow("API down");
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
