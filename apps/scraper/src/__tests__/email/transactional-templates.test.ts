import { describe, it, expect } from "vitest";
import {
  passwordResetTemplate,
  emailVerificationTemplate,
  invitationTemplate,
  loginAlertTemplate,
  twoFactorCodeTemplate,
} from "../../email/templates/transactional/index.js";

describe("passwordResetTemplate", () => {
  const data = {
    name: "Alice",
    resetUrl: "https://appranks.io/reset?token=abc123",
  };

  it("returns subject and html", () => {
    const result = passwordResetTemplate(data);
    expect(result.subject).toBe("Reset your AppRanks password");
    expect(result.html).toContain("<!DOCTYPE html>");
  });

  it("includes the user name", () => {
    const { html } = passwordResetTemplate(data);
    expect(html).toContain("Hi Alice");
  });

  it("includes the reset URL", () => {
    const { html } = passwordResetTemplate(data);
    expect(html).toContain("https://appranks.io/reset?token=abc123");
  });

  it("shows default 1 hour expiry", () => {
    const { html } = passwordResetTemplate(data);
    expect(html).toContain("1 hour");
  });

  it("shows custom expiry", () => {
    const { html } = passwordResetTemplate({ ...data, expiryHours: 2 });
    expect(html).toContain("2 hours");
  });

  it("does NOT include unsubscribe link", () => {
    const { html } = passwordResetTemplate(data);
    expect(html).not.toContain("Unsubscribe");
  });

  it("does NOT include tracking pixel", () => {
    const { html } = passwordResetTemplate(data);
    expect(html).not.toContain("track/open");
  });
});

describe("emailVerificationTemplate", () => {
  const data = {
    name: "Bob",
    verificationUrl: "https://appranks.io/verify?token=xyz",
  };

  it("returns subject and html", () => {
    const result = emailVerificationTemplate(data);
    expect(result.subject).toBe("Verify your AppRanks email address");
    expect(result.html).toContain("<!DOCTYPE html>");
  });

  it("includes user name and verification URL", () => {
    const { html } = emailVerificationTemplate(data);
    expect(html).toContain("Hi Bob");
    expect(html).toContain("https://appranks.io/verify?token=xyz");
  });

  it("does NOT include unsubscribe link", () => {
    const { html } = emailVerificationTemplate(data);
    expect(html).not.toContain("Unsubscribe");
  });
});

describe("invitationTemplate", () => {
  const data = {
    inviterName: "Charlie",
    accountName: "Acme Corp",
    acceptUrl: "https://appranks.io/invite/accept?token=inv123",
  };

  it("returns subject with inviter and account name", () => {
    const result = invitationTemplate(data);
    expect(result.subject).toContain("Charlie");
    expect(result.subject).toContain("Acme Corp");
  });

  it("includes inviter name and account name in body", () => {
    const { html } = invitationTemplate(data);
    expect(html).toContain("Charlie");
    expect(html).toContain("Acme Corp");
  });

  it("includes accept URL", () => {
    const { html } = invitationTemplate(data);
    expect(html).toContain("https://appranks.io/invite/accept?token=inv123");
  });

  it("includes role when provided", () => {
    const { html } = invitationTemplate({ ...data, role: "admin" });
    expect(html).toContain("an admin");
  });

  it("does NOT include unsubscribe link", () => {
    const { html } = invitationTemplate(data);
    expect(html).not.toContain("Unsubscribe");
  });
});

describe("loginAlertTemplate", () => {
  const data = {
    name: "Diana",
    device: "Chrome on macOS",
    location: "Istanbul, Turkey",
    ip: "1.2.3.4",
    loginTime: "2026-03-30T10:00:00Z",
    secureAccountUrl: "https://appranks.io/settings/security",
  };

  it("returns subject about new sign-in", () => {
    const result = loginAlertTemplate(data);
    expect(result.subject).toContain("sign-in");
  });

  it("includes user name", () => {
    const { html } = loginAlertTemplate(data);
    expect(html).toContain("Hi Diana");
  });

  it("includes device and location", () => {
    const { html } = loginAlertTemplate(data);
    expect(html).toContain("Chrome on macOS");
    expect(html).toContain("Istanbul, Turkey");
  });

  it("includes IP address", () => {
    const { html } = loginAlertTemplate(data);
    expect(html).toContain("1.2.3.4");
  });

  it("includes secure account URL", () => {
    const { html } = loginAlertTemplate(data);
    expect(html).toContain("https://appranks.io/settings/security");
  });

  it("renders without optional location and IP", () => {
    const { html } = loginAlertTemplate({
      name: "Eve",
      device: "Safari on iOS",
      loginTime: "2026-03-30T10:00:00Z",
      secureAccountUrl: "https://appranks.io/settings",
    });
    expect(html).toContain("Safari on iOS");
    expect(html).not.toContain("Location");
    expect(html).not.toContain("IP Address");
  });
});

describe("twoFactorCodeTemplate", () => {
  const data = {
    name: "Frank",
    code: "847291",
  };

  it("includes code in subject", () => {
    const result = twoFactorCodeTemplate(data);
    expect(result.subject).toContain("847291");
  });

  it("displays the code prominently", () => {
    const { html } = twoFactorCodeTemplate(data);
    expect(html).toContain("847291");
  });

  it("shows default 10 minute expiry", () => {
    const { html } = twoFactorCodeTemplate(data);
    expect(html).toContain("10 minutes");
  });

  it("shows custom expiry", () => {
    const { html } = twoFactorCodeTemplate({ ...data, expiryMinutes: 5 });
    expect(html).toContain("5 minutes");
  });

  it("does NOT include unsubscribe link", () => {
    const { html } = twoFactorCodeTemplate(data);
    expect(html).not.toContain("Unsubscribe");
  });
});
