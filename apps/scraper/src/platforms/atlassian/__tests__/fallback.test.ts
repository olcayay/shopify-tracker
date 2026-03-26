import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AtlassianModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("AtlassianModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: AtlassianModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new AtlassianModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    const addonJson = JSON.stringify({
      key: "com.test.addon",
      name: "Test Addon",
      _embedded: { vendor: { _links: { self: { href: "/vendors/123" } } } },
    });

    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage")
        .mockResolvedValueOnce(addonJson) // addon
        .mockResolvedValueOnce('{"buildNumber": 1}') // version
        .mockResolvedValueOnce('{"name": "Test Vendor"}') // vendor
        .mockResolvedValueOnce('{}'); // pricing
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser</html>");

      const result = await mod.fetchAppPage("com.test.addon");
      const envelope = JSON.parse(result);
      expect(envelope.addon.key).toBe("com.test.addon");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser HTML when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API deprecated"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Test Addon</h1><div class="rating">4.5 / 5</div></body></html>',
      );

      const result = await mod.fetchAppPage("com.test.addon");
      const envelope = JSON.parse(result);
      expect(envelope._fromHtml).toBe(true);
      expect(envelope._parsed).toBeDefined();
      expect(envelope._parsed.name).toBeDefined();
    });

    it("parseAppDetails handles HTML envelope transparently", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API gone"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Test Addon</h1></body></html>',
      );

      const json = await mod.fetchAppPage("com.test.addon");
      const details = mod.parseAppDetails(json, "com.test.addon");
      expect(details.name).toBeDefined();
      expect(details.slug).toBeDefined();
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API deprecated"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("Cloudflare"));

      await expect(mod.fetchAppPage("com.test.addon")).rejects.toThrow("API deprecated");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue(addonJson);
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1>Forced Fallback</h1></body></html>',
      );

      const result = await mod.fetchAppPage("com.test.addon");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
      const envelope = JSON.parse(result);
      expect(envelope._fromHtml).toBe(true);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>category HTML</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser cat</html>");

      const result = await mod.fetchCategoryPage("admin-tools");
      expect(result).toBe("<html>category HTML</html>");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser cat</html>");

      const result = await mod.fetchCategoryPage("admin-tools");
      expect(result).toBe("<html>browser cat</html>");
    });
  });

  describe("fetchSearchPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"_embedded":{"addons":[]}}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>search</html>");

      const result = await mod.fetchSearchPage("time tracking");
      expect(JSON.parse(result!)._embedded).toBeDefined();
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser HTML when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API gone"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><a href="/apps/123/test-addon">Test</a></body></html>',
      );

      const result = await mod.fetchSearchPage("time tracking");
      const parsed = JSON.parse(result!);
      expect(parsed._fromHtml).toBe(true);
      expect(parsed._parsed).toBeDefined();
    });
  });

  describe("fetchReviewPage", () => {
    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API error"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>app page with reviews</html>");

      const result = await mod.fetchReviewPage("com.test.addon");
      // Fallback returns app page HTML (reviews embedded)
      expect(result).toBeDefined();
    });
  });
});
