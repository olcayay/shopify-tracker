import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WixModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("WixModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: WixModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new WixModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>wix app</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser</html>");

      const result = await mod.fetchAppPage("wix-forms");
      expect(result).toBe("<html>wix app</html>");
      expect(browserClient.fetchPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("rate limited"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>browser result</html>");

      const result = await mod.fetchAppPage("wix-forms");
      expect(result).toBe("<html>browser result</html>");
      expect(httpClient.fetchPage).toHaveBeenCalledTimes(1);
      expect(browserClient.fetchPage).toHaveBeenCalledTimes(1);
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("HTTP 503"));
      vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error("Playwright error"));

      await expect(mod.fetchAppPage("wix-forms")).rejects.toThrow("HTTP 503");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http</html>");
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>fallback</html>");

      const result = await mod.fetchAppPage("wix-forms");
      expect(result).toBe("<html>fallback</html>");
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
    });
  });

  describe("fetchCategoryPage", () => {
    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>cat page</html>");

      const result = await mod.fetchCategoryPage("marketing");
      expect(result).toBe("<html>cat page</html>");
    });
  });

  describe("fetchSearchPage", () => {
    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error("error"));
      vi.spyOn(browserClient, "fetchPage").mockResolvedValue("<html>search</html>");

      const result = await mod.fetchSearchPage("form builder");
      expect(result).toBe("<html>search</html>");
    });
  });
});
