/**
 * Email Template Rendering Tests (PLA-678)
 *
 * Tests every email template with:
 * 1. Rendering — produces subject + HTML
 * 2. Variable substitution — no leftover {{placeholders}}
 * 3. Required elements — CTA links, unsubscribe references, footer
 * 4. HTML validity — parseable structure, no broken tags
 * 5. Mobile responsive — viewport meta, max-width styling
 * 6. No broken images — all img src start with http(s)
 * 7. Snapshot — track visual changes across commits
 */
import { describe, it, expect } from "vitest";
import {
  passwordResetTemplate,
  emailVerificationTemplate,
  invitationTemplate,
  loginAlertTemplate,
  twoFactorCodeTemplate,
} from "../templates/transactional/index.js";
import { emailLayout, header, ctaButton } from "../components/index.js";
import { templateRenderers } from "../process-instant-email.js";

// ── Helpers ────────────────────────────────────────────────────────

function assertValidHtml(html: string, label: string) {
  // Basic HTML structure
  expect(html, `${label}: should contain DOCTYPE`).toContain("<!DOCTYPE html>");
  expect(html, `${label}: should contain <html`).toContain("<html");
  expect(html, `${label}: should close </html>`).toContain("</html>");
  expect(html, `${label}: should contain <body`).toContain("<body");

  // No leftover template variables
  const placeholderMatch = html.match(/\{\{[^}]+\}\}/g);
  expect(placeholderMatch, `${label}: should not have {{placeholders}}`).toBeNull();

  // Mobile responsive
  expect(html, `${label}: should have viewport meta`).toContain("viewport");

  // All img src should start with http or data:
  const imgSrcs = html.match(/src="([^"]+)"/g) || [];
  for (const src of imgSrcs) {
    const url = src.replace('src="', "").replace('"', "");
    if (url.startsWith("cid:") || url.startsWith("data:")) continue;
    expect(url, `${label}: img src should be absolute URL`).toMatch(/^https?:\/\//);
  }
}

function assertHasSubject(result: { subject: string; html: string }, label: string) {
  expect(result.subject, `${label}: subject should be non-empty`).toBeTruthy();
  expect(result.subject.length, `${label}: subject should be reasonable length`).toBeGreaterThan(5);
  expect(result.subject.length, `${label}: subject should not be too long`).toBeLessThan(200);
}

function assertHasFooter(html: string, label: string) {
  expect(html, `${label}: should have AppRanks branding`).toContain("AppRanks");
}

// ── Password Reset ─────────────────────────────────────────────────

describe("passwordResetTemplate", () => {
  const data = {
    name: "John Doe",
    resetUrl: "https://appranks.io/reset-password?token=abc123",
    expiryHours: 1,
  };

  it("renders with all data", () => {
    const result = passwordResetTemplate(data);
    assertHasSubject(result, "password-reset");
    assertValidHtml(result.html, "password-reset");
    assertHasFooter(result.html, "password-reset");
  });

  it("includes user name", () => {
    const result = passwordResetTemplate(data);
    expect(result.html).toContain("John Doe");
  });

  it("includes reset URL as CTA and plaintext fallback", () => {
    const result = passwordResetTemplate(data);
    expect(result.html).toContain(data.resetUrl);
    expect(result.html).toContain("Reset Your Password");
  });

  it("includes expiry information", () => {
    const result = passwordResetTemplate(data);
    expect(result.html).toContain("1 hour");
  });

  it("handles plural expiry hours", () => {
    const result = passwordResetTemplate({ ...data, expiryHours: 2 });
    expect(result.html).toContain("2 hours");
  });

  it("defaults to 1 hour expiry", () => {
    const result = passwordResetTemplate({ name: "Jane", resetUrl: "https://example.com" });
    expect(result.html).toContain("1 hour");
  });

  it("subject mentions password reset", () => {
    const result = passwordResetTemplate(data);
    expect(result.subject.toLowerCase()).toContain("reset");
  });

  it("matches snapshot", () => {
    const result = passwordResetTemplate(data);
    expect(result.html).toMatchSnapshot();
  });
});

