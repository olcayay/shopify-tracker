import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient } from "../../http-client.js";
import { BrowserClient } from "../../browser-client.js";
import { ShopifyModule } from "../shopify/index.js";
import { WixModule } from "../wix/index.js";
import { ZohoModule } from "../zoho/index.js";

/**
 * Tier 1 fallback integration tests.
 *
 * These tests verify the HTTP ↔ Browser fallback behavior for each platform
 * module that uses `withFallback()`. They do NOT test parsing — only that:
 *   1. Primary succeeds → fallback is NOT called
 *   2. Primary fails   → fallback kicks in and returns the result
 *   3. Both fail       → the primary error is re-thrown
 *   4. FORCE_FALLBACK  → primary is skipped, fallback used directly
 *
 * Shopify & Wix: HTTP primary → Browser fallback (all page types)
 * Zoho:          HTTP primary → Browser fallback (app page)
 *                Browser primary → HTTP fallback (category & search pages)
 */

const HTML_OK = "<html><body>ok</body></html>";
const HTML_FALLBACK = "<html><body>fallback</body></html>";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClients() {
  const httpClient = new HttpClient({ delayMs: 0, maxRetries: 0 });
  const browserClient = new BrowserClient();
  return { httpClient, browserClient };
}

function mockHttpSuccess(httpClient: HttpClient, html = HTML_OK) {
  return vi.spyOn(httpClient, "fetchPage").mockResolvedValue(html);
}

function mockHttpFailure(httpClient: HttpClient, msg = "HTTP 503") {
  return vi.spyOn(httpClient, "fetchPage").mockRejectedValue(new Error(msg));
}

function mockBrowserSuccess(browserClient: BrowserClient, html = HTML_FALLBACK) {
  return vi.spyOn(browserClient, "fetchPage").mockResolvedValue(html);
}

function mockBrowserFailure(browserClient: BrowserClient, msg = "Browser timeout") {
  return vi.spyOn(browserClient, "fetchPage").mockRejectedValue(new Error(msg));
}

// ---------------------------------------------------------------------------
// ShopifyModule — HTTP primary, Browser fallback for all fetch methods
// ---------------------------------------------------------------------------

