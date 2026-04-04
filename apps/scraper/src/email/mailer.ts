import nodemailer from "nodemailer";
import { createLogger } from "@appranks/shared";
import {
  SmtpCircuitBreaker,
  type SmtpProviderConfig,
} from "./smtp-circuit-breaker.js";
import { startHealthCheckLoop } from "./smtp-health-check.js";

const log = createLogger("mailer");

// ── Provider management ────────────────────────────────────────────

const transporters = new Map<string, nodemailer.Transporter>();
let circuitBreakers: SmtpCircuitBreaker[] = [];
let healthCheckTimer: NodeJS.Timeout | null = null;

/** Build provider configs from environment variables */
export function loadSmtpProviders(): SmtpProviderConfig[] {
  const providers: SmtpProviderConfig[] = [];

  const primaryHost = process.env.SMTP_HOST;
  const primaryUser = process.env.SMTP_USER;
  const primaryPass = process.env.SMTP_PASS;
  if (primaryHost && primaryUser && primaryPass) {
    providers.push({
      name: "primary",
      host: primaryHost,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      user: primaryUser,
      pass: primaryPass,
      from: process.env.SMTP_FROM || primaryUser,
      priority: 1,
    });
  }

  const secondaryHost = process.env.SMTP_SECONDARY_HOST;
  const secondaryUser = process.env.SMTP_SECONDARY_USER;
  const secondaryPass = process.env.SMTP_SECONDARY_PASS;
  if (secondaryHost && secondaryUser && secondaryPass) {
    providers.push({
      name: "secondary",
      host: secondaryHost,
      port: parseInt(process.env.SMTP_SECONDARY_PORT || "587", 10),
      user: secondaryUser,
      pass: secondaryPass,
      from: process.env.SMTP_SECONDARY_FROM || secondaryUser,
      priority: 2,
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "At least one SMTP provider is required (SMTP_HOST, SMTP_USER, SMTP_PASS)"
    );
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

function getTransporter(provider: SmtpProviderConfig): nodemailer.Transporter {
  let t = transporters.get(provider.name);
  if (!t) {
    t = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.port === 465,
      auth: { user: provider.user, pass: provider.pass },
    });
    transporters.set(provider.name, t);
  }
  return t;
}

/** Initialize circuit breakers and start health checks. Called once at startup. */
export function initSmtpFailover(
  options?: { healthCheckIntervalMs?: number }
): SmtpCircuitBreaker[] {
  if (circuitBreakers.length > 0) return circuitBreakers;

  const providers = loadSmtpProviders();
  circuitBreakers = providers.map((p) => new SmtpCircuitBreaker(p));

  log.info("SMTP failover initialized", {
    providers: providers.map((p) => p.name),
  });

  // Start periodic health checks (skip in test env)
  if (process.env.NODE_ENV !== "test") {
    healthCheckTimer = startHealthCheckLoop(
      circuitBreakers,
      options?.healthCheckIntervalMs
    );
  }

  return circuitBreakers;
}

/** Get circuit breakers (initializes if needed) */
export function getCircuitBreakers(): SmtpCircuitBreaker[] {
  if (circuitBreakers.length === 0) {
    initSmtpFailover();
  }
  return circuitBreakers;
}

/** Check if all SMTP providers are down */
export function allProvidersDown(): boolean {
  const cbs = getCircuitBreakers();
  return cbs.every((cb) => !cb.isAvailable());
}

// ── Sandbox mode ───────────────────────────────────────────────────

/**
 * When EMAIL_SANDBOX_MODE=true, all outgoing emails are redirected
 * to EMAIL_SANDBOX_RECIPIENT. The original recipient is preserved
 * in the subject line for debugging.
 */
function applySandbox(to: string, subject: string): { to: string; subject: string; sandboxed: boolean } {
  const sandboxMode = process.env.EMAIL_SANDBOX_MODE === "true";
  if (!sandboxMode) return { to, subject, sandboxed: false };

  const sandboxRecipient = process.env.EMAIL_SANDBOX_RECIPIENT;
  if (!sandboxRecipient) {
    log.warn("EMAIL_SANDBOX_MODE is true but EMAIL_SANDBOX_RECIPIENT is not set — sending normally");
    return { to, subject, sandboxed: false };
  }

  return {
    to: sandboxRecipient,
    subject: `[SANDBOX → ${to}] ${subject}`,
    sandboxed: true,
  };
}

/** Check if sandbox mode is active */
export function isSandboxMode(): boolean {
  return process.env.EMAIL_SANDBOX_MODE === "true" && !!process.env.EMAIL_SANDBOX_RECIPIENT;
}

// ── Send with failover ─────────────────────────────────────────────

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<{ messageId?: string; provider?: string; sandboxed?: boolean }> {
  // Apply sandbox redirect
  const sandbox = applySandbox(to, subject);
  if (sandbox.sandboxed) {
    log.info("sandbox mode: redirecting email", { originalTo: to, sandboxTo: sandbox.to });
  }
  to = sandbox.to;
  subject = sandbox.subject;

  const cbs = getCircuitBreakers();
  const availableProviders = cbs.filter((cb) => cb.isAvailable());

  if (availableProviders.length === 0) {
    const err = new Error("All SMTP providers are unavailable");
    (err as any).code = "ALL_PROVIDERS_DOWN";
    log.error("all SMTP providers down", { to, subject });
    throw err;
  }

  let lastError: Error | undefined;

  for (const cb of availableProviders) {
    const provider = cb.provider;
    const from = provider.from;
    try {
      const transporter = getTransporter(provider);
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        ...(headers ? { headers } : {}),
      });

      cb.recordSuccess();
      log.info("email sent", { to, subject, provider: provider.name, sandboxed: sandbox.sandboxed });
      return { messageId: info.messageId, provider: provider.name, sandboxed: sandbox.sandboxed };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      cb.recordFailure();
      log.warn("SMTP send failed, trying next provider", {
        provider: provider.name,
        to,
        subject,
        error: lastError.message,
      });
    }
  }

  // All available providers failed
  log.error("all available SMTP providers failed", { to, subject });
  throw lastError!;
}

/** Cleanup: stop health checks and close transporters */
export async function closeMailer(): Promise<void> {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  for (const [, t] of transporters) {
    t.close();
  }
  transporters.clear();
  circuitBreakers = [];
}

/** Reset internal state (for testing) */
export function _resetMailerState(): void {
  transporters.clear();
  circuitBreakers = [];
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}
