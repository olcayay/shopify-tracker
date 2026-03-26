import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZoomModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("ZoomModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: ZoomModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new ZoomModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(
        JSON.stringify({ apps: [{ id: "target-id", name: "Target" }] }),
      );
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchAppPage("target-id");
      expect(JSON.parse(result).id).toBe("target-id");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when API fails (app not found)", async () => {
      // Return fewer than 100 apps, none matching — triggers "not found" error in primary
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(
        JSON.stringify({ apps: [{ id: "other", name: "Other" }] }),
      );
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Target App</h1></body></html>',
      );

      const result = await mod.fetchAppPage("target-id");
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
      expect(parsed._parsed.name).toBeDefined();
    });

    it("falls back to browser when API throws", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Zoom App</h1></body></html>',
      );

      const result = await mod.fetchAppPage("test-id");
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
    });

    it("parseAppDetails handles HTML envelope transparently", async () => {
      const envelope = JSON.stringify({
        _fromHtml: true,
        _parsed: { name: "Test App", slug: "test-id", averageRating: 4.5, ratingCount: 10, pricingHint: null, iconUrl: null, developer: null, badges: [], platformData: {} },
      });
      const details = mod.parseAppDetails(envelope, "test-id");
      expect(details.name).toBe("Test App");
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("browser fail"));

      await expect(mod.fetchAppPage("test-id")).rejects.toThrow("API down");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(
        JSON.stringify({ apps: [{ id: "test-id", name: "Primary" }] }),
      );
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Fallback App</h1></body></html>',
      );

      const result = await mod.fetchAppPage("test-id");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"apps":[{"id":"a1"}],"total":1}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchCategoryPage("crm");
      expect(JSON.parse(result).apps).toHaveLength(1);
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><a href="/apps/test-app">Test</a></body></html>',
      );

      const result = await mod.fetchCategoryPage("crm");
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
    });
  });

  describe("fetchSearchPage", () => {
    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("error"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><a href="/apps/zoom-app">Zoom App</a></body></html>',
      );

      const result = await mod.fetchSearchPage("calendar");
      const parsed = JSON.parse(result!);
      expect(parsed._fromHtml).toBe(true);
    });
  });
});
