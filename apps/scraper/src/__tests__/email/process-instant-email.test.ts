import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { InstantEmailJobData } from "@appranks/shared";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
vi.mock("../../email/mailer.js", () => ({
  sendMail: (...args: any[]) => mockSendMail(...args),
}));

const mockLogEmailAttempt = vi.fn().mockResolvedValue("log-id-1");
const mockUpdateEmailStatus = vi.fn().mockResolvedValue(undefined);
vi.mock("../../email/email-logger.js", () => ({
  logEmailAttempt: (...args: any[]) => mockLogEmailAttempt(...args),
  updateEmailStatus: (...args: any[]) => mockUpdateEmailStatus(...args),
}));

const { processInstantEmail, templateRenderers } = await import(
  "../../email/process-instant-email.js"
);

function makeJob(data: InstantEmailJobData): Job<InstantEmailJobData> {
  return {
    id: "job-1",
    data,
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as unknown as Job<InstantEmailJobData>;
}

const mockDb = {} as any;

describe("templateRenderers", () => {
  it("has renderers for all 6 instant email types", () => {
    const types = [
      "email_password_reset",
      "email_verification",
      "email_welcome",
      "email_invitation",
      "email_login_alert",
      "email_2fa_code",
    ];
    for (const type of types) {
      expect(templateRenderers[type]).toBeDefined();
      expect(typeof templateRenderers[type]).toBe("function");
    }
  });

  it("password reset renderer produces valid HTML", () => {
    const result = templateRenderers.email_password_reset({
      name: "Test",
      resetUrl: "https://example.com/reset",
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("https://example.com/reset");
  });

  it("verification renderer produces valid HTML", () => {
    const result = templateRenderers.email_verification({
      name: "Test",
      verificationUrl: "https://example.com/verify",
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toContain("https://example.com/verify");
  });

  it("welcome renderer produces valid HTML", () => {
    const result = templateRenderers.email_welcome({ name: "Test" });
    expect(result.subject).toBe("Welcome to AppRanks!");
    expect(result.html).toContain("Hi Test");
  });

  it("invitation renderer produces valid HTML", () => {
    const result = templateRenderers.email_invitation({
      inviterName: "Alice",
      accountName: "Team X",
      acceptUrl: "https://example.com/accept",
    });
    expect(result.subject).toContain("Alice");
    expect(result.html).toContain("Team X");
  });

  it("login alert renderer produces valid HTML", () => {
    const result = templateRenderers.email_login_alert({
      name: "Test",
      device: "Chrome",
      loginTime: new Date().toISOString(),
      secureAccountUrl: "https://example.com/secure",
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toContain("Chrome");
  });

  it("2FA code renderer produces valid HTML", () => {
    const result = templateRenderers.email_2fa_code({
      name: "Test",
      code: "123456",
    });
    expect(result.subject).toContain("123456");
    expect(result.html).toContain("123456");
  });
});

describe("processInstantEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders template, logs, sends, and updates status on success", async () => {
    const job = makeJob({
      type: "email_password_reset",
      to: "user@test.com",
      name: "Alice",
      payload: { name: "Alice", resetUrl: "https://example.com/reset" },
      createdAt: new Date().toISOString(),
    });

    await processInstantEmail(job, mockDb);

    // Logged attempt
    expect(mockLogEmailAttempt).toHaveBeenCalledOnce();
    expect(mockLogEmailAttempt).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      emailType: "email_password_reset",
      recipientEmail: "user@test.com",
    }));

    // Sent email
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledWith(
      "user@test.com",
      expect.any(String),
      expect.stringContaining("<!DOCTYPE html>")
    );

    // Updated status to sent
    expect(mockUpdateEmailStatus).toHaveBeenCalledWith(
      mockDb,
      "log-id-1",
      "sent",
      { messageId: "msg-123" }
    );
  });

  it("updates status to failed and re-throws on send error", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP timeout"));

    const job = makeJob({
      type: "email_verification",
      to: "user@test.com",
      payload: { name: "Bob", verificationUrl: "https://example.com/verify" },
      createdAt: new Date().toISOString(),
    });

    await expect(processInstantEmail(job, mockDb)).rejects.toThrow("SMTP timeout");

    expect(mockUpdateEmailStatus).toHaveBeenCalledWith(
      mockDb,
      "log-id-1",
      "failed",
      { errorMessage: "Error: SMTP timeout" }
    );
  });

  it("throws for unknown email type", async () => {
    const job = makeJob({
      type: "email_unknown" as any,
      to: "user@test.com",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    await expect(processInstantEmail(job, mockDb)).rejects.toThrow(
      "Unknown instant email type: email_unknown"
    );
  });
});
