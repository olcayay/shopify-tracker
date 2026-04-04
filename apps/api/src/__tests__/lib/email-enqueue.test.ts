import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn().mockResolvedValue({ id: "job-1" });

vi.mock("bullmq", () => {
  const MockQueue = vi.fn(function (this: any) {
    this.add = mockAdd;
    this.close = vi.fn();
  });
  return { Queue: MockQueue };
});

const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendLoginAlertEmail,
  send2FAEmail,
} = await import("../../lib/email-enqueue.js");

describe("email-enqueue helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendWelcomeEmail enqueues an email_welcome job", async () => {
    const jobId = await sendWelcomeEmail("user@test.com", "Alice", {
      userId: "u1",
      accountId: "a1",
    });

    expect(jobId).toBe("job-1");
    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_welcome",
      expect.objectContaining({
        type: "email_welcome",
        to: "user@test.com",
        name: "Alice",
        userId: "u1",
        accountId: "a1",
        payload: { name: "Alice" },
      }),
      expect.any(Object)
    );
  });

  it("sendPasswordResetEmail includes reset URL with token", async () => {
    process.env.DASHBOARD_URL = "https://appranks.io";

    await sendPasswordResetEmail("user@test.com", "token123", "Alice");

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_password_reset",
      expect.objectContaining({
        type: "email_password_reset",
        to: "user@test.com",
        payload: expect.objectContaining({
          name: "Alice",
          resetUrl: "https://appranks.io/reset-password?token=token123",
        }),
      }),
      expect.any(Object)
    );

    delete process.env.DASHBOARD_URL;
  });

  it("sendVerificationEmail includes verification URL", async () => {
    process.env.DASHBOARD_URL = "https://appranks.io";

    await sendVerificationEmail("user@test.com", "vtoken", "Bob");

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_verification",
      expect.objectContaining({
        type: "email_verification",
        payload: expect.objectContaining({
          verificationUrl: "https://appranks.io/verify-email?token=vtoken",
        }),
      }),
      expect.any(Object)
    );

    delete process.env.DASHBOARD_URL;
  });

  it("sendInvitationEmail includes accept URL and role", async () => {
    process.env.DASHBOARD_URL = "https://appranks.io";

    await sendInvitationEmail(
      "new@test.com",
      "Charlie",
      "Acme Corp",
      "inv-token",
      { role: "member", accountId: "a1" }
    );

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_invitation",
      expect.objectContaining({
        type: "email_invitation",
        to: "new@test.com",
        payload: expect.objectContaining({
          inviterName: "Charlie",
          accountName: "Acme Corp",
          acceptUrl: "https://appranks.io/invite/accept/inv-token",
          role: "member",
        }),
      }),
      expect.any(Object)
    );

    delete process.env.DASHBOARD_URL;
  });

  it("sendLoginAlertEmail includes device and location", async () => {
    await sendLoginAlertEmail("user@test.com", "Alice", "Chrome on macOS", {
      location: "Istanbul",
      ip: "1.2.3.4",
    });

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_login_alert",
      expect.objectContaining({
        type: "email_login_alert",
        payload: expect.objectContaining({
          name: "Alice",
          device: "Chrome on macOS",
          location: "Istanbul",
          ip: "1.2.3.4",
        }),
      }),
      expect.any(Object)
    );
  });

  it("send2FAEmail enqueues with priority 1", async () => {
    await send2FAEmail("user@test.com", "123456", "Alice");

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_2fa_code",
      expect.objectContaining({
        type: "email_2fa_code",
        payload: expect.objectContaining({
          code: "123456",
          name: "Alice",
        }),
      }),
      expect.objectContaining({ priority: 1 })
    );
  });
});
