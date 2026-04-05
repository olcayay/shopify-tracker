import { describe, it, expect } from "vitest";
import {
  updateAccountSchema,
  addMemberSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  addTrackedAppSchema,
  addTrackedKeywordSchema,
  addCompetitorSchema,
  reorderCompetitorsSchema,
  addKeywordToAppSchema,
  addStarredCategorySchema,
  addStarredFeatureSchema,
  createKeywordTagSchema,
  updateKeywordTagSchema,
  platformRequestSchema,
} from "../../schemas/account.js";

describe("updateAccountSchema", () => {
  it("accepts name only", () => {
    const result = updateAccountSchema.parse({ name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("accepts company only", () => {
    const result = updateAccountSchema.parse({ company: "ACME" });
    expect(result.company).toBe("ACME");
  });

  it("accepts both name and company", () => {
    const result = updateAccountSchema.parse({ name: "A", company: "B" });
    expect(result.name).toBe("A");
    expect(result.company).toBe("B");
  });

  it("rejects name longer than 100 chars", () => {
    expect(() => updateAccountSchema.parse({ name: "x".repeat(101) })).toThrow();
  });

  it("rejects company longer than 200 chars", () => {
    expect(() => updateAccountSchema.parse({ company: "x".repeat(201) })).toThrow();
  });

  it("accepts empty object (both optional)", () => {
    expect(() => updateAccountSchema.parse({})).not.toThrow();
  });
});

describe("addMemberSchema", () => {
  const valid = { email: "user@test.com", name: "User", password: "password123" };

  it("accepts valid data with default role", () => {
    const result = addMemberSchema.parse(valid);
    expect(result.role).toBe("viewer");
  });

  it("accepts editor role", () => {
    const result = addMemberSchema.parse({ ...valid, role: "editor" });
    expect(result.role).toBe("editor");
  });

  it("rejects owner role (only editor/viewer allowed)", () => {
    expect(() => addMemberSchema.parse({ ...valid, role: "owner" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => addMemberSchema.parse({ ...valid, email: "bad" })).toThrow();
  });

  it("rejects password shorter than 8 chars", () => {
    expect(() => addMemberSchema.parse({ ...valid, password: "short" })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => addMemberSchema.parse({ ...valid, name: "" })).toThrow();
  });
});

describe("inviteMemberSchema", () => {
  it("accepts valid invitation with default role", () => {
    const result = inviteMemberSchema.parse({ email: "invite@test.com" });
    expect(result.role).toBe("viewer");
  });

  it("accepts editor role", () => {
    const result = inviteMemberSchema.parse({ email: "invite@test.com", role: "editor" });
    expect(result.role).toBe("editor");
  });

  it("rejects owner role", () => {
    expect(() => inviteMemberSchema.parse({ email: "invite@test.com", role: "owner" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => inviteMemberSchema.parse({ email: "bad" })).toThrow();
  });
});

describe("updateMemberRoleSchema", () => {
  it("accepts editor", () => {
    expect(updateMemberRoleSchema.parse({ role: "editor" }).role).toBe("editor");
  });

  it("accepts viewer", () => {
    expect(updateMemberRoleSchema.parse({ role: "viewer" }).role).toBe("viewer");
  });

  it("rejects owner (cannot promote to owner)", () => {
    expect(() => updateMemberRoleSchema.parse({ role: "owner" })).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => updateMemberRoleSchema.parse({ role: "" })).toThrow();
  });
});

describe("addTrackedAppSchema", () => {
  it("accepts valid slug", () => {
    expect(addTrackedAppSchema.parse({ slug: "my-app" }).slug).toBe("my-app");
  });

  it("rejects empty slug", () => {
    expect(() => addTrackedAppSchema.parse({ slug: "" })).toThrow();
  });

  it("rejects slug over 200 chars", () => {
    expect(() => addTrackedAppSchema.parse({ slug: "x".repeat(201) })).toThrow();
  });
});

describe("addTrackedKeywordSchema", () => {
  it("accepts valid keyword and trackedAppSlug", () => {
    const result = addTrackedKeywordSchema.parse({ keyword: "seo", trackedAppSlug: "my-app" });
    expect(result.keyword).toBe("seo");
    expect(result.trackedAppSlug).toBe("my-app");
  });

  it("rejects missing keyword", () => {
    expect(() => addTrackedKeywordSchema.parse({ trackedAppSlug: "app" })).toThrow();
  });

  it("accepts missing trackedAppSlug (research mode)", () => {
    const result = addTrackedKeywordSchema.parse({ keyword: "seo" });
    expect(result.keyword).toBe("seo");
    expect(result.trackedAppSlug).toBeUndefined();
  });
});

describe("addCompetitorSchema", () => {
  it("accepts valid data", () => {
    const result = addCompetitorSchema.parse({ slug: "comp-app", trackedAppSlug: "my-app" });
    expect(result.slug).toBe("comp-app");
  });

  it("rejects missing slug", () => {
    expect(() => addCompetitorSchema.parse({ trackedAppSlug: "app" })).toThrow();
  });
});

describe("reorderCompetitorsSchema", () => {
  it("accepts array of slugs", () => {
    const result = reorderCompetitorsSchema.parse({ slugs: ["a", "b", "c"] });
    expect(result.slugs).toEqual(["a", "b", "c"]);
  });

  it("rejects empty array", () => {
    expect(() => reorderCompetitorsSchema.parse({ slugs: [] })).toThrow();
  });

  it("rejects missing slugs", () => {
    expect(() => reorderCompetitorsSchema.parse({})).toThrow();
  });
});

describe("addKeywordToAppSchema", () => {
  it("accepts valid keyword", () => {
    expect(addKeywordToAppSchema.parse({ keyword: "seo tools" }).keyword).toBe("seo tools");
  });

  it("rejects empty keyword", () => {
    expect(() => addKeywordToAppSchema.parse({ keyword: "" })).toThrow();
  });
});

describe("addStarredCategorySchema", () => {
  it("accepts valid slug", () => {
    expect(addStarredCategorySchema.parse({ slug: "productivity" }).slug).toBe("productivity");
  });

  it("rejects empty slug", () => {
    expect(() => addStarredCategorySchema.parse({ slug: "" })).toThrow();
  });
});

describe("addStarredFeatureSchema", () => {
  it("accepts valid handle and title", () => {
    const result = addStarredFeatureSchema.parse({ handle: "seo-check", title: "SEO Check" });
    expect(result.handle).toBe("seo-check");
    expect(result.title).toBe("SEO Check");
  });

  it("rejects missing handle", () => {
    expect(() => addStarredFeatureSchema.parse({ title: "T" })).toThrow();
  });

  it("rejects missing title", () => {
    expect(() => addStarredFeatureSchema.parse({ handle: "h" })).toThrow();
  });
});

describe("createKeywordTagSchema", () => {
  it("accepts valid tag with valid color", () => {
    const result = createKeywordTagSchema.parse({ name: "Important", color: "red" });
    expect(result.name).toBe("Important");
    expect(result.color).toBe("red");
  });

  it("accepts all valid colors", () => {
    const colors = ["red", "orange", "amber", "emerald", "cyan", "blue", "violet", "pink", "slate", "rose"];
    for (const color of colors) {
      expect(() => createKeywordTagSchema.parse({ name: "Tag", color })).not.toThrow();
    }
  });

  it("rejects invalid color", () => {
    expect(() => createKeywordTagSchema.parse({ name: "Tag", color: "green" })).toThrow(/color/i);
  });

  it("rejects empty name", () => {
    expect(() => createKeywordTagSchema.parse({ name: "", color: "red" })).toThrow();
  });

  it("rejects name over 50 chars", () => {
    expect(() => createKeywordTagSchema.parse({ name: "x".repeat(51), color: "red" })).toThrow();
  });
});

describe("updateKeywordTagSchema", () => {
  it("accepts color only", () => {
    const result = updateKeywordTagSchema.parse({ color: "blue" });
    expect(result.color).toBe("blue");
  });

  it("accepts name only", () => {
    const result = updateKeywordTagSchema.parse({ name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("accepts both", () => {
    const result = updateKeywordTagSchema.parse({ name: "Updated", color: "blue" });
    expect(result.name).toBe("Updated");
    expect(result.color).toBe("blue");
  });

  it("accepts empty object (both optional)", () => {
    expect(() => updateKeywordTagSchema.parse({})).not.toThrow();
  });
});

describe("platformRequestSchema", () => {
  it("accepts valid platform request", () => {
    const result = platformRequestSchema.parse({ platformName: "Freshdesk" });
    expect(result.platformName).toBe("Freshdesk");
  });

  it("accepts optional marketplaceUrl and notes", () => {
    const result = platformRequestSchema.parse({
      platformName: "Freshdesk",
      marketplaceUrl: "https://freshdesk.com/marketplace",
      notes: "Would be great to track this",
    });
    expect(result.marketplaceUrl).toBe("https://freshdesk.com/marketplace");
    expect(result.notes).toBe("Would be great to track this");
  });

  it("rejects empty platformName", () => {
    expect(() => platformRequestSchema.parse({ platformName: "" })).toThrow();
  });

  it("rejects platformName over 200 chars", () => {
    expect(() => platformRequestSchema.parse({ platformName: "x".repeat(201) })).toThrow();
  });

  it("rejects notes over 2000 chars", () => {
    expect(() =>
      platformRequestSchema.parse({ platformName: "Test", notes: "x".repeat(2001) })
    ).toThrow();
  });
});
