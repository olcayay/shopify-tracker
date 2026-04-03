import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sendMail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("throws when SMTP env vars not set", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_SECONDARY_HOST;
    vi.stubEnv("NODE_ENV", "test");

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: vi.fn(),
          close: vi.fn(),
          verify: vi.fn(),
        })),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../../email/mailer.js");

    await expect(
      sendMail("test@example.com", "Test", "<p>Hello</p>"),
    ).rejects.toThrow("At least one SMTP provider is required");

    _resetMailerState();
  });

  it("calls sendMail with correct from/to/subject/html when env configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@test.com");
    vi.stubEnv("SMTP_PASS", "secret");
    vi.stubEnv("NODE_ENV", "test");

    const freshMockSendMail = vi.fn().mockResolvedValue({ messageId: "fresh-id" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: freshMockSendMail,
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        })),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../../email/mailer.js");

    await sendMail("recipient@example.com", "Test Subject", "<p>Body</p>");

    expect(freshMockSendMail).toHaveBeenCalledWith({
      from: "user@test.com",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Body</p>",
    });

    _resetMailerState();
  });
});
