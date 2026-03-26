import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZohoModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("ZohoModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: ZohoModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new ZohoModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>zoho app detail</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser</html>");

      const result = await mod.fetchAppPage("desk--360-sms");
      expect(result).toBe("<html>zoho app detail</html>");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("HTTP 403"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser app</html>");

      const result = await mod.fetchAppPage("desk--360-sms");
      expect(result).toBe("<html>browser app</html>");
      expect(browserClient.fetchPage).toHaveBeenCalledTimes(1);
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("HTTP fail"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("browser fail"));

      await expect(mod.fetchAppPage("desk--360-sms")).rejects.toThrow("HTTP fail");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>forced</html>");

      const result = await mod.fetchAppPage("desk--360-sms");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
      expect(result).toBe("<html>forced</html>");
    });
  });

  describe("fetchCategoryPage", () => {
    // Zoho categories: browser primary → HTTP fallback (reversed)
    it("uses browser primary when it succeeds", async () => {
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>category SPA</html>");
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http cat</html>");

      const result = await mod.fetchCategoryPage("desk");
      expect(result).toBe("<html>category SPA</html>");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to HTTP when browser fails", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("browser error"));
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http category</html>");

      const result = await mod.fetchCategoryPage("desk");
      expect(result).toBe("<html>http category</html>");
    });
  });

  describe("fetchSearchPage", () => {
    // Zoho search: browser primary → HTTP fallback (reversed)
    it("uses browser primary when it succeeds", async () => {
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>search SPA</html>");
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http search</html>");

      const result = await mod.fetchSearchPage("inventory");
      expect(result).toBe("<html>search SPA</html>");
    });

    it("falls back to HTTP when browser fails", async () => {
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("timeout"));
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http search</html>");

      const result = await mod.fetchSearchPage("inventory");
      expect(result).toBe("<html>http search</html>");
    });
  });
});
