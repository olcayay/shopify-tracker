import { describe, it, expect } from "vitest";

/**
 * Tests for invitation creation error differentiation logic.
 * Updated for PLA-940: existing users in other accounts can now be invited
 * (transfer on acceptance), unless they are the sole owner of their account.
 */

interface ExistingUserCheck {
  existingUser: { id: string; accountId: string; role: string; isSoleOwner: boolean } | null;
  invitingAccountId: string;
}

function getInvitationError(
  check: ExistingUserCheck
): { error: string; code: string } | null {
  if (!check.existingUser) return null;

  if (check.existingUser.accountId === check.invitingAccountId) {
    return {
      error: "This user is already a member of your organization",
      code: "ALREADY_MEMBER",
    };
  }

  // Sole owner cannot be transferred
  if (check.existingUser.role === "owner" && check.existingUser.isSoleOwner) {
    return {
      error: "This user is the sole owner of another organization. They must transfer ownership before they can be invited.",
      code: "SOLE_OWNER",
    };
  }

  // Allow invitation — transfer on acceptance
  return null;
}

describe("Invitation creation error differentiation", () => {
  it("returns null when user does not exist", () => {
    expect(
      getInvitationError({ existingUser: null, invitingAccountId: "account-1" })
    ).toBeNull();
  });

  it("returns ALREADY_MEMBER when user is in the same account", () => {
    const result = getInvitationError({
      existingUser: { id: "u1", accountId: "account-1", role: "editor", isSoleOwner: false },
      invitingAccountId: "account-1",
    });
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ALREADY_MEMBER");
  });

  it("allows invitation when user is in a different account (non-owner)", () => {
    const result = getInvitationError({
      existingUser: { id: "u1", accountId: "account-2", role: "editor", isSoleOwner: false },
      invitingAccountId: "account-1",
    });
    expect(result).toBeNull();
  });

  it("allows invitation when user is owner but not sole owner", () => {
    const result = getInvitationError({
      existingUser: { id: "u1", accountId: "account-2", role: "owner", isSoleOwner: false },
      invitingAccountId: "account-1",
    });
    expect(result).toBeNull();
  });

  it("blocks invitation when user is sole owner of another account", () => {
    const result = getInvitationError({
      existingUser: { id: "u1", accountId: "account-2", role: "owner", isSoleOwner: true },
      invitingAccountId: "account-1",
    });
    expect(result).not.toBeNull();
    expect(result!.code).toBe("SOLE_OWNER");
    expect(result!.error).toContain("sole owner");
  });
});
