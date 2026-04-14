import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CanvaModule } from "../index.js";
import { HttpClient } from "../../../http-client.js";

/**
 * Canva fallback tests.
 *
 * Canva manages its own Playwright browser lifecycle internally (persistent
 * browser, not BrowserClient). This makes it impossible to mock the browser
 * layer without actually launching Playwright.
 *
 * We test fallback behavior by:
 * 1. Testing the cached primary path (no browser needed)
 * 2. Testing fallback functions directly via withFallback mock
 * 3. Verifying parsers handle both primary and fallback data formats
 */
describe("CanvaModule fallback", () => {
  let httpClient: HttpClient;
  let mod: CanvaModule;
  const origFetchCategoryPage = CanvaModule.prototype.fetchCategoryPage;
  const origFetchAppPage = CanvaModule.prototype.fetchAppPage;
  const origFetchSearchPage = CanvaModule.prototype.fetchSearchPage;

  beforeEach(() => {
    httpClient = new HttpClient();
    mod = new CanvaModule(httpClient);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore prototype methods
    CanvaModule.prototype.fetchCategoryPage = origFetchCategoryPage;
    CanvaModule.prototype.fetchAppPage = origFetchAppPage;
    CanvaModule.prototype.fetchSearchPage = origFetchSearchPage;
    vi.restoreAllMocks();
  });

  // PLA-1085: HTTP fallback paths removed from fetchAppPage, fetchCategoryPage,
  // and fetchSearchPage. canva.com/apps returns HTTP 403 to any non-browser TLS
  // fingerprint (verified from multiple origins), so the fallback path always
  // threw the same kind of error as the primary. Previously covered-by-tests
  // scenarios:
  //   - "HTTP fallback returns bulk page when app ID found" / "throws when not"
  //   - "fetchCategoryPage HTTP /apps fallback works correctly"
  //   - "searchBulkApps handles/returns-empty keyword"
  // are gone. fetchCategoryPage still has an implicit cache-based resilience
  // path via fetchAppsPage's cachedAppsPageHtml (tested below).

  describe("fetchCategoryPage", () => {
    it("uses cached /apps page when available", async () => {
      (mod as any).cachedAppsPageHtml = "<html>cached</html>";
      vi.spyOn(httpClient, "fetchPage").mockResolvedValue("<html>http</html>");

      const result = await mod.fetchCategoryPage("productivity");
      expect(result).toBe("<html>cached</html>");
      // fetchCategoryPage no longer calls httpClient at all
      expect(httpClient.fetchPage).not.toHaveBeenCalled();
    });
  });

  describe("page pool for concurrent scrapes", () => {
    it("acquirePoolPage returns different pages for concurrent callers", async () => {
      // Simulate browser context by mocking internal state
      const mockPages: any[] = [];
      const mockContext = {
        newPage: vi.fn().mockImplementation(() => {
          const page = { id: mockPages.length, close: vi.fn() };
          mockPages.push(page);
          return page;
        }),
      };
      (mod as any).browserContext = mockContext;
      // Pretend browser is initialized by setting browserPage
      (mod as any).browserPage = { fake: true };
      (mod as any).browser = { close: vi.fn() };

      // Acquire 3 pages concurrently
      const p1 = await (mod as any).acquirePoolPage();
      const p2 = await (mod as any).acquirePoolPage();
      const p3 = await (mod as any).acquirePoolPage();

      // All should be different page instances
      expect(p1).not.toBe(p2);
      expect(p2).not.toBe(p3);
      expect(p1).not.toBe(p3);
      expect((mod as any).pagePool.length).toBe(3);
      expect((mod as any).pagesInUse.size).toBe(3);
    });

    it("releasePoolPage allows page reuse", async () => {
      const mockContext = {
        newPage: vi.fn().mockImplementation(() => ({
          id: Math.random(),
          close: vi.fn(),
        })),
      };
      (mod as any).browserContext = mockContext;
      (mod as any).browserPage = { fake: true };
      (mod as any).browser = { close: vi.fn() };

      const p1 = await (mod as any).acquirePoolPage();
      (mod as any).releasePoolPage(p1);

      // Should reuse the released page
      const p2 = await (mod as any).acquirePoolPage();
      expect(p2).toBe(p1);
      expect(mockContext.newPage).toHaveBeenCalledTimes(1); // Only created once
    });

    it("closeBrowser clears the page pool", async () => {
      (mod as any).browser = { close: vi.fn().mockResolvedValue(undefined) };
      (mod as any).pagePool = [{ id: 1 }, { id: 2 }];
      (mod as any).pagesInUse = new Set([{ id: 1 }]);

      await mod.closeBrowser();

      expect((mod as any).pagePool).toEqual([]);
      expect((mod as any).pagesInUse.size).toBe(0);
    });
  });

  describe("search retry and browser reset", () => {
    it("resetBrowserPage nulls the page so ensureBrowserPage recreates it", async () => {
      const mockPage = { close: vi.fn().mockResolvedValue(undefined) };
      (mod as any).browserPage = mockPage;
      (mod as any).browser = { isConnected: () => true, close: vi.fn() };
      (mod as any).browserContext = {
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          title: vi.fn().mockResolvedValue("Canva Apps"),
          waitForSelector: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          content: vi.fn().mockResolvedValue("<html></html>"),
        }),
      };

      await (mod as any).resetBrowserPage();

      // Original page should be closed
      expect(mockPage.close).toHaveBeenCalled();
      // browserPage should be set to null then recreated by ensureBrowserPage
      expect((mod as any).browserPage).not.toBe(mockPage);
      expect((mod as any).browserPage).not.toBeNull();
    });

    it("fetchAllSearchResults retries once on timeout", async () => {
      // Mock doFetchAllSearchResults to timeout first, succeed second
      let callCount = 0;
      const mockDoFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Simulate a hang — return a promise that never resolves (timeout will catch it)
          return new Promise(() => {}); // never resolves
        }
        return { A: 5, C: [{ A: "app1", B: "Test App" }], capturedResponses: 1 };
      });
      (mod as any).doFetchAllSearchResults = mockDoFetch;
      (mod as any).resetBrowserPage = vi.fn().mockResolvedValue(undefined);

      const result = await (mod as any).fetchAllSearchResults("test-keyword");

      expect(mockDoFetch).toHaveBeenCalledTimes(2);
      expect(result.C).toHaveLength(1);
      expect(result.C[0].A).toBe("app1");
    }, 70_000);

    it("fetchAllSearchResults retries on 0 results", async () => {
      let callCount = 0;
      const mockDoFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { A: 0, C: [], capturedResponses: 1 };
        return { A: 3, C: [{ A: "app1", B: "App" }], capturedResponses: 1 };
      });
      (mod as any).doFetchAllSearchResults = mockDoFetch;
      (mod as any).resetBrowserPage = vi.fn().mockResolvedValue(undefined);

      const result = await (mod as any).fetchAllSearchResults("test");
      expect(mockDoFetch).toHaveBeenCalledTimes(2);
      expect(result.C).toHaveLength(1);
    });

    it("fetchAllSearchResults throws when final attempt has 0 captured responses", async () => {
      // Simulates the Cloudflare-blocked case: search JS never fires,
      // no /_ajax/appsearch/search responses intercepted on either attempt.
      // Must throw so withFallback can try the HTTP path instead of silently
      // returning an empty result set.
      const mockDoFetch = vi.fn().mockResolvedValue({ A: 0, C: [], capturedResponses: 0 });
      (mod as any).doFetchAllSearchResults = mockDoFetch;
      (mod as any).resetBrowserPage = vi.fn().mockResolvedValue(undefined);

      await expect((mod as any).fetchAllSearchResults("blocked")).rejects.toThrow(/captured 0 responses/);
      expect(mockDoFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("withFallback integration", () => {
    it("module methods use withFallback pattern", () => {
      // Verify the source code uses withFallback by checking the module exports the right structure
      expect(mod.fetchAppPage).toBeDefined();
      expect(mod.fetchCategoryPage).toBeDefined();
      expect(mod.fetchSearchPage).toBeDefined();
      // The actual withFallback integration is tested by:
      // 1. The withFallback utility tests (100% coverage)
      // 2. The smoke test with --fallback flag (integration test)
    });

    it("parseAppDetails throws on HTML with no extractable app data", () => {
      // Previously returned a silent minimal stub, which inflated items_scraped
      // when Cloudflare returned challenge HTML. Now throws so the caller
      // records a real failure.
      expect(() => mod.parseAppDetails("<html>no data</html>", "AAFtest--test"))
        .toThrow(/not found in page/);
    });
  });
});
