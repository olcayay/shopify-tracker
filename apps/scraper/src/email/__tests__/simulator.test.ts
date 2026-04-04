import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateEmail, simulateBulkEmail } from "../simulator.js";

// Mock eligibility
vi.mock("../eligibility.js", () => ({
  checkEligibility: vi.fn(),
}));

const { checkEligibility } = await import("../eligibility.js");
const mockCheckEligibility = vi.mocked(checkEligibility);

describe("simulateEmail", () => {
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns wouldSend=true when eligible", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateEmail(mockDb, {
      emailType: "email_welcome",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
      payload: { name: "Test User" },
    });

    expect(result.wouldSend).toBe(true);
    expect(result.eligibility.eligible).toBe(true);
    expect(result.recipient).toBe("user@test.com");
    expect(result.emailType).toBe("email_welcome");
  });

  it("returns wouldSend=false when ineligible", async () => {
    mockCheckEligibility.mockResolvedValue({
      eligible: false,
      skipReason: "user opted out",
    });

    const result = await simulateEmail(mockDb, {
      emailType: "email_daily_digest",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
    });

    expect(result.wouldSend).toBe(false);
    expect(result.eligibility.skipReason).toBe("user opted out");
  });

  it("renders template when payload provided for instant email", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateEmail(mockDb, {
      emailType: "email_password_reset",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
      payload: {
        name: "Test User",
        resetUrl: "https://example.com/reset?token=abc",
      },
    });

    expect(result.subject).toBeDefined();
    expect(result.htmlPreview).toBeDefined();
    expect(result.htmlPreview).toContain("Reset");
    expect(result.metadata.templateFound).toBe(true);
    expect(result.metadata.estimatedSizeBytes).toBeGreaterThan(0);
  });

  it("reports unsubscribe header for non-critical emails", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateEmail(mockDb, {
      emailType: "email_welcome",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
      payload: { name: "Test" },
    });

    expect(result.metadata.hasUnsubscribeHeader).toBe(true);
  });

  it("reports no unsubscribe header for critical emails", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateEmail(mockDb, {
      emailType: "email_password_reset",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
      payload: { name: "Test", resetUrl: "https://example.com" },
    });

    expect(result.metadata.hasUnsubscribeHeader).toBe(false);
  });

  it("handles unknown email type gracefully", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateEmail(mockDb, {
      emailType: "email_unknown_type",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
    });

    expect(result.wouldSend).toBe(true);
    expect(result.metadata.templateFound).toBe(false);
    expect(result.subject).toBeUndefined();
  });
});

describe("simulateBulkEmail", () => {
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts eligible and ineligible users", async () => {
    mockCheckEligibility
      .mockResolvedValueOnce({ eligible: true })
      .mockResolvedValueOnce({ eligible: false, skipReason: "user opted out" })
      .mockResolvedValueOnce({ eligible: true })
      .mockResolvedValueOnce({ eligible: false, skipReason: "frequency limit" });

    const result = await simulateBulkEmail(mockDb, {
      emailType: "email_daily_digest",
      users: [
        { userId: "u1", accountId: "a1", email: "a@test.com", name: "A" },
        { userId: "u2", accountId: "a1", email: "b@test.com", name: "B" },
        { userId: "u3", accountId: "a1", email: "c@test.com", name: "C" },
        { userId: "u4", accountId: "a1", email: "d@test.com", name: "D" },
      ],
    });

    expect(result.totalUsers).toBe(4);
    expect(result.eligibleCount).toBe(2);
    expect(result.ineligibleCount).toBe(2);
    expect(result.ineligibleBreakdown["user opted out"]).toBe(1);
    expect(result.ineligibleBreakdown["frequency limit"]).toBe(1);
  });

  it("limits sample previews to requested count", async () => {
    mockCheckEligibility.mockResolvedValue({ eligible: true });

    const result = await simulateBulkEmail(mockDb, {
      emailType: "email_welcome",
      users: Array.from({ length: 10 }, (_, i) => ({
        userId: `u${i}`,
        accountId: "a1",
        email: `user${i}@test.com`,
        name: `User ${i}`,
      })),
      sampleCount: 2,
    });

    expect(result.samplePreviews).toHaveLength(2);
    expect(result.eligibleCount).toBe(10);
  });
});
