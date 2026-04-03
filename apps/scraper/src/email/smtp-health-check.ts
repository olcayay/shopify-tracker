import nodemailer from "nodemailer";
import { createLogger } from "@appranks/shared";
import type { SmtpProviderConfig, SmtpCircuitBreaker } from "./smtp-circuit-breaker.js";

const log = createLogger("smtp:health-check");

export interface HealthCheckResult {
  provider: string;
  connected: boolean;
  latencyMs: number;
  error?: string;
}

/** Test SMTP connectivity via EHLO/HELO handshake */
export async function checkSmtpHealth(
  provider: SmtpProviderConfig
): Promise<HealthCheckResult> {
  const start = Date.now();
  const transport = nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: provider.port === 465,
    auth: { user: provider.user, pass: provider.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });

  try {
    await transport.verify();
    const latencyMs = Date.now() - start;
    log.info("health check passed", { provider: provider.name, latencyMs });
    return { provider: provider.name, connected: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    log.warn("health check failed", { provider: provider.name, latencyMs, error });
    return { provider: provider.name, connected: false, latencyMs, error };
  } finally {
    transport.close();
  }
}

/** Periodically check all providers and update their circuit breakers */
export function startHealthCheckLoop(
  circuitBreakers: SmtpCircuitBreaker[],
  intervalMs = 5 * 60 * 1000 // 5 minutes
): NodeJS.Timeout {
  const check = async () => {
    for (const cb of circuitBreakers) {
      try {
        const result = await checkSmtpHealth(cb.provider);
        if (result.connected && cb.state === "open") {
          cb.forceState("half-open");
          log.info("provider recovered, circuit set to half-open", {
            provider: cb.provider.name,
          });
        } else if (!result.connected && cb.state === "closed") {
          cb.forceState("open");
          log.warn("provider unhealthy, circuit opened", {
            provider: cb.provider.name,
          });
        }
      } catch (err) {
        log.error("health check error", {
          provider: cb.provider.name,
          error: String(err),
        });
      }
    }
  };

  // Run first check immediately
  check();
  return setInterval(check, intervalMs);
}
