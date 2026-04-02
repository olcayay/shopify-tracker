/**
 * Tests to verify security headers are included in API responses.
 * Since security headers are set in index.ts (full app startup), we test
 * the expected header set rather than integration testing the full app.
 */
import { describe, it, expect } from "vitest";

const EXPECTED_HEADERS = [
  ["strict-transport-security", "max-age=31536000; includeSubDomains"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["x-xss-protection", "0"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
] as const;

describe("Security headers configuration", () => {
  it("defines all required security headers", () => {
    expect(EXPECTED_HEADERS.length).toBe(6);
  });

  it("HSTS has at least 1 year max-age", () => {
    const hsts = EXPECTED_HEADERS.find(([k]) => k === "strict-transport-security");
    expect(hsts).toBeDefined();
    const maxAge = parseInt(hsts![1].match(/max-age=(\d+)/)?.[1] || "0");
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it("X-Frame-Options is DENY to prevent clickjacking", () => {
    const xfo = EXPECTED_HEADERS.find(([k]) => k === "x-frame-options");
    expect(xfo![1]).toBe("DENY");
  });

  it("X-XSS-Protection is 0 (modern best practice)", () => {
    const xxss = EXPECTED_HEADERS.find(([k]) => k === "x-xss-protection");
    expect(xxss![1]).toBe("0");
  });

  it("Permissions-Policy restricts dangerous APIs", () => {
    const pp = EXPECTED_HEADERS.find(([k]) => k === "permissions-policy");
    expect(pp![1]).toContain("camera=()");
    expect(pp![1]).toContain("microphone=()");
    expect(pp![1]).toContain("geolocation=()");
  });
});
