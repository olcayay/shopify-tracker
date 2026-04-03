import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SmtpCircuitBreaker,
  type SmtpProviderConfig,
} from "../smtp-circuit-breaker.js";
import { checkSmtpHealth } from "../smtp-health-check.js";

// ── Test helpers ───────────────────────────────────────────────────

function makeProvider(name: string, priority = 1): SmtpProviderConfig {
  return {
    name,
    host: `smtp-${name}.example.com`,
    port: 587,
    user: `user@${name}.com`,
    pass: "pass",
    from: `noreply@${name}.com`,
    priority,
  };
}

// ── Circuit Breaker tests ──────────────────────────────────────────

describe("SmtpCircuitBreaker", () => {
  let cb: SmtpCircuitBreaker;

  beforeEach(() => {
    cb = new SmtpCircuitBreaker(makeProvider("primary"), {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });
  });

  it("starts in closed state", () => {
    expect(cb.state).toBe("closed");
    expect(cb.isAvailable()).toBe(true);
    expect(cb.failCount).toBe(0);
  });

  it("stays closed below failure threshold", () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("closed");
    expect(cb.isAvailable()).toBe(true);
    expect(cb.failCount).toBe(2);
  });

  it("opens after reaching failure threshold", () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("open");
    expect(cb.isAvailable()).toBe(false);
    expect(cb.failCount).toBe(3);
  });

  it("transitions from open to half-open after reset timeout", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) cb.recordFailure();
    expect(cb.state).toBe("open");

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 1100));
    expect(cb.state).toBe("half-open");
    expect(cb.isAvailable()).toBe(true);
  });

  it("re-opens on failure during half-open state", async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure();
    await new Promise((r) => setTimeout(r, 1100));
    expect(cb.state).toBe("half-open");

    cb.recordFailure();
    expect(cb.state).toBe("open");
    expect(cb.isAvailable()).toBe(false);
  });

  it("closes on success during half-open state", async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure();
    await new Promise((r) => setTimeout(r, 1100));
    expect(cb.state).toBe("half-open");

    cb.recordSuccess();
    expect(cb.state).toBe("closed");
    expect(cb.failCount).toBe(0);
    expect(cb.lastFailAt).toBeNull();
  });

  it("resets fail count on success", () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.failCount).toBe(0);
    expect(cb.state).toBe("closed");
  });

  it("forceState works correctly", () => {
    cb.forceState("open");
    expect(cb.state).toBe("open");
    expect(cb.isAvailable()).toBe(false);

    cb.forceState("closed");
    expect(cb.state).toBe("closed");
    expect(cb.failCount).toBe(0);
  });

  it("uses default thresholds when no options provided", () => {
    const defaultCb = new SmtpCircuitBreaker(makeProvider("default"));
    // Default threshold is 5
    for (let i = 0; i < 4; i++) defaultCb.recordFailure();
    expect(defaultCb.state).toBe("closed");
    defaultCb.recordFailure();
    expect(defaultCb.state).toBe("open");
  });
});

// ── Failover (sendMail with multiple providers) ────────────────────

describe("sendMail failover", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("sends via primary provider when healthy", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("NODE_ENV", "test");

    // Mock nodemailer
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "abc123" });
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
    const result = await sendMail("to@test.com", "Test", "<p>Hi</p>");
    expect(result.messageId).toBe("abc123");
    expect(result.provider).toBe("primary");
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    _resetMailerState();
  });

  it("falls back to secondary when primary fails", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("SMTP_SECONDARY_HOST", "smtp.secondary.com");
    vi.stubEnv("SMTP_SECONDARY_PORT", "587");
    vi.stubEnv("SMTP_SECONDARY_USER", "user@secondary.com");
    vi.stubEnv("SMTP_SECONDARY_PASS", "pass2");
    vi.stubEnv("SMTP_SECONDARY_FROM", "noreply@secondary.com");
    vi.stubEnv("NODE_ENV", "test");

    let callCount = 0;
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) throw new Error("Connection refused");
            return Promise.resolve({ messageId: "fallback-123" });
          }),
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../mailer.js");
    const result = await sendMail("to@test.com", "Test", "<p>Hi</p>");
    expect(result.messageId).toBe("fallback-123");
    expect(result.provider).toBe("secondary");
    _resetMailerState();
  });

  it("throws when all providers fail", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("NODE_ENV", "test");

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: vi.fn().mockRejectedValue(new Error("SMTP down")),
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, _resetMailerState } = await import("../mailer.js");
    await expect(sendMail("to@test.com", "Test", "<p>Hi</p>")).rejects.toThrow(
      "SMTP down"
    );
    _resetMailerState();
  });

  it("throws ALL_PROVIDERS_DOWN when all circuits are open", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("NODE_ENV", "test");

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          sendMail: vi.fn().mockRejectedValue(new Error("fail")),
          close: vi.fn(),
          verify: vi.fn().mockResolvedValue(true),
        }),
      },
    }));

    const { sendMail, getCircuitBreakers, _resetMailerState } = await import(
      "../mailer.js"
    );

    // Open all circuits by exhausting retries
    const cbs = getCircuitBreakers();
    for (const cb of cbs) {
      cb.forceState("open");
    }

    await expect(sendMail("to@test.com", "Test", "<p>Hi</p>")).rejects.toThrow(
      "All SMTP providers are unavailable"
    );
    _resetMailerState();
  });
});

