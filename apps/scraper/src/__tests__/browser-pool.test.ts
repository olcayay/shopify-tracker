import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserPool } from "../browser-pool.js";

// Mock playwright
const mockContext = {
  newPage: vi.fn().mockResolvedValue({}),
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

describe("BrowserPool", () => {
  let pool: BrowserPool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.isConnected.mockReturnValue(true);
    pool = new BrowserPool();
  });

  it("launches browser on first getBrowser call", async () => {
    const browser = await pool.getBrowser();
    expect(browser).toBe(mockBrowser);
    const { chromium } = await import("playwright");
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it("reuses browser on subsequent calls", async () => {
    await pool.getBrowser();
    await pool.getBrowser();
    await pool.getBrowser();
    const { chromium } = await import("playwright");
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it("creates a new context via newContext", async () => {
    const ctx = await pool.newContext({ userAgent: "test-ua" });
    expect(mockBrowser.newContext).toHaveBeenCalledWith({ userAgent: "test-ua" });
    expect(ctx).toBe(mockContext);
  });

  it("recycles browser when disconnected", async () => {
    await pool.getBrowser();
    mockBrowser.isConnected.mockReturnValue(false);
    await pool.getBrowser();
    const { chromium } = await import("playwright");
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it("closes browser on pool.close()", async () => {
    await pool.getBrowser();
    await pool.close();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("getStats returns pool status", async () => {
    const statsBefore = pool.getStats();
    expect(statsBefore.isConnected).toBe(false);
    expect(statsBefore.jobCount).toBe(0);

    await pool.getBrowser();
    const statsAfter = pool.getStats();
    expect(statsAfter.isConnected).toBe(true);
    expect(statsAfter.jobCount).toBe(1);
    expect(statsAfter.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("increments job count on each getBrowser call", async () => {
    await pool.getBrowser();
    await pool.getBrowser();
    await pool.getBrowser();
    expect(pool.getStats().jobCount).toBe(3);
  });
});
