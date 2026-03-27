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
