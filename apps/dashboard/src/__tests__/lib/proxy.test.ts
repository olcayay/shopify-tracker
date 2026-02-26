import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server
const mockRedirect = vi.fn((url: URL) => ({
  type: "redirect",
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
    next: () => mockNext(),
  },
}));

function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
  return {
    nextUrl: {
      pathname,
    },
    url: `http://localhost:3000${pathname}`,
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

  it("redirects unauthenticated user from /overview to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/overview") as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("redirects unauthenticated user from /apps to /login", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/apps") as any;
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

  it("allows authenticated user to access /overview with valid token", async () => {
    const { proxy } = await import("@/proxy");
    // Create a valid JWT payload (not expired, not system admin)
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600, isSystemAdmin: false };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    const req = createMockRequest("/overview", { access_token: token }) as any;
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
    const req = createMockRequest("/overview", { access_token: token }) as any;
    await proxy(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("redirects to /login when token has invalid format", async () => {
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/overview", { access_token: "invalid-token" }) as any;
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

  it("does not match / as prefix for /overview", async () => {
    // Ensure "/" in PUBLIC_PATHS doesn't accidentally match "/overview"
    const { proxy } = await import("@/proxy");
    const req = createMockRequest("/overview") as any;
    await proxy(req);
    // Should NOT be treated as public - should try to validate token
    expect(mockRedirect).toHaveBeenCalled();
  });
});
