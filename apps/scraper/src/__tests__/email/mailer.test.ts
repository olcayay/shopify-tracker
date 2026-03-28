import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

// Must import after mock setup
const { sendMail } = await import("../../email/mailer.js");

describe("sendMail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the cached transporter by re-importing would be complex,
    // so we test with env vars set for the main path
  });

  it("throws when SMTP env vars not set", async () => {
    // Clear SMTP env vars
    const origHost = process.env.SMTP_HOST;
    const origUser = process.env.SMTP_USER;
    const origPass = process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    // Re-import to get a fresh module without cached transporter
    vi.resetModules();

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: vi.fn(),
        })),
      },
    }));

    const freshModule = await import("../../email/mailer.js");

    await expect(
      freshModule.sendMail("test@example.com", "Test", "<p>Hello</p>"),
    ).rejects.toThrow("SMTP_HOST, SMTP_USER, and SMTP_PASS are required");

    // Restore
    if (origHost) process.env.SMTP_HOST = origHost;
    if (origUser) process.env.SMTP_USER = origUser;
    if (origPass) process.env.SMTP_PASS = origPass;
  });

  it("calls sendMail with correct from/to/subject/html when env configured", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "secret";

    // Re-import to pick up env vars with fresh transporter
    vi.resetModules();

    const freshMockSendMail = vi.fn().mockResolvedValue({ messageId: "fresh-id" });
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: freshMockSendMail,
        })),
      },
    }));

    const freshModule = await import("../../email/mailer.js");

    await freshModule.sendMail("recipient@example.com", "Test Subject", "<p>Body</p>");

    expect(freshMockSendMail).toHaveBeenCalledWith({
      from: "user@test.com",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Body</p>",
    });
  });
});