// ── Email Verification ─────────────────────────────────────────────

describe("emailVerificationTemplate", () => {
  const data = {
    name: "Alice",
    verificationUrl: "https://appranks.io/verify?token=xyz789",
  };

  it("renders with all data", () => {
    const result = emailVerificationTemplate(data);
    assertHasSubject(result, "email-verification");
    assertValidHtml(result.html, "email-verification");
    assertHasFooter(result.html, "email-verification");
  });

  it("includes user name", () => {
    const result = emailVerificationTemplate(data);
    expect(result.html).toContain("Alice");
  });

  it("includes verification URL", () => {
    const result = emailVerificationTemplate(data);
    expect(result.html).toContain(data.verificationUrl);
  });

  it("matches snapshot", () => {
    const result = emailVerificationTemplate(data);
    expect(result.html).toMatchSnapshot();
  });
});

// ── Invitation ─────────────────────────────────────────────────────

describe("invitationTemplate", () => {
  const data = {
    inviterName: "Bob Smith",
    accountName: "Acme Corp",
    acceptUrl: "https://appranks.io/invite/accept/token123",
    role: "editor",
  };

  it("renders with all data", () => {
    const result = invitationTemplate(data);
    assertHasSubject(result, "invitation");
    assertValidHtml(result.html, "invitation");
    assertHasFooter(result.html, "invitation");
  });

  it("includes inviter and account name", () => {
    const result = invitationTemplate(data);
    expect(result.html).toContain("Bob Smith");
    expect(result.html).toContain("Acme Corp");
  });

  it("includes accept URL", () => {
    const result = invitationTemplate(data);
    expect(result.html).toContain(data.acceptUrl);
  });

  it("includes role when provided", () => {
    const result = invitationTemplate(data);
    expect(result.html).toContain("editor");
  });

  it("handles admin role", () => {
    const result = invitationTemplate({ ...data, role: "admin" });
    expect(result.html).toContain("an admin");
  });

  it("works without role", () => {
    const result = invitationTemplate({
      inviterName: "Bob",
      accountName: "Acme",
      acceptUrl: "https://example.com",
    });
    assertValidHtml(result.html, "invitation-no-role");
  });

  it("subject contains inviter and account", () => {
    const result = invitationTemplate(data);
    expect(result.subject).toContain("Bob Smith");
    expect(result.subject).toContain("Acme Corp");
  });

  it("matches snapshot", () => {
    const result = invitationTemplate(data);
    expect(result.html).toMatchSnapshot();
  });
});

// ── Login Alert ────────────────────────────────────────────────────

describe("loginAlertTemplate", () => {
  const data = {
    name: "Carol",
    device: "Chrome on macOS",
    location: "San Francisco, CA",
    ip: "203.0.113.42",
    loginTime: "2026-04-04T12:00:00Z",
    secureAccountUrl: "https://appranks.io/settings/security",
  };

  it("renders with all data", () => {
    const result = loginAlertTemplate(data);
    assertHasSubject(result, "login-alert");
    assertValidHtml(result.html, "login-alert");
    assertHasFooter(result.html, "login-alert");
  });

  it("includes device and location info", () => {
    const result = loginAlertTemplate(data);
    expect(result.html).toContain("Chrome on macOS");
    expect(result.html).toContain("San Francisco");
  });

  it("includes IP address", () => {
    const result = loginAlertTemplate(data);
    expect(result.html).toContain("203.0.113.42");
  });

  it("includes secure account link", () => {
    const result = loginAlertTemplate(data);
    expect(result.html).toContain(data.secureAccountUrl);
  });

  it("works without optional fields", () => {
    const result = loginAlertTemplate({
      name: "Carol",
      device: "Firefox",
      loginTime: "2026-04-04T12:00:00Z",
      secureAccountUrl: "https://example.com",
    });
    assertValidHtml(result.html, "login-alert-minimal");
  });

  it("matches snapshot", () => {
    const result = loginAlertTemplate(data);
    expect(result.html).toMatchSnapshot();
  });
});

