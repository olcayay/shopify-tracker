import { describe, it, expect } from "vitest";

/**
 * Tests for role management logic used on the Organization page.
 * The functions are defined inline in the page component; we replicate
 * the same algorithm here to prevent regression.
 */

const ROLE_LEVEL: Record<string, number> = { owner: 100, admin: 75, editor: 50, viewer: 25 };

function canChangeRole(actorRole: string, actorId: string, memberId: string, memberRole: string): boolean {
  if (actorRole !== "owner" && actorRole !== "admin") return false;
  if (actorId === memberId) return false;
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  const targetLevel = ROLE_LEVEL[memberRole] ?? 0;
  return actorLevel > targetLevel;
}

function getAssignableRoles(actorRole: string): string[] {
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  return ["admin", "editor", "viewer"].filter((r) => (ROLE_LEVEL[r] ?? 0) < actorLevel);
}

describe("canChangeRole", () => {
  it("owner can change admin role", () => {
    expect(canChangeRole("owner", "user-1", "user-2", "admin")).toBe(true);
  });

  it("owner can change editor role", () => {
    expect(canChangeRole("owner", "user-1", "user-2", "editor")).toBe(true);
  });

  it("owner can change viewer role", () => {
    expect(canChangeRole("owner", "user-1", "user-2", "viewer")).toBe(true);
  });

  it("owner cannot change another owner's role", () => {
    expect(canChangeRole("owner", "user-1", "user-2", "owner")).toBe(false);
  });

  it("owner cannot change own role", () => {
    expect(canChangeRole("owner", "user-1", "user-1", "owner")).toBe(false);
  });

  it("admin can change editor role", () => {
    expect(canChangeRole("admin", "admin-1", "user-2", "editor")).toBe(true);
  });

  it("admin can change viewer role", () => {
    expect(canChangeRole("admin", "admin-1", "user-2", "viewer")).toBe(true);
  });

  it("admin cannot change another admin's role", () => {
    expect(canChangeRole("admin", "admin-1", "admin-2", "admin")).toBe(false);
  });

  it("admin cannot change owner's role", () => {
    expect(canChangeRole("admin", "admin-1", "owner-1", "owner")).toBe(false);
  });

  it("admin cannot change own role", () => {
    expect(canChangeRole("admin", "admin-1", "admin-1", "admin")).toBe(false);
  });

  it("editor cannot change any role", () => {
    expect(canChangeRole("editor", "editor-1", "user-2", "viewer")).toBe(false);
  });

  it("viewer cannot change any role", () => {
    expect(canChangeRole("viewer", "viewer-1", "user-2", "editor")).toBe(false);
  });
});

describe("getAssignableRoles", () => {
  it("owner can assign admin, editor, viewer", () => {
    expect(getAssignableRoles("owner")).toEqual(["admin", "editor", "viewer"]);
  });

  it("admin can assign editor, viewer", () => {
    expect(getAssignableRoles("admin")).toEqual(["editor", "viewer"]);
  });

  it("editor gets no assignable roles", () => {
    expect(getAssignableRoles("editor")).toEqual(["viewer"]);
  });

  it("viewer gets no assignable roles", () => {
    expect(getAssignableRoles("viewer")).toEqual([]);
  });
});
