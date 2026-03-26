import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HubSpotModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";
import { BrowserClient } from "../../../browser-client.js";

describe("HubSpotModule fallback", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: HubSpotModule;

  beforeEach(() => {
    httpClient = new HttpClient();
    browserClient = new BrowserClient();
    mod = new HubSpotModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("uses CHIRP HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockResolvedValue('{"data":{"appDetail":{"name":"Gmail"}}}');
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{"data":{}}');

      const result = await mod.fetchAppPage("gmail");
      expect(result).toContain("Gmail");
      expect(browserClient.withPage).not.toHaveBeenCalled();
    });

    it("falls back to browser CHIRP when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockRejectedValue(new Error("IP blocked"));
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{"data":{"appDetail":{"name":"Gmail via browser"}}}');

      const result = await mod.fetchAppPage("gmail");
      expect(result).toContain("Gmail via browser");
      expect(browserClient.withPage).toHaveBeenCalledTimes(1);
    });

    it("throws primary error when both fail", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockRejectedValue(new Error("CHIRP blocked"));
      vi.spyOn(browserClient, "withPage").mockRejectedValue(new Error("browser crash"));

      await expect(mod.fetchAppPage("gmail")).rejects.toThrow("CHIRP blocked");
    });

    it("skips primary in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      vi.spyOn(httpClient, "fetchRaw").mockResolvedValue('{"data":{}}');
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{"data":{"appDetail":{"name":"Forced"}}}');

      const result = await mod.fetchAppPage("gmail");
      expect(httpClient.fetchRaw).not.toHaveBeenCalled();
      expect(result).toContain("Forced");
    });
  });

  describe("fetchCategoryPage", () => {
    it("uses CHIRP HTTP primary when it succeeds", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockResolvedValue('{"data":{"search":{"cards":[]}}}');
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{}');

      const result = await mod.fetchCategoryPage("sales");
      expect(result).toContain("cards");
      expect(browserClient.withPage).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockRejectedValue(new Error("blocked"));
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{"data":{"search":{"cards":[{"name":"App"}]}}}');

      const result = await mod.fetchCategoryPage("sales");
      expect(result).toContain("App");
    });
  });

  describe("fetchSearchPage", () => {
    it("falls back to browser when HTTP fails", async () => {
      vi.spyOn(httpClient, "fetchRaw").mockRejectedValue(new Error("rate limited"));
      vi.spyOn(browserClient, "withPage").mockResolvedValue('{"data":{"search":{"cards":[{"name":"Result"}]}}}');

      const result = await mod.fetchSearchPage("email");
      expect(result).toContain("Result");
    });
  });
});