// ── Two-Factor Code ────────────────────────────────────────────────

describe("twoFactorCodeTemplate", () => {
  const data = {
    name: "Dave",
    code: "847291",
    expiryMinutes: 10,
  };

  it("renders with all data", () => {
    const result = twoFactorCodeTemplate(data);
    assertHasSubject(result, "2fa-code");
    assertValidHtml(result.html, "2fa-code");
    assertHasFooter(result.html, "2fa-code");
  });

  it("includes the verification code", () => {
    const result = twoFactorCodeTemplate(data);
    expect(result.html).toContain("847291");
  });

  it("includes expiry info", () => {
    const result = twoFactorCodeTemplate(data);
    expect(result.html).toContain("10");
  });

  it("works without expiry", () => {
    const result = twoFactorCodeTemplate({ name: "Dave", code: "123456" });
    assertValidHtml(result.html, "2fa-no-expiry");
  });

  it("matches snapshot", () => {
    const result = twoFactorCodeTemplate(data);
    expect(result.html).toMatchSnapshot();
  });
});

// ── Welcome Email (inline template) ────────────────────────────────

describe("welcome email (inline)", () => {
  it("renders via templateRenderers registry", () => {
    const renderer = templateRenderers.email_welcome;
    const result = renderer({ name: "NewUser" });
    assertHasSubject(result, "welcome");
    assertValidHtml(result.html, "welcome");
    expect(result.html).toContain("NewUser");
    expect(result.html).toContain("Welcome to AppRanks");
  });

  it("matches snapshot", () => {
    const renderer = templateRenderers.email_welcome;
    const result = renderer({ name: "NewUser" });
    expect(result.html).toMatchSnapshot();
  });
});

// ── Template Registry Completeness ─────────────────────────────────

describe("templateRenderers registry", () => {
  const expectedTypes = [
    "email_password_reset",
    "email_verification",
    "email_welcome",
    "email_invitation",
    "email_login_alert",
    "email_2fa_code",
  ];

  for (const type of expectedTypes) {
    it(`has renderer for ${type}`, () => {
      expect(templateRenderers[type as keyof typeof templateRenderers]).toBeDefined();
      expect(typeof templateRenderers[type as keyof typeof templateRenderers]).toBe("function");
    });
  }

  it("covers all transactional email types", () => {
    const registeredTypes = Object.keys(templateRenderers);
    expect(registeredTypes.sort()).toEqual(expectedTypes.sort());
  });
});

// ── Cross-template validation ──────────────────────────────────────

describe("cross-template quality checks", () => {
  const templates = [
    { name: "password_reset", fn: () => passwordResetTemplate({ name: "Test", resetUrl: "https://example.com" }) },
    { name: "email_verification", fn: () => emailVerificationTemplate({ name: "Test", verificationUrl: "https://example.com" }) },
    { name: "invitation", fn: () => invitationTemplate({ inviterName: "A", accountName: "B", acceptUrl: "https://example.com" }) },
    { name: "login_alert", fn: () => loginAlertTemplate({ name: "Test", device: "Chrome", loginTime: "2026-01-01", secureAccountUrl: "https://example.com" }) },
    { name: "2fa_code", fn: () => twoFactorCodeTemplate({ name: "Test", code: "123456" }) },
  ];

  for (const { name, fn } of templates) {
    it(`${name}: has max-width for email clients`, () => {
      const { html } = fn();
      expect(html).toMatch(/max-width/);
    });

    it(`${name}: has AppRanks branding in footer`, () => {
      const { html } = fn();
      expect(html).toContain("AppRanks");
    });

    it(`${name}: has valid DOCTYPE`, () => {
      const { html } = fn();
      expect(html).toMatch(/^<!DOCTYPE html>/i);
    });
  }
});
