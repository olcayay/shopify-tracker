/**
 * Rotating proxy pool for scraping resilience (PLA-198).
 *
 * Configuration via environment variables:
 *   PROXY_URLS=http://user:pass@proxy1:8080,http://user:pass@proxy2:8080
 *   PROXY_ROTATION=round-robin|random|least-used
 *   PROXY_HEALTH_CHECK_INTERVAL=300 (seconds)
 *
 * If PROXY_URLS is not set, requests go direct (no proxy).
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("proxy-pool");

export interface ProxyConfig {
  url: string;
  failures: number;
  successes: number;
  lastUsed: number;
  isHealthy: boolean;
}

let proxies: ProxyConfig[] = [];
let roundRobinIndex = 0;
let initialized = false;

/**
 * Initialize the proxy pool from environment.
 */
export function initProxyPool(): void {
  if (initialized) return;
  initialized = true;

  const proxyUrls = process.env.PROXY_URLS;
  if (!proxyUrls) {
    log.info("no proxies configured — using direct connections");
    return;
  }

  proxies = proxyUrls.split(",").map((url) => ({
    url: url.trim(),
    failures: 0,
    successes: 0,
    lastUsed: 0,
    isHealthy: true,
  }));

  log.info("proxy pool initialized", { count: proxies.length });
}

/**
 * Get the next proxy URL to use.
 * Returns null if no proxies configured or all unhealthy.
 */
export function getNextProxy(): string | null {
  initProxyPool();

  const healthy = proxies.filter((p) => p.isHealthy);
  if (healthy.length === 0) return null;

  const rotation = process.env.PROXY_ROTATION || "round-robin";

  switch (rotation) {
    case "random": {
      const idx = Math.floor(Math.random() * healthy.length);
      healthy[idx].lastUsed = Date.now();
      return healthy[idx].url;
    }
    case "least-used": {
      const sorted = [...healthy].sort((a, b) => a.lastUsed - b.lastUsed);
      sorted[0].lastUsed = Date.now();
      return sorted[0].url;
    }
    case "round-robin":
    default: {
      const proxy = healthy[roundRobinIndex % healthy.length];
      roundRobinIndex++;
      proxy.lastUsed = Date.now();
      return proxy.url;
    }
  }
}

/**
 * Report a successful request through a proxy.
 */
export function reportSuccess(proxyUrl: string): void {
  const proxy = proxies.find((p) => p.url === proxyUrl);
  if (proxy) {
    proxy.successes++;
    proxy.failures = 0;
    proxy.isHealthy = true;
  }
}

/**
 * Report a failed request through a proxy.
 * After 3 consecutive failures, mark as unhealthy.
 */
export function reportFailure(proxyUrl: string): void {
  const proxy = proxies.find((p) => p.url === proxyUrl);
  if (proxy) {
    proxy.failures++;
    if (proxy.failures >= 3) {
      proxy.isHealthy = false;
      log.warn("proxy marked unhealthy", { url: proxyUrl.replace(/:[^:@]+@/, ":***@"), failures: proxy.failures });

      // Schedule health check recovery after 5 minutes
      setTimeout(() => {
        proxy.isHealthy = true;
        proxy.failures = 0;
        log.info("proxy recovered", { url: proxyUrl.replace(/:[^:@]+@/, ":***@") });
      }, 300000);
    }
  }
}

/**
 * Get pool status for monitoring.
 */
export function getPoolStatus(): { total: number; healthy: number; proxies: { url: string; healthy: boolean; successes: number; failures: number }[] } {
  initProxyPool();
  return {
    total: proxies.length,
    healthy: proxies.filter((p) => p.isHealthy).length,
    proxies: proxies.map((p) => ({
      url: p.url.replace(/:[^:@]+@/, ":***@"), // Mask credentials
      healthy: p.isHealthy,
      successes: p.successes,
      failures: p.failures,
    })),
  };
}

/**
 * Check if proxies are configured.
 */
export function hasProxies(): boolean {
  initProxyPool();
  return proxies.length > 0;
}
