import { createLogger } from "@appranks/shared";

const log = createLogger("api:alerts");

export type AlertSeverity = "critical" | "warning" | "info";

interface Alert {
  severity: AlertSeverity;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire a system alert. Currently logs to structured logger (picked up by Sentry/Loki).
 * Can be extended to send to webhook, Slack, PagerDuty, etc.
 */
export function fireAlert(alert: Alert): void {
  const { severity, event, message, metadata } = alert;

  if (severity === "critical") {
    log.error(message, { alertEvent: event, severity, ...metadata });
  } else if (severity === "warning") {
    log.warn(message, { alertEvent: event, severity, ...metadata });
  } else {
    log.info(message, { alertEvent: event, severity, ...metadata });
  }

  // Future: send to webhook URL if configured
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...alert, timestamp: new Date().toISOString() }),
    }).catch(() => {
      // Don't let alert delivery failures propagate
    });
  }
}

// Convenience helpers
export const alerts = {
  apiDown: (details?: string) =>
    fireAlert({ severity: "critical", event: "api_down", message: `API health check failed${details ? `: ${details}` : ""}` }),

  scraperFailed: (platform: string, error: string) =>
    fireAlert({ severity: "warning", event: "scraper_failed", message: `Scraper failed for ${platform}`, metadata: { platform, error } }),

  emailQueueBacklog: (depth: number) =>
    fireAlert({ severity: "warning", event: "email_queue_backlog", message: `Email queue depth: ${depth}`, metadata: { depth } }),

  highErrorRate: (rate: number, window: string) =>
    fireAlert({ severity: "critical", event: "high_error_rate", message: `Error rate ${rate}% in ${window}`, metadata: { rate, window } }),

  dbConnectionFailed: (error: string) =>
    fireAlert({ severity: "critical", event: "db_connection_failed", message: `Database connection failed: ${error}` }),

  accountLocked: (email: string) =>
    fireAlert({ severity: "info", event: "account_locked", message: `Account locked due to failed logins: ${email}`, metadata: { email } }),

  circuitOpened: (platform: string) =>
    fireAlert({ severity: "warning", event: "circuit_opened", message: `Circuit breaker opened for ${platform}`, metadata: { platform } }),
};
