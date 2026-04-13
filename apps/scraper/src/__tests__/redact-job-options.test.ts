import { describe, it, expect } from "vitest";
import { redactJobOptions } from "../process-job.js";

describe("redactJobOptions (PLA-1068)", () => {
  it("returns null for non-objects", () => {
    expect(redactJobOptions(null)).toBeNull();
    expect(redactJobOptions(undefined)).toBeNull();
    expect(redactJobOptions("string")).toBeNull();
    expect(redactJobOptions(42)).toBeNull();
  });

  it("preserves plain values", () => {
    const out = redactJobOptions({ scope: "all", force: true, pages: 10 });
    expect(out).toEqual({ scope: "all", force: true, pages: 10 });
  });

  it("redacts keys whose name matches the secret pattern", () => {
    const out = redactJobOptions({
      apiKey: "secret-123",
      sessionToken: "abc",
      password: "pw",
      authHeader: "Bearer xyz",
      cookieJar: "session=...",
      bearerToken: "abc",
      // safe keys stay
      scope: "all",
      pages: "first",
    });
    expect(out?.apiKey).toBe("[redacted]");
    expect(out?.sessionToken).toBe("[redacted]");
    expect(out?.password).toBe("[redacted]");
    expect(out?.authHeader).toBe("[redacted]");
    expect(out?.cookieJar).toBe("[redacted]");
    expect(out?.bearerToken).toBe("[redacted]");
    expect(out?.scope).toBe("all");
    expect(out?.pages).toBe("first");
  });

  it("collapses arrays to a length descriptor", () => {
    const out = redactJobOptions({ slugs: ["a", "b", "c"] });
    expect(out?.slugs).toBe("[array len=3]");
  });

  it("recurses into nested objects and redacts inside them too", () => {
    const out = redactJobOptions({
      headers: { Authorization: "Bearer xxx", Accept: "application/json" },
    });
    expect((out?.headers as Record<string, unknown>).Authorization).toBe("[redacted]");
    expect((out?.headers as Record<string, unknown>).Accept).toBe("application/json");
  });

  it("keeps a stable shape across runs (no field reordering side effects)", () => {
    const input = { scope: "all", force: false, pages: 1 };
    expect(redactJobOptions(input)).toEqual(input);
  });
});
