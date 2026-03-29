/**
 * Prometheus-compatible metrics endpoint (PLA-189).
 *
 * Exposes application metrics in Prometheus text format.
 * Access via GET /metrics (protected by system admin auth in production).
 *
 * For Grafana dashboards, point Prometheus scraper at:
 *   https://api.appranks.io/metrics
 *
 * Key metrics:
 * - http_requests_total: request count by method, route, status
 * - http_request_duration_seconds: request latency histogram
 * - scraper_jobs_total: scraper job count by type, status
 * - db_query_duration_seconds: database query latency
 * - active_users_total: current active user count
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface MetricCounter {
  name: string;
  help: string;
  labels: Record<string, string>;
  value: number;
}

interface MetricGauge {
  name: string;
  help: string;
  value: number;
}

// In-memory metric storage
const counters = new Map<string, MetricCounter>();
const gauges = new Map<string, MetricGauge>();
const histogramBuckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const histogramData = new Map<string, { sum: number; count: number; buckets: Map<number, number> }>();

function counterKey(name: string, labels: Record<string, string>): string {
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
}

export function incrementCounter(name: string, labels: Record<string, string>, help = "") {
  const key = counterKey(name, labels);
  const existing = counters.get(key);
  if (existing) {
    existing.value++;
  } else {
    counters.set(key, { name, help, labels, value: 1 });
  }
}

export function setGauge(name: string, value: number, help = "") {
  gauges.set(name, { name, help, value });
}

export function observeHistogram(name: string, value: number) {
  let data = histogramData.get(name);
  if (!data) {
    data = { sum: 0, count: 0, buckets: new Map(histogramBuckets.map((b) => [b, 0])) };
    histogramData.set(name, data);
  }
  data.sum += value;
  data.count++;
  for (const bucket of histogramBuckets) {
    if (value <= bucket) data.buckets.set(bucket, (data.buckets.get(bucket) || 0) + 1);
  }
}

/**
 * Format all metrics in Prometheus text exposition format.
 */
export function formatMetrics(): string {
  const lines: string[] = [];
  const helps = new Set<string>();

  // Counters
  for (const [key, counter] of counters) {
    if (!helps.has(counter.name)) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      helps.add(counter.name);
    }
    lines.push(`${key} ${counter.value}`);
  }

  // Gauges
  for (const [, gauge] of gauges) {
    lines.push(`# HELP ${gauge.name} ${gauge.help}`);
    lines.push(`# TYPE ${gauge.name} gauge`);
    lines.push(`${gauge.name} ${gauge.value}`);
  }

  // Histograms
  for (const [name, data] of histogramData) {
    lines.push(`# HELP ${name} Request duration histogram`);
    lines.push(`# TYPE ${name} histogram`);
    let cumulative = 0;
    for (const bucket of histogramBuckets) {
      cumulative += data.buckets.get(bucket) || 0;
      lines.push(`${name}_bucket{le="${bucket}"} ${cumulative}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${data.count}`);
    lines.push(`${name}_sum ${data.sum}`);
    lines.push(`${name}_count ${data.count}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Register metrics collection hooks on the Fastify instance.
 */
export function registerMetricsHooks(app: FastifyInstance) {
  // Track request count and duration
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions?.url || request.url.split("?")[0];
    const method = request.method;
    const status = String(reply.statusCode);
    const duration = reply.elapsedTime / 1000; // ms to seconds

    incrementCounter(
      "http_requests_total",
      { method, route: route.slice(0, 50), status },
      "Total HTTP requests"
    );

    observeHistogram("http_request_duration_seconds", duration);
  });
}
