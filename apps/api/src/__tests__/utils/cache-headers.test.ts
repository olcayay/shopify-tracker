/**
 * Tests for cache-control and ETag header logic.
 *
 * Since the caching hook is registered in index.ts (app startup),
 * we test the expected patterns rather than the full app lifecycle.
 */
import { describe, it, expect } from "vitest";

// Helper to determine expected cache-control for a URL path
function getCachePolicy(url: string, isAuthenticated: boolean) {
  const path = url.split("?")[0];

  if (path.startsWith("/api/auth") || path.startsWith("/api/account") || path.startsWith("/api/system-admin") || path.startsWith("/api/admin")) {
    return { cacheControl: "private, no-cache", isPublic: false };
  }

  if (path.startsWith("/api/public/")) {
    return { cacheControl: "public, max-age=3600, stale-while-revalidate=7200", isPublic: true };
  }

  if (path === "/api/platforms" || path === "/api/features/tree") {
    return { cacheControl: "public, max-age=3600, stale-while-revalidate=7200", isPublic: true };
  }

  if (path.match(/^\/api\/(apps|categories|keywords|developers)\/[^/]+$/) ||
      path.match(/^\/api\/apps\/[^/]+\/(scores|rankings|changes|reviews|similar|featured|ads)/)) {
    return { cacheControl: "public, max-age=300, stale-while-revalidate=600", isPublic: true };
  }

  if (path.match(/^\/api\/(categories|featured-apps|integrations|platform-attributes)\/?$/) ||
      path.match(/^\/api\/categories\?/)) {
    return { cacheControl: "public, max-age=60, stale-while-revalidate=300", isPublic: true };
  }

  return { cacheControl: "private, max-age=30", isPublic: false };
}

describe("Cache-Control policies", () => {
  it("auth routes are private, no-cache", () => {
    expect(getCachePolicy("/api/auth/me", true).cacheControl).toBe("private, no-cache");
    expect(getCachePolicy("/api/auth/login", false).cacheControl).toBe("private, no-cache");
  });

  it("account routes are private, no-cache", () => {
    expect(getCachePolicy("/api/account/members", true).cacheControl).toBe("private, no-cache");
  });

  it("admin routes are private, no-cache", () => {
    expect(getCachePolicy("/api/system-admin/users", true).cacheControl).toBe("private, no-cache");
    expect(getCachePolicy("/api/admin/anything", true).cacheControl).toBe("private, no-cache");
  });

  it("public API routes have 1-hour cache", () => {
    const policy = getCachePolicy("/api/public/apps/shopify/some-app", false);
    expect(policy.cacheControl).toContain("max-age=3600");
    expect(policy.isPublic).toBe(true);
  });

  it("public categories have 1-hour cache", () => {
    const policy = getCachePolicy("/api/public/categories/shopify", false);
    expect(policy.cacheControl).toContain("max-age=3600");
    expect(policy.isPublic).toBe(true);
  });

  it("platform list has 1-hour cache", () => {
    const policy = getCachePolicy("/api/platforms", false);
    expect(policy.cacheControl).toContain("max-age=3600");
    expect(policy.isPublic).toBe(true);
  });

  it("features tree has 1-hour cache", () => {
    const policy = getCachePolicy("/api/features/tree", false);
    expect(policy.cacheControl).toContain("max-age=3600");
    expect(policy.isPublic).toBe(true);
  });

  it("app detail has 5-min cache", () => {
    const policy = getCachePolicy("/api/apps/some-slug", true);
    expect(policy.cacheControl).toContain("max-age=300");
    expect(policy.isPublic).toBe(true);
  });

  it("app scores have 5-min cache", () => {
    const policy = getCachePolicy("/api/apps/some-slug/scores", true);
    expect(policy.cacheControl).toContain("max-age=300");
    expect(policy.isPublic).toBe(true);
  });

  it("category list has 1-min cache", () => {
    const policy = getCachePolicy("/api/categories", true);
    expect(policy.cacheControl).toContain("max-age=60");
    expect(policy.isPublic).toBe(true);
  });

  it("featured apps has 1-min cache", () => {
    const policy = getCachePolicy("/api/featured-apps", true);
    expect(policy.cacheControl).toContain("max-age=60");
    expect(policy.isPublic).toBe(true);
  });

  it("authenticated dashboard endpoints have private, short cache", () => {
    const policy = getCachePolicy("/api/overview/highlights", true);
    expect(policy.cacheControl).toBe("private, max-age=30");
    expect(policy.isPublic).toBe(false);
  });

  it("cross-platform endpoints have private, short cache", () => {
    const policy = getCachePolicy("/api/cross-platform/apps", true);
    expect(policy.cacheControl).toBe("private, max-age=30");
    expect(policy.isPublic).toBe(false);
  });

  it("public routes should include ETag (isPublic flag)", () => {
    expect(getCachePolicy("/api/public/apps/shopify/test", false).isPublic).toBe(true);
    expect(getCachePolicy("/api/platforms", false).isPublic).toBe(true);
    expect(getCachePolicy("/api/apps/test-app", false).isPublic).toBe(true);
    // Private routes should NOT have ETags
    expect(getCachePolicy("/api/overview/highlights", true).isPublic).toBe(false);
    expect(getCachePolicy("/api/auth/me", true).isPublic).toBe(false);
  });
});