// ── Circuit breaker integration with failover ──────────────────────

describe("circuit breaker + failover integration", () => {
  it("skips open-circuit providers during failover", () => {
    const primary = new SmtpCircuitBreaker(makeProvider("primary", 1), {
      failureThreshold: 2,
    });
    const secondary = new SmtpCircuitBreaker(makeProvider("secondary", 2), {
      failureThreshold: 2,
    });

    // Open primary circuit
    primary.recordFailure();
    primary.recordFailure();
    expect(primary.isAvailable()).toBe(false);
    expect(secondary.isAvailable()).toBe(true);

    // Available list should only contain secondary
    const available = [primary, secondary].filter((cb) => cb.isAvailable());
    expect(available).toHaveLength(1);
    expect(available[0].provider.name).toBe("secondary");
  });

  it("detects all providers down", () => {
    const primary = new SmtpCircuitBreaker(makeProvider("primary", 1), {
      failureThreshold: 2,
    });
    const secondary = new SmtpCircuitBreaker(makeProvider("secondary", 2), {
      failureThreshold: 2,
    });

    primary.recordFailure();
    primary.recordFailure();
    secondary.recordFailure();
    secondary.recordFailure();

    const allDown = [primary, secondary].every((cb) => !cb.isAvailable());
    expect(allDown).toBe(true);
  });
});

// ── Health check ───────────────────────────────────────────────────

describe("checkSmtpHealth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns connected=true on successful verify", async () => {
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          verify: vi.fn().mockResolvedValue(true),
          close: vi.fn(),
        }),
      },
    }));

    const { checkSmtpHealth: check } = await import(
      "../smtp-health-check.js"
    );
    const result = await check(makeProvider("test"));
    expect(result.connected).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("returns connected=false on verify failure", async () => {
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: () => ({
          verify: vi.fn().mockRejectedValue(new Error("Connection timeout")),
          close: vi.fn(),
        }),
      },
    }));

    const { checkSmtpHealth: check } = await import(
      "../smtp-health-check.js"
    );
    const result = await check(makeProvider("test"));
    expect(result.connected).toBe(false);
    expect(result.error).toBe("Connection timeout");
  });
});

// ── loadSmtpProviders ──────────────────────────────────────────────

describe("loadSmtpProviders", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("throws when no SMTP config is set", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    vi.stubEnv("NODE_ENV", "test");

    // Clear the vars entirely
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_SECONDARY_HOST;

    const { loadSmtpProviders } = await import("../mailer.js");
    expect(() => loadSmtpProviders()).toThrow(
      "At least one SMTP provider is required"
    );
  });

  it("loads only primary when secondary is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.SMTP_SECONDARY_HOST;

    const { loadSmtpProviders } = await import("../mailer.js");
    const providers = loadSmtpProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("primary");
    expect(providers[0].port).toBe(465);
  });

  it("loads both providers sorted by priority", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.primary.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user@primary.com");
    vi.stubEnv("SMTP_PASS", "pass1");
    vi.stubEnv("SMTP_FROM", "noreply@primary.com");
    vi.stubEnv("SMTP_SECONDARY_HOST", "smtp.secondary.com");
    vi.stubEnv("SMTP_SECONDARY_PORT", "587");
    vi.stubEnv("SMTP_SECONDARY_USER", "user@secondary.com");
    vi.stubEnv("SMTP_SECONDARY_PASS", "pass2");
    vi.stubEnv("SMTP_SECONDARY_FROM", "noreply@secondary.com");
    vi.stubEnv("NODE_ENV", "test");

    const { loadSmtpProviders } = await import("../mailer.js");
    const providers = loadSmtpProviders();
    expect(providers).toHaveLength(2);
    expect(providers[0].name).toBe("primary");
    expect(providers[1].name).toBe("secondary");
  });
});
