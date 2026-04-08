import { describe, it, expect } from "vitest";

/**
 * Tests for invitation error differentiation logic (PLA-941).
 * Verifies that the correct error code and message are returned
 * based on whether the existing user is in the same or different account.
 */

interface ExistingUserCheck {
  existingUser: { id: string; accountId: string } | null;
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

  return {
    error: "This email is registered with another organization. Cross-account invitations are not yet supported.",
    code: "EXISTING_USER_OTHER_ACCOUNT",
  };
}

describe("Invitation error differentiation", () => {
  it("returns null when user does not exist", () => {
    expect(
      getInvitationError({
        existingUser: null,
        invitingAccountId: "account-1",
      })
    ).toBeNull();
  });

  it("returns ALREADY_MEMBER when user is in the same account", () => {
    const result = getInvitationError({
      existingUser: { id: "user-1", accountId: "account-1" },
      invitingAccountId: "account-1",
    });
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ALREADY_MEMBER");
    expect(result!.error).toContain("already a member");
  });

  it("returns EXISTING_USER_OTHER_ACCOUNT when user is in a different account", () => {
    const result = getInvitationError({
      existingUser: { id: "user-1", accountId: "account-2" },
      invitingAccountId: "account-1",
    });
    expect(result).not.toBeNull();
    expect(result!.code).toBe("EXISTING_USER_OTHER_ACCOUNT");
    expect(result!.error).toContain("another organization");
  });

  it("correctly distinguishes same vs different account IDs", () => {
    const sameAccount = getInvitationError({
      existingUser: { id: "u1", accountId: "acc-abc" },
      invitingAccountId: "acc-abc",
    });
    const diffAccount = getInvitationError({
      existingUser: { id: "u1", accountId: "acc-xyz" },
      invitingAccountId: "acc-abc",
    });

    expect(sameAccount!.code).toBe("ALREADY_MEMBER");
    expect(diffAccount!.code).toBe("EXISTING_USER_OTHER_ACCOUNT");
  });
});
