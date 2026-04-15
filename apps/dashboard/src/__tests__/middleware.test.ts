import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { proxy, PUBLIC_PATHS } from "@/proxy";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      redirect: vi.fn((url: URL) => ({ type: "redirect", url })),
      rewrite: vi.fn((url: URL) => ({ type: "rewrite", url })),
      next: vi.fn(() => ({ type: "next" })),
    },
  };
});

function makeRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const req = new NextRequest(url);
  for (const [key, value] of Object.entries(cookies)) {
    req.cookies.set(key, value);
  }
  return req;
}

describe("proxy – root redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects authenticated users from / to /overview", async () => {
    const req = makeRequest("/", { access_token: "some-token" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/overview");
  });

  it("does not redirect anonymous visitors from /", async () => {
    const req = makeRequest("/");
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });

  it("does not redirect authenticated users on other public paths", async () => {
    const req = makeRequest("/terms", { access_token: "some-token" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });
});

describe("proxy – auth routes are public (PLA-1093)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const path of ["/forgot-password", "/reset-password", "/verify-email"]) {
    it(`does not redirect anonymous ${path} to /login`, async () => {
      const req = makeRequest(path);
      await proxy(req);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });
  }

  it("does not redirect /reset-password?token=... (preserves token query)", async () => {
    const req = makeRequest("/reset-password?token=abc123");
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });

  it("does not redirect authenticated users on /forgot-password (not treated as login/register)", async () => {
    const req = makeRequest("/forgot-password", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("PUBLIC_PATHS covers every directory under src/app/(auth) (structural guard)", () => {
    const authDir = join(__dirname, "..", "app", "(auth)");
    const entries = readdirSync(authDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/${e.name}`);
    for (const route of entries) {
      expect(PUBLIC_PATHS).toContain(route);
    }
  });
});

describe("proxy – cross-platform pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not redirect /apps (cross-platform page)", async () => {
    const req = makeRequest("/apps", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });

  it("does not redirect /keywords (cross-platform page)", async () => {
    const req = makeRequest("/keywords", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });

  it("does not redirect /competitors (cross-platform page)", async () => {
    const req = makeRequest("/competitors", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
  });

  it("still redirects /apps/some-slug to /shopify/apps/some-slug (legacy path)", async () => {
    const req = makeRequest("/apps/some-slug", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/shopify/apps/some-slug");
  });

  it("still redirects /keywords/some-slug to /shopify/keywords/some-slug (legacy path)", async () => {
    const req = makeRequest("/keywords/some-slug", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/shopify/keywords/some-slug");
  });
});

describe("proxy – cross-platform developer profile rewrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites /developers/{slug} to /developer/{slug}", async () => {
    const req = makeRequest("/developers/jotform", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.rewrite).toHaveBeenCalledTimes(1);
    const rewriteUrl = (NextResponse.rewrite as any).mock.calls[0][0] as URL;
    expect(rewriteUrl.pathname).toBe("/developer/jotform");
  });

  it("does not rewrite /developers (list page)", async () => {
    const req = makeRequest("/developers", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });

  it("does not rewrite /{platform}/developers/{slug}", async () => {
    const req = makeRequest("/shopify/developers/jotform", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.rewrite).not.toHaveBeenCalled();
  });
});

describe("proxy – bare app detail routing (PLA-1110: rewrite, not redirect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // PLA-1110: a 307 redirect here triggers ERR_QUIC_PROTOCOL_ERROR at
  // Cloudflare on the RSC prefetch. Rewrites keep the URL stable and avoid
  // the second HTTP/3 round-trip. These tests guard the rewrite branch.
  it("rewrites bare app detail to v2 (default, no cookie)", async () => {
    const req = makeRequest("/shopify/apps/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.rewrite).toHaveBeenCalledTimes(1);
    const rewriteUrl = (NextResponse.rewrite as any).mock.calls[0][0] as URL;
    expect(rewriteUrl.pathname).toBe("/shopify/apps/v2/formful");
  });

  it("maps v1 keywords tab to v2 visibility/keywords on rewrite", async () => {
    const req = makeRequest("/shopify/apps/formful/keywords", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.rewrite).toHaveBeenCalledTimes(1);
    const rewriteUrl = (NextResponse.rewrite as any).mock.calls[0][0] as URL;
    expect(rewriteUrl.pathname).toBe("/shopify/apps/v2/formful/visibility/keywords");
  });

  it("maps v1 competitors to v2 intel/competitors on rewrite", async () => {
    const req = makeRequest("/salesforce/apps/test-app/competitors", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.rewrite).toHaveBeenCalledTimes(1);
    const rewriteUrl = (NextResponse.rewrite as any).mock.calls[0][0] as URL;
    expect(rewriteUrl.pathname).toBe("/salesforce/apps/v2/test-app/intel/competitors");
  });

  it("rewrites to v1 when app-layout-version=v1 cookie is set", async () => {
    const req = makeRequest("/shopify/apps/formful", {
      access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc",
      "app-layout-version": "v1",
    });
    await proxy(req);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.rewrite).toHaveBeenCalledTimes(1);
    const rewriteUrl = (NextResponse.rewrite as any).mock.calls[0][0] as URL;
    expect(rewriteUrl.pathname).toBe("/shopify/apps/v1/formful");
  });

  it("does not rewrite already-prefixed v2 URLs", async () => {
    const req = makeRequest("/shopify/apps/v2/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    const rewriteCalls = (NextResponse.rewrite as any).mock.calls;
    expect(rewriteCalls.length).toBe(0);
  });

  it("does not rewrite already-prefixed v1 URLs", async () => {
    const req = makeRequest("/shopify/apps/v1/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    const rewriteCalls = (NextResponse.rewrite as any).mock.calls;
    expect(rewriteCalls.length).toBe(0);
  });

  it("NEVER issues a 307 redirect for bare app detail (regression guard for PLA-1110)", async () => {
    const req = makeRequest("/shopify/apps/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    // A redirect here would fire for RSC prefetches too, causing Cloudflare
    // to fail the HTTP/3 redirected request with ERR_QUIC_PROTOCOL_ERROR.
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});
