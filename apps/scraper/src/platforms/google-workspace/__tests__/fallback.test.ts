import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleWorkspaceModule } from "../index.js";

describe("GoogleWorkspaceModule fallback", () => {
  let mod: GoogleWorkspaceModule;
  let mockPage: any;
  let mockBrowser: any;
  let mockContext: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue("<html>app detail</html>"),
      title: vi.fn().mockResolvedValue("Some Title"),
      evaluate: vi.fn().mockResolvedValue(0),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };
    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mod = new GoogleWorkspaceModule();
    // Inject mock browser internals to bypass playwright launch
    (mod as any).browser = mockBrowser;
    (mod as any).browserContext = mockContext;

    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FORCE_FALLBACK;
  });

  describe("fetchAppPage", () => {
    it("returns HTML on first successful attempt", async () => {
      mockPage.content.mockResolvedValue("<html>app detail content</html>");

      const result = await mod.fetchAppPage("test-app--123");
      expect(result).toBe("<html>app detail content</html>");
      expect(mockPage.close).toHaveBeenCalled();
      // Browser was NOT reset (close not called)
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("resets browser and retries when primary fails", async () => {
      let callCount = 0;
      mockPage.goto.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("navigation timeout");
      });
      mockPage.content.mockResolvedValue("<html>recovered</html>");

      // After resetBrowser (closeBrowser), re-inject mocks
      const origCloseBrowser = mod.closeBrowser.bind(mod);
      vi.spyOn(mod, "closeBrowser").mockImplementation(async () => {
        await origCloseBrowser();
        (mod as any).browser = mockBrowser;
        (mod as any).browserContext = mockContext;
      });

      const result = await mod.fetchAppPage("test-app--123");
      expect(result).toBe("<html>recovered</html>");
      expect(mod.closeBrowser).toHaveBeenCalled();
    });

    it("throws when both attempts fail", async () => {
      mockPage.goto.mockRejectedValue(new Error("bot detected"));

      const origCloseBrowser = mod.closeBrowser.bind(mod);
      vi.spyOn(mod, "closeBrowser").mockImplementation(async () => {
        await origCloseBrowser();
        (mod as any).browser = mockBrowser;
        (mod as any).browserContext = mockContext;
      });

      await expect(mod.fetchAppPage("test-app--123")).rejects.toThrow("bot detected");
    });
  });

  describe("fetchCategoryPage", () => {
    it("returns HTML on first successful attempt", async () => {
      mockPage.content.mockResolvedValue("<html>category apps</html>");

      const result = await mod.fetchCategoryPage("productivity");
      expect(result).toBe("<html>category apps</html>");
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("resets browser and retries when primary fails", async () => {
      let callCount = 0;
      mockPage.goto.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("stale session");
      });
      mockPage.content.mockResolvedValue("<html>category recovered</html>");

      const origCloseBrowser = mod.closeBrowser.bind(mod);
      vi.spyOn(mod, "closeBrowser").mockImplementation(async () => {
        await origCloseBrowser();
        (mod as any).browser = mockBrowser;
        (mod as any).browserContext = mockContext;
      });

      const result = await mod.fetchCategoryPage("productivity");
      expect(result).toBe("<html>category recovered</html>");
      expect(mod.closeBrowser).toHaveBeenCalled();
    });
  });

  describe("fetchSearchPage", () => {
    it("returns HTML on first successful attempt", async () => {
      mockPage.content.mockResolvedValue("<html>search results</html>");

      const result = await mod.fetchSearchPage("calendar");
      expect(result).toBe("<html>search results</html>");
      expect(mockPage.close).toHaveBeenCalled();
    });

    it("resets browser and retries when primary fails", async () => {
      let callCount = 0;
      mockPage.goto.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("page crash");
      });
      mockPage.content.mockResolvedValue("<html>search recovered</html>");

      const origCloseBrowser = mod.closeBrowser.bind(mod);
      vi.spyOn(mod, "closeBrowser").mockImplementation(async () => {
        await origCloseBrowser();
        (mod as any).browser = mockBrowser;
        (mod as any).browserContext = mockContext;
      });

      const result = await mod.fetchSearchPage("calendar");
      expect(result).toBe("<html>search recovered</html>");
      expect(mod.closeBrowser).toHaveBeenCalled();
    });

    it("throws primary error when both attempts fail", async () => {
      mockPage.goto.mockRejectedValue(new Error("permanent failure"));

      const origCloseBrowser = mod.closeBrowser.bind(mod);
      vi.spyOn(mod, "closeBrowser").mockImplementation(async () => {
        await origCloseBrowser();
        (mod as any).browser = mockBrowser;
        (mod as any).browserContext = mockContext;
      });

      await expect(mod.fetchSearchPage("calendar")).rejects.toThrow("permanent failure");
    });
  });

  describe("fetchReviewPage", () => {
    it("delegates to fetchAppPage (reviews embedded in app page)", async () => {
      mockPage.content.mockResolvedValue("<html>app with reviews</html>");

      const result = await mod.fetchReviewPage("test-app--123");
      expect(result).toBe("<html>app with reviews</html>");
      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});
