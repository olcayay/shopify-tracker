import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the eligibility module
vi.mock("../eligibility.js", () => ({
  checkEligibility: vi.fn(),
}));

// Mock the email-logger module
vi.mock("../email-logger.js", () => ({
  logEmailAttempt: vi.fn().mockResolvedValue("log-id-1"),
  updateEmailStatus: vi.fn().mockResolvedValue(undefined),
}));

// Mock the mailer
vi.mock("../../mailer.js", () => ({
  sendDigest: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from "../pipeline.js";
import { checkEligibility } from "../eligibility.js";
import { logEmailAttempt, updateEmailStatus } from "../email-logger.js";

const mockDb = {};

describe("Email send pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when not eligible", async () => {
    vi.mocked(checkEligibility).mockResolvedValue({
      eligible: false,
      skipReason: "user opted out",
    });

    const result = await sendEmail({
      db: mockDb,
      emailType: "daily_digest",
      userId: "user-1",
      accountId: "acc-1",
      recipientEmail: "test@example.com",
      subject: "Daily Digest",
      htmlBody: "<p>Hello</p>",
    });

    expect(result.sent).toBe(false);
    expect(result.skipReason).toBe("user opted out");
    expect(logEmailAttempt).not.toHaveBeenCalled();
  });

  it("sends when eligible and logs to DB", async () => {
    vi.mocked(checkEligibility).mockResolvedValue({ eligible: true });
    const mockSendFn = vi.fn().mockResolvedValue({ messageId: "msg-123" });

    const result = await sendEmail({
      db: mockDb,
      emailType: "daily_digest",
      userId: "user-1",
      accountId: "acc-1",
      recipientEmail: "test@example.com",
      subject: "Daily Digest",
      htmlBody: "<p>Hello</p>",
      sendFn: mockSendFn,
      skipTracking: true,
    });

    expect(result.sent).toBe(true);
    expect(result.logId).toBe("log-id-1");
    expect(logEmailAttempt).toHaveBeenCalledOnce();
    expect(mockSendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "Daily Digest",
        html: "<p>Hello</p>",
      })
    );
    expect(updateEmailStatus).toHaveBeenCalledWith(
      mockDb, "log-id-1", "sent", { messageId: "msg-123" }
    );
  });

  it("logs failure when send throws", async () => {
    vi.mocked(checkEligibility).mockResolvedValue({ eligible: true });
    const mockSendFn = vi.fn().mockRejectedValue(new Error("SMTP timeout"));

    const result = await sendEmail({
      db: mockDb,
      emailType: "daily_digest",
      userId: "user-1",
      accountId: "acc-1",
      recipientEmail: "test@example.com",
      subject: "Daily Digest",
      htmlBody: "<p>Hello</p>",
      sendFn: mockSendFn,
      skipTracking: true,
    });

    expect(result.sent).toBe(false);
    expect(result.skipReason).toContain("SMTP timeout");
    expect(updateEmailStatus).toHaveBeenCalledWith(
      mockDb, "log-id-1", "failed", { errorMessage: "SMTP timeout" }
    );
  });

  it("passes deduplication key to eligibility and data snapshot", async () => {
    vi.mocked(checkEligibility).mockResolvedValue({ eligible: true });
    const mockSendFn = vi.fn().mockResolvedValue({});

    await sendEmail({
      db: mockDb,
      emailType: "ranking_alert",
      userId: "user-1",
      accountId: "acc-1",
      recipientEmail: "test@example.com",
      subject: "Ranking Alert",
      htmlBody: "<p>Alert</p>",
      deduplicationKey: "ranking:app1:cat1",
      sendFn: mockSendFn,
      skipTracking: true,
    });

    expect(checkEligibility).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      deduplicationKey: "ranking:app1:cat1",
    }));
    expect(logEmailAttempt).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      dataSnapshot: expect.objectContaining({ deduplicationKey: "ranking:app1:cat1" }),
    }));
  });
});
