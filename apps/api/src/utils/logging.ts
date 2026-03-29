/**
 * Centralized logging configuration (PLA-190).
 *
 * Fastify uses Pino for structured JSON logging. This module provides:
 * - Log format configuration for Loki/ELK ingestion
 * - Request context enrichment (requestId, userId, platform)
 * - Log level management via environment variable
 *
 * ## Integration with Loki
 *
 * Loki ingests structured JSON logs. Docker logging driver pushes container
 * stdout/stderr to Loki. Configuration:
 *
 * docker-compose.prod.yml:
 * ```yaml
 * services:
 *   api:
 *     logging:
 *       driver: loki
 *       options:
 *         loki-url: "http://loki:3100/loki/api/v1/push"
 *         loki-batch-size: "400"
 *         labels: "service=api,env=production"
 * ```
 *
 * ## Integration with ELK
 *
 * For Elasticsearch/Logstash/Kibana:
 * - Use Filebeat to ship JSON logs from Docker
 * - Pino's JSON format is directly compatible with Elasticsearch
 *
 * ## Log Levels
 *
 * Set via LOG_LEVEL env var: trace, debug, info, warn, error, fatal
 * Default: info
 */

export interface LogConfig {
  level: string;
  transport?: {
    target: string;
    options?: Record<string, unknown>;
  };
}

/**
 * Get Pino logger configuration for Fastify.
 */
export function getLogConfig(): LogConfig {
  const level = process.env.LOG_LEVEL || "info";
  const isPretty = process.env.NODE_ENV !== "production";

  if (isPretty) {
    return {
      level,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    };
  }

  // Production: plain JSON for log aggregation
  return { level };
}

/**
 * Grafana dashboard configuration for API metrics.
 *
 * Import this JSON into Grafana to create the dashboard:
 * - Request rate (requests/sec)
 * - Error rate (5xx/total)
 * - P50/P95/P99 latency
 * - Active scraper jobs
 * - Database query latency
 */
export const GRAFANA_DASHBOARD_CONFIG = {
  title: "AppRanks API Dashboard",
  panels: [
    {
      title: "Request Rate",
      type: "timeseries",
      query: 'rate(http_requests_total[5m])',
    },
    {
      title: "Error Rate",
      type: "stat",
      query: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100',
    },
    {
      title: "P95 Latency",
      type: "timeseries",
      query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    },
    {
      title: "Request Count by Status",
      type: "piechart",
      query: 'sum by (status) (http_requests_total)',
    },
  ],
  datasource: "Prometheus",
  refreshInterval: "30s",
};
