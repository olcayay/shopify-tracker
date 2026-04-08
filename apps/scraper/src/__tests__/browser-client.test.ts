import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserClient } from "../browser-client.js";

// --- Mocks ---

const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  content: vi.fn().mockResolvedValue("<html>OK</html>"),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  isConnected: vi.fn().mockReturnValue(true),
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock IS_SMOKE_TEST to use faster timeouts in tests
vi.mock("../constants.js", () => ({
  IS_SMOKE_TEST: true,
}));

describe("BrowserClient", () => {
  let client: BrowserClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.isConnected.mockReturnValue(true);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue("<html>OK</html>");
    mockContext.newPage.mockResolvedValue(mockPage);
    mockContext.close.mockResolvedValue(undefined);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    client = new BrowserClient();
  });

  describe("isBrowserCrash", () => {
    it("detects 'Target page, context or browser has been closed'", () => {
      const err = new Error("Target page, context or browser has been closed");
      expect(BrowserClient.isBrowserCrash(err)).toBe(true);
    });

    it("detects 'browser has been closed'", () => {
      const err = new Error("browser has been closed");
      expect(BrowserClient.isBrowserCrash(err)).toBe(true);
    });

    it("detects 'Browser closed'", () => {
      const err = new Error("Browser closed unexpectedly");
      expect(BrowserClient.isBrowserCrash(err)).toBe(true);
    });

    it("detects 'Protocol error'", () => {
      const err = new Error("Protocol error (Runtime.callFunctionOn): Session closed");
      expect(BrowserClient.isBrowserCrash(err)).toBe(true);
    });

    it("detects 'Target closed'", () => {
      const err = new Error("Target closed");
      expect(BrowserClient.isBrowserCrash(err)).toBe(true);
    });

    it("returns false for unrelated errors", () => {
      expect(BrowserClient.isBrowserCrash(new Error("Timeout 30000ms exceeded"))).toBe(false);
      expect(BrowserClient.isBrowserCrash(new Error("net::ERR_CONNECTION_REFUSED"))).toBe(false);
      expect(BrowserClient.isBrowserCrash("string error")).toBe(false);
    });

    it("handles non-Error values", () => {
      expect(BrowserClient.isBrowserCrash("Target closed")).toBe(true);
      expect(BrowserClient.isBrowserCrash(42)).toBe(false);
      expect(BrowserClient.isBrowserCrash(null)).toBe(false);
    });
  });

  describe("fetchPage", () => {
    it("returns page content on success", async () => {
      const html = await client.fetchPage("https://example.com");
      expect(html).toBe("<html>OK</html>");
      expect(mockPage.goto).toHaveBeenCalledTimes(1);
    });

    it("closes context after success", async () => {
      await client.fetchPage("https://example.com");
      expect(mockContext.close).toHaveBeenCalledTimes(1);
    });

    it("retries once on browser crash error", async () => {
      // First call crashes, second succeeds
      mockPage.goto
        .mockRejectedValueOnce(new Error("Target page, context or browser has been closed"))
        .mockResolvedValueOnce(undefined);

      const html = await client.fetchPage("https://example.com");
      expect(html).toBe("<html>OK</html>");
      // goto called twice: once for crash, once for retry
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it("throws non-crash errors without retry", async () => {
      mockPage.goto.mockRejectedValueOnce(new Error("Timeout 30000ms exceeded"));

      await expect(client.fetchPage("https://example.com")).rejects.toThrow("Timeout 30000ms exceeded");
      expect(mockPage.goto).toHaveBeenCalledTimes(1);
    });

    it("throws if retry also crashes", async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error("browser has been closed"))
        .mockRejectedValueOnce(new Error("browser has been closed"));

      await expect(client.fetchPage("https://example.com")).rejects.toThrow("browser has been closed");
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });
  });

  describe("withPage", () => {
    it("returns callback result on success", async () => {
      const result = await client.withPage("https://example.com", async () => "result");
      expect(result).toBe("result");
    });

    it("retries once on browser crash error", async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error("Target page, context or browser has been closed"))
        .mockResolvedValueOnce(undefined);

      const result = await client.withPage("https://example.com", async () => "ok");
      expect(result).toBe("ok");
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it("throws non-crash errors without retry", async () => {
      mockPage.goto.mockRejectedValueOnce(new Error("net::ERR_NAME_NOT_RESOLVED"));

      await expect(
        client.withPage("https://example.com", async () => "ok"),
      ).rejects.toThrow("net::ERR_NAME_NOT_RESOLVED");
      expect(mockPage.goto).toHaveBeenCalledTimes(1);
    });
  });
});
