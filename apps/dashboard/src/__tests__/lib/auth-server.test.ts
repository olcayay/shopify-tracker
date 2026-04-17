import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: any[]) => mockCookieGet(...args),
  }),
}));

import { isSystemAdminServer } from "@/lib/auth-server";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

describe("isSystemAdminServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the React cache between tests by re-importing wouldn't work,
    // but since vitest re-runs, each `it` gets a fresh module scope via clearAllMocks.
  });

  it("returns false when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const result = await isSystemAdminServer();
    expect(result).toBe(false);
  });

  it("returns false for malformed JWT", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-jwt" });
    const result = await isSystemAdminServer();
    expect(result).toBe(false);
  });

  it("returns true when isSystemAdmin is true", async () => {
    const token = makeJwt({ isSystemAdmin: true, sub: "user1" });
    mockCookieGet.mockReturnValue({ value: token });
    const result = await isSystemAdminServer();
    expect(result).toBe(true);
  });

  it("returns false when isSystemAdmin is missing", async () => {
    const token = makeJwt({ sub: "user1" });
    mockCookieGet.mockReturnValue({ value: token });
    const result = await isSystemAdminServer();
    expect(result).toBe(false);
  });

  it("returns false when isSystemAdmin is false", async () => {
    const token = makeJwt({ isSystemAdmin: false, sub: "user1" });
    mockCookieGet.mockReturnValue({ value: token });
    const result = await isSystemAdminServer();
    expect(result).toBe(false);
  });
});
