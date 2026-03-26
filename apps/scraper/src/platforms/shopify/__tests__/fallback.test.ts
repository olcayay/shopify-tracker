import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShopifyModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("ShopifyModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: ShopifyModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new ShopifyModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>shopify app</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser</html>");

      const result = await mod.fetchAppPage("test-app");
      expect(result).toBe("<html>shopify app</html>");
      expect(httpClient.fetchPage).toHaveBeenCalledTimes(1);
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("HTTP 503"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser result</html>");

      const result = await mod.fetchAppPage("test-app");
      expect(result).toBe("<html>browser result</html>");
      expect(httpClient.fetchPage).toHaveBeenCalledTimes(1);
      expect(browserClient.fetchPage).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("primary failed"),
      );
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("HTTP 503"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("browser crash"));

      await expect(mod.fetchAppPage("test-app")).rejects.toThrow("HTTP 503");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>forced fallback</html>");

      const result = await mod.fetchAppPage("test-app");
      expect(result).toBe("<html>forced fallback</html>");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
      expect(browserClient.fetchPage).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>category</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser cat</html>");

      const result = await mod.fetchCategoryPage("finding-products");
      expect(result).toBe("<html>category</html>");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("timeout"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser cat</html>");

      const result = await mod.fetchCategoryPage("finding-products");
      expect(result).toBe("<html>browser cat</html>");
    });
  });

  describe("fetchSearchPage", () => {
    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>search results</html>");

      const result = await mod.fetchSearchPage("email marketing");
      expect(result).toBe("<html>search results</html>");
    });
  });
});
