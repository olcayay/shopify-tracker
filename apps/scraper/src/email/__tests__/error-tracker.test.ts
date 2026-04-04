import { describe, it, expect } from "vitest";
import { categorizeEmailError, buildErrorContext, trackEmailError } from "../error-tracker.js";

describe("categorizeEmailError", () => {
  it("categorizes authentication failures as smtp_auth", () => {
    expect(categorizeEmailError(new Error("Authentication failed"))).toBe("smtp_auth");
    expect(categorizeEmailError(new Error("Invalid credentials"))).toBe("smtp_auth");
  });

  it("categorizes connection errors as smtp_connection", () => {
    const err = new Error("connect ECONNREFUSED");
    (err as any).code = "ECONNREFUSED";
    expect(categorizeEmailError(err)).toBe("smtp_connection");
  });

  it("categorizes timeout as smtp_connection", () => {
    const err = new Error("Connection timeout");
    (err as any).code = "ETIMEDOUT";
    expect(categorizeEmailError(err)).toBe("smtp_connection");
  });

  it("categorizes all providers down as provider_down", () => {
    const err = new Error("All SMTP providers are unavailable");
    (err as any).code = "ALL_PROVIDERS_DOWN";
    expect(categorizeEmailError(err)).toBe("provider_down");
  });

  it("categorizes SMTP rejection as smtp_rejected", () => {
    expect(categorizeEmailError(new Error("550 User unknown"))).toBe("smtp_rejected");
    expect(categorizeEmailError(new Error("Address rejected"))).toBe("smtp_rejected");
  });

  it("categorizes template errors as template_render", () => {
    expect(categorizeEmailError(new Error("Cannot read property 'name' of undefined"))).toBe("template_render");
    expect(categorizeEmailError(new Error("Template render failed"))).toBe("template_render");
  });

  it("categorizes rate limits as rate_limited", () => {
    expect(categorizeEmailError(new Error("Rate limit exceeded"))).toBe("rate_limited");
    expect(categorizeEmailError(new Error("Too many connections"))).toBe("rate_limited");
  });

  it("categorizes unknown errors as unknown", () => {
    expect(categorizeEmailError(new Error("Something weird happened"))).toBe("unknown");
  });
});

describe("buildErrorContext", () => {
  it("builds complete context from error and metadata", () => {
    const err = new Error("550 5.1.1 User unknown");
    const ctx = buildErrorContext(err, {
      emailType: "email_password_reset",
      recipient: "bad@example.com",
      userId: "u1",
      jobId: "j1",
      queueName: "email-instant",
      attempt: 3,
      maxAttempts: 3,
      durationMs: 1500,
    });

    expect(ctx.category).toBe("smtp_rejected");
    expect(ctx.errorClass).toBe("permanent");
    expect(ctx.emailType).toBe("email_password_reset");
    expect(ctx.recipient).toBe("bad@example.com");
    expect(ctx.smtpResponse).toContain("550");
    expect(ctx.attempt).toBe(3);
    expect(ctx.timestamp).toBeDefined();
  });

  it("handles non-Error objects", () => {
    const ctx = buildErrorContext("string error", {
      emailType: "email_welcome",
    });

    expect(ctx.errorMessage).toBe("string error");
    expect(ctx.category).toBe("unknown");
  });
});

describe("trackEmailError", () => {
  it("returns structured context", () => {
    const ctx = trackEmailError(new Error("ECONNREFUSED"), {
      emailType: "email_2fa_code",
      recipient: "user@test.com",
    });

    expect(ctx.category).toBeDefined();
    expect(ctx.errorMessage).toContain("ECONNREFUSED");
    expect(ctx.emailType).toBe("email_2fa_code");
  });
});
