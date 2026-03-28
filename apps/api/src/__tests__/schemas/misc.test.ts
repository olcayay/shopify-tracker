import { describe, it, expect } from "vitest";
import { slugsBodySchema } from "../../schemas/apps.js";
import { acceptInvitationSchema } from "../../schemas/invitations.js";
import { ensureKeywordSchema, opportunitySchema } from "../../schemas/keywords.js";

describe("slugsBodySchema (apps)", () => {
  it("accepts valid array of slugs", () => {
    const result = slugsBodySchema.parse({ slugs: ["app-a", "app-b"] });
    expect(result.slugs).toEqual(["app-a", "app-b"]);
  });

  it("rejects empty array", () => {
    expect(() => slugsBodySchema.parse({ slugs: [] })).toThrow();
  });

  it("rejects array with empty string slug", () => {
    expect(() => slugsBodySchema.parse({ slugs: [""] })).toThrow();
  });

  it("rejects array over 500 items", () => {
    const slugs = Array.from({ length: 501 }, (_, i) => `app-${i}`);
    expect(() => slugsBodySchema.parse({ slugs })).toThrow(/500/);
  });

  it("accepts exactly 500 items", () => {
    const slugs = Array.from({ length: 500 }, (_, i) => `app-${i}`);
    expect(() => slugsBodySchema.parse({ slugs })).not.toThrow();
  });
});

describe("acceptInvitationSchema", () => {
  it("accepts valid data", () => {
    const result = acceptInvitationSchema.parse({ name: "John", password: "password123" });
    expect(result.name).toBe("John");
  });

  it("rejects empty name", () => {
    expect(() => acceptInvitationSchema.parse({ name: "", password: "password123" })).toThrow();
  });

  it("rejects name over 100 chars", () => {
    expect(() =>
      acceptInvitationSchema.parse({ name: "x".repeat(101), password: "password123" })
    ).toThrow();
  });

  it("rejects password shorter than 8 chars", () => {
    expect(() => acceptInvitationSchema.parse({ name: "John", password: "short" })).toThrow();
  });
});

describe("ensureKeywordSchema", () => {
  it("accepts valid keyword", () => {
    expect(ensureKeywordSchema.parse({ keyword: "seo tools" }).keyword).toBe("seo tools");
  });

  it("trims whitespace", () => {
    expect(ensureKeywordSchema.parse({ keyword: "  seo  " }).keyword).toBe("seo");
  });

  it("rejects empty keyword", () => {
    expect(() => ensureKeywordSchema.parse({ keyword: "" })).toThrow();
  });

  it("rejects whitespace-only keyword (after trim)", () => {
    expect(() => ensureKeywordSchema.parse({ keyword: "   " })).toThrow();
  });

  it("rejects keyword over 200 chars", () => {
    expect(() => ensureKeywordSchema.parse({ keyword: "x".repeat(201) })).toThrow();
  });
});

describe("opportunitySchema", () => {
  it("accepts valid array of slugs", () => {
    const result = opportunitySchema.parse({ slugs: ["app-a", "app-b"] });
    expect(result.slugs).toEqual(["app-a", "app-b"]);
  });

  it("rejects empty array", () => {
    expect(() => opportunitySchema.parse({ slugs: [] })).toThrow();
  });

  it("rejects array over 100 items", () => {
    const slugs = Array.from({ length: 101 }, (_, i) => `app-${i}`);
    expect(() => opportunitySchema.parse({ slugs })).toThrow(/100/);
  });

  it("accepts exactly 100 items", () => {
    const slugs = Array.from({ length: 100 }, (_, i) => `app-${i}`);
    expect(() => opportunitySchema.parse({ slugs })).not.toThrow();
  });
});
