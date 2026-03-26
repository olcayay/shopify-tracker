import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withFallback } from "../with-fallback.js";
import { FallbackTracker } from "../fallback-tracker.js";

describe("withFallback", () => {
  const origEnv = process.env.FORCE_FALLBACK;

  beforeEach(() => {
    delete process.env.FORCE_FALLBACK;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.FORCE_FALLBACK = origEnv;
    } else {
      delete process.env.FORCE_FALLBACK;
    }
    vi.restoreAllMocks();
  });

  it("returns primary result on success", async () => {
    const primary = vi.fn().mockResolvedValue("primary-ok");
    const fallback = vi.fn().mockResolvedValue("fallback-ok");

    const result = await withFallback(primary, fallback, "test/ok");

    expect(result).toBe("primary-ok");
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when primary throws", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("primary-fail"));
    const fallback = vi.fn().mockResolvedValue("fallback-ok");

    const result = await withFallback(primary, fallback, "test/fallback");

    expect(result).toBe("fallback-ok");
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("primary failed"),
    );
  });

  it("throws primary error when both fail", async () => {
    const primaryErr = new Error("primary-fail");
    const primary = vi.fn().mockRejectedValue(primaryErr);
    const fallback = vi.fn().mockRejectedValue(new Error("fallback-fail"));

    await expect(
      withFallback(primary, fallback, "test/both-fail"),
    ).rejects.toThrow(primaryErr);

    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("skips primary when FORCE_FALLBACK=true", async () => {
    process.env.FORCE_FALLBACK = "true";

    const primary = vi.fn().mockResolvedValue("primary-ok");
    const fallback = vi.fn().mockResolvedValue("fallback-ok");

    const result = await withFallback(primary, fallback, "test/force");

    expect(result).toBe("fallback-ok");
    expect(primary).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("throws descriptive error when fallback fails in force mode", async () => {
    process.env.FORCE_FALLBACK = "true";

    const primary = vi.fn().mockResolvedValue("primary-ok");
    const fallback = vi.fn().mockRejectedValue(new Error("fb-err"));

    await expect(
      withFallback(primary, fallback, "test/force-fail"),
    ).rejects.toThrow("fallback failed in force-fallback mode: fb-err");

    expect(primary).not.toHaveBeenCalled();
  });

  it("handles non-Error thrown values", async () => {
    const primary = vi.fn().mockRejectedValue("string-error");
    const fallback = vi.fn().mockResolvedValue("fallback-ok");

    const result = await withFallback(primary, fallback, "test/non-error");

    expect(result).toBe("fallback-ok");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("string-error"),
    );
  });

  describe("FallbackTracker integration", () => {
    it("does not record when primary succeeds", async () => {
      const tracker = new FallbackTracker();
      const primary = vi.fn().mockResolvedValue("primary-ok");
      const fallback = vi.fn().mockResolvedValue("fallback-ok");

      await withFallback(primary, fallback, "test/no-track", tracker);

      expect(tracker.fallbackUsed).toBe(false);
      expect(tracker.fallbackCount).toBe(0);
    });

    it("records context when fallback is used", async () => {
      const tracker = new FallbackTracker();
      const primary = vi.fn().mockRejectedValue(new Error("fail"));
      const fallback = vi.fn().mockResolvedValue("fallback-ok");

      await withFallback(primary, fallback, "shopify/fetchAppPage/slug", tracker);

      expect(tracker.fallbackUsed).toBe(true);
      expect(tracker.fallbackCount).toBe(1);
      expect(tracker.contexts).toEqual(["shopify/fetchAppPage/slug"]);
    });

    it("records context in FORCE_FALLBACK mode", async () => {
      process.env.FORCE_FALLBACK = "true";
      const tracker = new FallbackTracker();
      const primary = vi.fn().mockResolvedValue("primary-ok");
      const fallback = vi.fn().mockResolvedValue("fallback-ok");

      await withFallback(primary, fallback, "test/force-track", tracker);

      expect(tracker.fallbackUsed).toBe(true);
      expect(tracker.contexts).toEqual(["test/force-track"]);
    });

    it("does not record when both fail", async () => {
      const tracker = new FallbackTracker();
      const primary = vi.fn().mockRejectedValue(new Error("p-fail"));
      const fallback = vi.fn().mockRejectedValue(new Error("f-fail"));

      await expect(
        withFallback(primary, fallback, "test/both-fail-track", tracker),
      ).rejects.toThrow("p-fail");

      expect(tracker.fallbackUsed).toBe(false);
    });

    it("works without tracker (backward compatible)", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("fail"));
      const fallback = vi.fn().mockResolvedValue("ok");

      const result = await withFallback(primary, fallback, "test/no-tracker");
      expect(result).toBe("ok");
    });
  });
});