describe("ShopifyModule fallback behavior", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: ShopifyModule;
  const origForceFallback = process.env.FORCE_FALLBACK;

  beforeEach(() => {
    delete process.env.FORCE_FALLBACK;
    ({ httpClient, browserClient } = createClients());
    mod = new ShopifyModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (origForceFallback !== undefined) {
      process.env.FORCE_FALLBACK = origForceFallback;
    } else {
      delete process.env.FORCE_FALLBACK;
    }
    vi.restoreAllMocks();
  });

  // -- fetchAppPage --

  describe("fetchAppPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("omnisend");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("omnisend");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both HTTP and browser fail", async () => {
      mockHttpFailure(httpClient, "HTTP 503");
      mockBrowserFailure(browserClient, "Browser timeout");

      await expect(mod.fetchAppPage("omnisend")).rejects.toThrow("HTTP 503");
    });

    it("skips HTTP and uses browser directly in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("omnisend");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).not.toHaveBeenCalled();
      expect(browserSpy).toHaveBeenCalledOnce();
    });
  });

  // -- fetchCategoryPage --

  describe("fetchCategoryPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchCategoryPage("store-design");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchCategoryPage("store-design", 2);

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both fail", async () => {
      mockHttpFailure(httpClient, "HTTP 429");
      mockBrowserFailure(browserClient, "Page crashed");

      await expect(mod.fetchCategoryPage("store-design")).rejects.toThrow("HTTP 429");
    });
  });

  // -- fetchSearchPage --

  describe("fetchSearchPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchSearchPage("email marketing");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchSearchPage("email marketing", 1);

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both fail", async () => {
      mockHttpFailure(httpClient, "Connection refused");
      mockBrowserFailure(browserClient, "Navigation timeout");

      await expect(mod.fetchSearchPage("email marketing")).rejects.toThrow("Connection refused");
    });
  });

  // -- fetchReviewPage --

  describe("fetchReviewPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchReviewPage("omnisend", 1);

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchReviewPage("omnisend", 2);

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both fail", async () => {
      mockHttpFailure(httpClient, "HTTP 500");
      mockBrowserFailure(browserClient, "Context closed");

      await expect(mod.fetchReviewPage("omnisend")).rejects.toThrow("HTTP 500");
    });
  });

  // -- fetchFeaturedSections (also uses withFallback internally) --

  describe("fetchFeaturedSections", () => {
    it("falls back to browser when HTTP fails for featured sections", async () => {
      mockHttpFailure(httpClient);
      // Return minimal HTML that the featured parser can handle (empty sections list)
      mockBrowserSuccess(browserClient, "<html><body></body></html>");

      // Should not throw — just return an empty array from parsing
      const result = await mod.fetchFeaturedSections();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// WixModule — HTTP primary, Browser fallback for all fetch methods
// ---------------------------------------------------------------------------

describe("WixModule fallback behavior", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: WixModule;
  const origForceFallback = process.env.FORCE_FALLBACK;

  beforeEach(() => {
    delete process.env.FORCE_FALLBACK;
    ({ httpClient, browserClient } = createClients());
    mod = new WixModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (origForceFallback !== undefined) {
      process.env.FORCE_FALLBACK = origForceFallback;
    } else {
      delete process.env.FORCE_FALLBACK;
    }
    vi.restoreAllMocks();
  });

  // -- fetchAppPage --

  describe("fetchAppPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("wix-forms");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("wix-forms");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both HTTP and browser fail", async () => {
      mockHttpFailure(httpClient, "HTTP 403");
      mockBrowserFailure(browserClient, "Page not found");

      await expect(mod.fetchAppPage("wix-forms")).rejects.toThrow("HTTP 403");
    });

    it("skips HTTP and uses browser directly in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("wix-forms");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).not.toHaveBeenCalled();
      expect(browserSpy).toHaveBeenCalledOnce();
    });
  });

  // -- fetchCategoryPage --

  describe("fetchCategoryPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchCategoryPage("marketing");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchCategoryPage("marketing");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both fail", async () => {
      mockHttpFailure(httpClient, "DNS resolution failed");
      mockBrowserFailure(browserClient, "ERR_NAME_NOT_RESOLVED");

      await expect(mod.fetchCategoryPage("marketing")).rejects.toThrow("DNS resolution failed");
    });
  });

  // -- fetchSearchPage --

  describe("fetchSearchPage", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchSearchPage("analytics");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchSearchPage("analytics");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both fail", async () => {
      mockHttpFailure(httpClient, "HTTP 502");
      mockBrowserFailure(browserClient, "Target closed");

      await expect(mod.fetchSearchPage("analytics")).rejects.toThrow("HTTP 502");
    });
  });

  // -- fetchReviewPage (delegates to fetchAppPage internally) --

  describe("fetchReviewPage", () => {
    it("returns HTTP result when primary succeeds (delegates to fetchAppPage)", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchReviewPage("wix-forms", 1);

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails (delegates to fetchAppPage)", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchReviewPage("wix-forms");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// ZohoModule — mixed primary/fallback depending on page type
//   App pages:      HTTP primary → Browser fallback
//   Category pages: Browser primary → HTTP fallback
//   Search pages:   Browser primary → HTTP fallback
// ---------------------------------------------------------------------------

describe("ZohoModule fallback behavior", () => {
  let httpClient: HttpClient;
  let browserClient: BrowserClient;
  let mod: ZohoModule;
  const origForceFallback = process.env.FORCE_FALLBACK;

  beforeEach(() => {
    delete process.env.FORCE_FALLBACK;
    ({ httpClient, browserClient } = createClients());
    mod = new ZohoModule(httpClient, browserClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (origForceFallback !== undefined) {
      process.env.FORCE_FALLBACK = origForceFallback;
    } else {
      delete process.env.FORCE_FALLBACK;
    }
    vi.restoreAllMocks();
  });

  // -- fetchAppPage (HTTP primary → Browser fallback) --

  describe("fetchAppPage (HTTP primary)", () => {
    it("returns HTTP result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("crm--jotform");

      expect(result).toBe(HTML_OK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).not.toHaveBeenCalled();
    });

    it("falls back to browser when HTTP fails", async () => {
      const httpSpy = mockHttpFailure(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("crm--jotform");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).toHaveBeenCalledOnce();
      expect(browserSpy).toHaveBeenCalledOnce();
    });

    it("throws primary error when both HTTP and browser fail", async () => {
      mockHttpFailure(httpClient, "HTTP 404");
      mockBrowserFailure(browserClient, "ERR_CONNECTION_REFUSED");

      await expect(mod.fetchAppPage("crm--jotform")).rejects.toThrow("HTTP 404");
    });

    it("skips HTTP and uses browser directly in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchAppPage("crm--jotform");

      expect(result).toBe(HTML_FALLBACK);
      expect(httpSpy).not.toHaveBeenCalled();
      expect(browserSpy).toHaveBeenCalledOnce();
    });
  });

  // -- fetchCategoryPage (Browser primary → HTTP fallback) --

  describe("fetchCategoryPage (Browser primary)", () => {
    it("returns browser result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchCategoryPage("crm");

      expect(result).toBe(HTML_FALLBACK); // browser returns HTML_FALLBACK
      expect(browserSpy).toHaveBeenCalledOnce();
      expect(httpSpy).not.toHaveBeenCalled();
    });

    it("falls back to HTTP when browser fails", async () => {
      const browserSpy = mockBrowserFailure(browserClient);
      const httpSpy = mockHttpSuccess(httpClient);

      const result = await mod.fetchCategoryPage("crm");

      expect(result).toBe(HTML_OK); // HTTP returns HTML_OK
      expect(browserSpy).toHaveBeenCalledOnce();
      expect(httpSpy).toHaveBeenCalledOnce();
    });

    it("throws primary (browser) error when both fail", async () => {
      mockBrowserFailure(browserClient, "Browser crashed");
      mockHttpFailure(httpClient, "HTTP 500");

      await expect(mod.fetchCategoryPage("crm")).rejects.toThrow("Browser crashed");
    });

    it("skips browser and uses HTTP directly in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const browserSpy = mockBrowserSuccess(browserClient);
      const httpSpy = mockHttpSuccess(httpClient);

      const result = await mod.fetchCategoryPage("crm");

      // In FORCE_FALLBACK mode, the fallback (HTTP) is used directly
      expect(result).toBe(HTML_OK);
      expect(browserSpy).not.toHaveBeenCalled();
      expect(httpSpy).toHaveBeenCalledOnce();
    });
  });

  // -- fetchSearchPage (Browser primary → HTTP fallback) --

  describe("fetchSearchPage (Browser primary)", () => {
    it("returns browser result when primary succeeds", async () => {
      const httpSpy = mockHttpSuccess(httpClient);
      const browserSpy = mockBrowserSuccess(browserClient);

      const result = await mod.fetchSearchPage("crm integration");

      expect(result).toBe(HTML_FALLBACK); // browser returns HTML_FALLBACK
      expect(browserSpy).toHaveBeenCalledOnce();
      expect(httpSpy).not.toHaveBeenCalled();
    });

    it("falls back to HTTP when browser fails", async () => {
      const browserSpy = mockBrowserFailure(browserClient);
      const httpSpy = mockHttpSuccess(httpClient);

      const result = await mod.fetchSearchPage("crm integration");

      expect(result).toBe(HTML_OK); // HTTP returns HTML_OK
      expect(browserSpy).toHaveBeenCalledOnce();
      expect(httpSpy).toHaveBeenCalledOnce();
    });

    it("throws primary (browser) error when both fail", async () => {
      mockBrowserFailure(browserClient, "Playwright not installed");
      mockHttpFailure(httpClient, "HTTP 504");

      await expect(mod.fetchSearchPage("crm integration")).rejects.toThrow("Playwright not installed");
    });

    it("skips browser and uses HTTP directly in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const browserSpy = mockBrowserSuccess(browserClient);
      const httpSpy = mockHttpSuccess(httpClient);

      const result = await mod.fetchSearchPage("crm integration");

      // In FORCE_FALLBACK mode, the fallback (HTTP) is used directly
      expect(result).toBe(HTML_OK);
      expect(browserSpy).not.toHaveBeenCalled();
      expect(httpSpy).toHaveBeenCalledOnce();
    });
  });
});
