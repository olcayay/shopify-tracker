import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server
const mockRedirect = vi.fn((url: URL) => ({
  type: "redirect",
  url: url.toString(),
  cookies: { set: vi.fn() },
}));
const mockRewrite = vi.fn((url: URL) => ({
  type: "rewrite",
  url: url.toString(),
  cookies: { set: vi.fn() },
}));
const mockNext = vi.fn(() => ({
  type: "next",
  cookies: { set: vi.fn() },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => mockRedirect(url),
    rewrite: (url: URL) => mockRewrite(url),
    next: () => mockNext(),
  },
}));

function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    nextUrl: {
      pathname,
      clone: () => new URL(url.toString()),
    },
    url: url.toString(),
    cookies: {
      get: (name: string) => {
        const value = cookies[name];
        return value ? { value } : undefined;
      },
    },
  };
}

describe("proxy routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("allows unauthenticated access to /", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/login") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /register", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/register") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /invite", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/invite") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /terms", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/terms") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /privacy", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/privacy") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("redirects authenticated user from / to /overview", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/", { access_token: "valid-token" }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/overview");
  });

  it("redirects authenticated user from /login to /overview", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/login", { access_token: "valid-token" }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/overview");
  });

  it("redirects authenticated user from /register to /overview", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/register", { access_token: "valid-token" }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/overview");
  });

  it("does not redirect authenticated user from /terms", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/terms", { access_token: "valid-token" }) as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("does not redirect authenticated user from /privacy", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/privacy", { access_token: "valid-token" }) as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /health", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/health") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("does not redirect /overview (cross-platform page)", async () => {
    const { proxy } = await import("@/proxy");
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600, isSystemAdmin: false };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/overview", { access_token: token }) as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("does not redirect /apps (cross-platform page), falls through to auth", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/apps") as any;
    await proxy(req);
    // No auth token → redirects to /login, NOT /shopify/apps
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("redirects legacy /apps/some-slug to /shopify/apps/some-slug", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/apps/some-slug") as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/shopify/apps/some-slug");
  });

  it("redirects unauthenticated user from /shopify/overview to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/shopify/overview") as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("redirects unauthenticated user from /settings to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/settings") as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("redirects unauthenticated user from /system-admin to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/system-admin") as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("allows authenticated user to access /shopify/overview with valid token", async () => {
    const { proxy } = await import("@/proxy");
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600, isSystemAdmin: false };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/shopify/overview", { access_token: token }) as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("redirects non-admin from /system-admin to /overview", async () => {
    const { proxy } = await import("@/proxy");
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600, isSystemAdmin: false };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/system-admin", { access_token: token }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/overview");
  });

  it("allows system admin to access /system-admin", async () => {
    const { proxy } = await import("@/proxy");
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600, isSystemAdmin: true };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/system-admin", { access_token: token }) as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("redirects to /login when token is expired and no refresh token", async () => {
    const { proxy } = await import("@/proxy");
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // expired
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/shopify/overview", { access_token: token }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("redirects to /login when token has invalid format", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/shopify/overview", { access_token: "invalid-token" }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("exports config with matcher pattern", async () => {
    const { config } = await import("@/proxy");
    expect(config.matcher).toBeDefined();
    expect(config.matcher[0]).toContain("_next/static");
  });

  it("does not match / as prefix for /shopify/overview", async () => {
    // Ensure "/" in PUBLIC_PATHS doesn't accidentally match "/shopify/overview"
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/shopify/overview") as any;
    await proxy(req);
    // Should NOT be treated as public - should try to validate token
    expect(mockRedirect).toHaveBeenCalled();
  });

  // Marketing pages — public access without auth
  it("allows unauthenticated access to /audit", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/audit") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /audit/shopify/some-app", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/audit/shopify/some-app") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /changelog", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/changelog") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /contact", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/contact") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows unauthenticated access to /pricing", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/pricing") as any;
    await proxy(req);
    expect(mockNext).toHaveBeenCalled();
  });

  // ─── PLA-1110: bare app-detail routing must rewrite, not redirect ──────
  // A 307 redirect trips ERR_QUIC_PROTOCOL_ERROR at Cloudflare on the RSC
  // prefetch target, producing a 1–2 minute hang then "network error". The
  // rewrite keeps the URL stable and avoids the second HTTP/3 round-trip.
  describe("bare /{platform}/apps/{slug} routing (PLA-1110)", () => {
    it("rewrites to /v2/ by default (cookie unset)", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/jotform-ai-chatbot") as any;
      await proxy(req);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockRewrite).toHaveBeenCalledOnce();
      const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
      expect(rewriteUrl.pathname).toBe("/shopify/apps/v2/jotform-ai-chatbot");
    });

    it("rewrites to /v1/ when app-layout-version=v1 cookie is set", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/jotform-ai-chatbot", {
        "app-layout-version": "v1",
      }) as any;
      await proxy(req);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockRewrite).toHaveBeenCalledOnce();
      const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
      expect(rewriteUrl.pathname).toBe("/shopify/apps/v1/jotform-ai-chatbot");
    });

    it("preserves nested subpath on v1 rewrite (e.g. /keywords)", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/jotform-ai-chatbot/keywords", {
        "app-layout-version": "v1",
      }) as any;
      await proxy(req);
      expect(mockRewrite).toHaveBeenCalledOnce();
      const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
      expect(rewriteUrl.pathname).toBe("/shopify/apps/v1/jotform-ai-chatbot/keywords");
    });

    it("applies mapV1PathToV2 for v2 default (e.g. /keywords → /visibility/keywords)", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/jotform-ai-chatbot/keywords") as any;
      await proxy(req);
      expect(mockRewrite).toHaveBeenCalledOnce();
      const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
      expect(rewriteUrl.pathname).toBe("/shopify/apps/v2/jotform-ai-chatbot/visibility/keywords");
    });

    it("does not rewrite already-prefixed /v2/ paths (negative lookahead)", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/v2/jotform-ai-chatbot") as any;
      await proxy(req);
      expect(mockRewrite).not.toHaveBeenCalled();
      // Falls through to auth — no access_token → redirect to /login
      expect(mockRedirect).toHaveBeenCalledOnce();
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("does not rewrite already-prefixed /v1/ paths (negative lookahead)", async () => {
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/v1/jotform-ai-chatbot") as any;
      await proxy(req);
      expect(mockRewrite).not.toHaveBeenCalled();
    });

    it("never issues a 307 redirect for the bare app-detail pattern", async () => {
      // Guard test: regression of PLA-1110. A redirect here is what triggers
      // Cloudflare's ERR_QUIC_PROTOCOL_ERROR on RSC prefetch.
      const { proxy } = await import("@/proxy");
      const req = createMockRequest("/shopify/apps/some-app", {
        "app-layout-version": "v1",
      }) as any;
      await proxy(req);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
