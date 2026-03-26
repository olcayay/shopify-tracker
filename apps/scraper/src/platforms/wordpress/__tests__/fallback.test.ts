import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WordPressModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("WordPressModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: WordPressModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new WordPressModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"name":"Contact Form 7","slug":"contact-form-7"}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser</html>");

      const result = await mod.fetchAppPage("contact-form-7");
      expect(JSON.parse(result).name).toBe("Contact Form 7");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser HTML parser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1 class="plugin-title">Contact Form 7</h1></body></html>',
      );

      const result = await mod.fetchAppPage("contact-form-7");
      const parsed = JSON.parse(result);
      // Should be an envelope with _fromHtml and _parsed
      expect(parsed._fromHtml).toBe(true);
      expect(parsed._parsed).toBeDefined();
      expect(parsed._parsed.name).toBe("Contact Form 7");
    });

    it("parseAppDetails handles HTML envelope transparently", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1 class="plugin-title">Contact Form 7</h1></body></html>',
      );

      const json = await mod.fetchAppPage("contact-form-7");
      const details = mod.parseAppDetails(json, "contact-form-7");
      expect(details.name).toBe("Contact Form 7");
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API down"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("browser crash"));

      await expect(mod.fetchAppPage("contact-form-7")).rejects.toThrow("API down");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"name":"CF7"}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><h1 class="plugin-title">CF7 Fallback</h1></body></html>',
      );

      const result = await mod.fetchAppPage("contact-form-7");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses API primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue('{"info":{"results":5},"plugins":[]}');
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html></html>");

      const result = await mod.fetchCategoryPage("contact-form");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
      expect(JSON.parse(result).info.results).toBe(5);
    });

    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("API error"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><div class="plugin-card"><h3><a href="/plugins/cf7/">CF7</a></h3></div></body></html>',
      );

      const result = await mod.fetchCategoryPage("contact-form");
      const parsed = JSON.parse(result);
      expect(parsed._fromHtml).toBe(true);
      expect(parsed._parsed).toBeDefined();
    });
  });

  describe("fetchSearchPage", () => {
    it("falls back to browser when API fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("timeout"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue(
        '<html><body><div class="plugin-card"><h3><a href="/plugins/cf7/">CF7</a></h3></div></body></html>',
      );

      const result = await mod.fetchSearchPage("contact form");
      const parsed = JSON.parse(result!);
      expect(parsed._fromHtml).toBe(true);
    });
  });

  describe("fetchReviewPage", () => {
    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>reviews page</html>");

      const result = await mod.fetchReviewPage("contact-form-7");
      expect(result).toBe("<html>reviews page</html>");
    });
  });
});
