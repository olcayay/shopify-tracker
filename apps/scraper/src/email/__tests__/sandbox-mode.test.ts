import { describe, it, expect, vi, beforeEach } from "vitest";

describe("email sandbox mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("does not redirect when sandbox mode is off", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@test.com");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("SMTP_FROM", "noreply@test.com");
    vi.stubEnv("EMAIL_SANDBOX_MODE", "false");
    vi.stubEnv("NODE_ENV", "test");

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-1" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: mockSendMail,
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../mailer.js");
    await sendMail("real@user.com", "Hello", "<p>Hi</p>");

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "real@user.com",
        subject: "Hello",
      })
    );
    _resetMailerState();
  });

  it("redirects to sandbox recipient when sandbox mode is on", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@test.com");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("SMTP_FROM", "noreply@test.com");
    vi.stubEnv("EMAIL_SANDBOX_MODE", "true");
    vi.stubEnv("EMAIL_SANDBOX_RECIPIENT", "sandbox@test.com");
    vi.stubEnv("NODE_ENV", "test");

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-2" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: mockSendMail,
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../mailer.js");
    const result = await sendMail("real@user.com", "Hello", "<p>Hi</p>");

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sandbox@test.com",
        subject: "[SANDBOX → real@user.com] Hello",
      })
    );
    expect(result.sandboxed).toBe(true);
    _resetMailerState();
  });

  it("sends normally when sandbox mode is on but no recipient set", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@test.com");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("SMTP_FROM", "noreply@test.com");
    vi.stubEnv("EMAIL_SANDBOX_MODE", "true");
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.EMAIL_SANDBOX_RECIPIENT;

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-3" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: mockSendMail,
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../mailer.js");
    await sendMail("real@user.com", "Hello", "<p>Hi</p>");

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "real@user.com",
        subject: "Hello",
      })
    );
    _resetMailerState();
  });

  it("isSandboxMode returns correct values", async () => {
    vi.stubEnv("EMAIL_SANDBOX_MODE", "true");
    vi.stubEnv("EMAIL_SANDBOX_RECIPIENT", "test@test.com");
    vi.stubEnv("NODE_ENV", "test");

    const { isSandboxMode } = await import("../mailer.js");
    expect(isSandboxMode()).toBe(true);
  });

  it("isSandboxMode returns false when disabled", async () => {
    vi.stubEnv("EMAIL_SANDBOX_MODE", "false");
    vi.stubEnv("NODE_ENV", "test");

    const { isSandboxMode } = await import("../mailer.js");
    expect(isSandboxMode()).toBe(false);
  });
});
