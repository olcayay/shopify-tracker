import { describe, it, expect, vi, beforeEach } from "vitest";

describe("analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset window.gtag
    (window as any).gtag = vi.fn();
  });

  describe("pageview", () => {
    it("calls gtag with page_path when GA_ID is set", async () => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123");
      const { pageview } = await import("@/lib/analytics");
      pageview("/test-page");
      expect(window.gtag).toHaveBeenCalledWith("config", "G-TEST123", {
        page_path: "/test-page",
      });
    });

    it("does nothing when GA_ID is empty", async () => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
      const { pageview } = await import("@/lib/analytics");
      pageview("/test-page");
      expect(window.gtag).not.toHaveBeenCalled();
    });
  });

  describe("event", () => {
    it("sends event with params when GA_ID is set", async () => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123");
      const { event } = await import("@/lib/analytics");
      event("click_button", { category: "nav" });
      expect(window.gtag).toHaveBeenCalledWith("event", "click_button", {
        category: "nav",
      });
    });

    it("sends event without params", async () => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123");
      const { event } = await import("@/lib/analytics");
      event("page_load");
      expect(window.gtag).toHaveBeenCalledWith("event", "page_load", undefined);
    });

    it("does nothing when GA_ID is empty", async () => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
      const { event } = await import("@/lib/analytics");
      event("click_button", { category: "nav" });
      expect(window.gtag).not.toHaveBeenCalled();
    });
  });
});
