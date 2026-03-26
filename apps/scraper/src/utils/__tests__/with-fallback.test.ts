import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withFallback } from "../with-fallback.js";

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
});
