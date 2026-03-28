import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      redirect: vi.fn((url: URL) => ({ type: "redirect", url })),
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

describe("proxy – v1 to v2 app detail redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects v1 app detail to v2", async () => {
    const req = makeRequest("/shopify/apps/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/shopify/apps/v2/formful");
  });

  it("maps v1 keywords tab to v2 visibility/keywords", async () => {
    const req = makeRequest("/shopify/apps/formful/keywords", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/shopify/apps/v2/formful/visibility/keywords");
  });

  it("maps v1 competitors to v2 intel/competitors", async () => {
    const req = makeRequest("/salesforce/apps/test-app/competitors", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/salesforce/apps/v2/test-app/intel/competitors");
  });

  it("does not redirect v2 URLs", async () => {
    const req = makeRequest("/shopify/apps/v2/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    const calls = (NextResponse.redirect as any).mock.calls;
    if (calls.length > 0) {
      expect((calls[0][0] as URL).pathname).not.toContain("/apps/v2/formful");
    }
  });

  it("does not redirect classic URLs", async () => {
    const req = makeRequest("/shopify/apps/classic/formful", { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.abc" });
    await proxy(req);
    const calls = (NextResponse.redirect as any).mock.calls;
    const redirectedToV2 = calls.some((c: any) => (c[0] as URL).pathname.includes("/apps/v2/"));
    expect(redirectedToV2).toBe(false);
  });
});
