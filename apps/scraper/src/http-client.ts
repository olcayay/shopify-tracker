import { createLogger } from "@appranks/shared";
import {
  HTTP_DEFAULT_DELAY_MS,
  HTTP_DEFAULT_MAX_RETRIES,
  HTTP_DEFAULT_MAX_CONCURRENCY,
  HTTP_MAX_RESPONSE_SIZE,
  HTTP_CONCURRENCY_POLL_MS,
  HTTP_RATE_LIMIT_BASE_MS,
  HTTP_RAW_RATE_LIMIT_BASE_MS,
  HTTP_REQUEST_TIMEOUT_MS,
  HTTP_MAX_CUMULATIVE_BACKOFF_MS,
} from "./constants.js";
import { recordFailure as recordCircuitFailure } from "./circuit-breaker.js";

const log = createLogger("http-client");

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

export interface HttpClientOptions {
  delayMs?: number;
  maxRetries?: number;
  maxConcurrency?: number;
  /** Platform name for circuit breaker integration. When set, exhausted retries record a failure. */
  platform?: string;
}

interface HttpClientConfig {
  delayMs: number;
  maxRetries: number;
  maxConcurrency: number;
}

const DEFAULT_OPTIONS: HttpClientConfig = {
  delayMs: HTTP_DEFAULT_DELAY_MS,
  maxRetries: HTTP_DEFAULT_MAX_RETRIES,
  maxConcurrency: HTTP_DEFAULT_MAX_CONCURRENCY,
};

/** Maximum adaptive delay multiplier (4x base delay) */
const ADAPTIVE_MAX_MULTIPLIER = 4.0;
/** Consecutive successes needed before reducing delay multiplier */
const ADAPTIVE_RECOVERY_THRESHOLD = 20;
/** Recovery factor — multiplier shrinks by 10% per threshold */
const ADAPTIVE_RECOVERY_FACTOR = 0.9;

export class HttpClient {
  private options: HttpClientConfig;
  private platform?: string;
  private lastRequestTime = 0;
  private activeRequests = 0;
  /** Adaptive delay multiplier — increases on 429, recovers on consecutive successes */
  private delayMultiplier = 1.0;
  private consecutiveSuccesses = 0;

  constructor(options: HttpClientOptions = {}) {
    const { platform, ...rest } = options;
    this.options = { ...DEFAULT_OPTIONS, ...rest };
    this.platform = platform;
  }

  async fetchPage(url: string, extraHeaders?: Record<string, string>): Promise<string> {
    const t0 = Date.now();
    await this.waitForSlot();
    const waitMs = Date.now() - t0;

    this.activeRequests++;
    try {
      const t1 = Date.now();
      const result = await this.fetchWithRetry(url, extraHeaders);
      log.info("http:request_timing", { url: url.slice(0, 120), waitMs, fetchMs: Date.now() - t1, totalMs: Date.now() - t0 });
      return result;
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Fetch with custom request options (method, headers, body).
   * Useful for POST API calls (e.g. Canva search API).
   */
  async fetchRaw(url: string, init: RequestInit): Promise<string> {
    await this.waitForSlot();

    this.activeRequests++;
    try {
      return await this.fetchRawWithRetry(url, init);
    } finally {
      this.activeRequests--;
    }
  }

  private async waitForSlot(): Promise<void> {
    // Wait for concurrency slot
    while (this.activeRequests >= this.options.maxConcurrency) {
      await this.sleep(HTTP_CONCURRENCY_POLL_MS);
    }

    // Enforce delay between requests (scaled by adaptive multiplier)
    const effectiveDelay = this.options.delayMs * this.delayMultiplier;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < effectiveDelay) {
      await this.sleep(effectiveDelay - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /** Record a successful request — may reduce adaptive delay */
  private recordSuccess(): void {
    this.consecutiveSuccesses++;
    if (this.consecutiveSuccesses >= ADAPTIVE_RECOVERY_THRESHOLD && this.delayMultiplier > 1.0) {
      const prev = this.delayMultiplier;
      this.delayMultiplier = Math.max(1.0, this.delayMultiplier * ADAPTIVE_RECOVERY_FACTOR);
      this.consecutiveSuccesses = 0;
      if (prev !== this.delayMultiplier) {
        log.info("adaptive delay recovered", { multiplier: this.delayMultiplier.toFixed(2), effectiveDelayMs: Math.round(this.options.delayMs * this.delayMultiplier) });
      }
    }
  }

  /** Record a 429 rate limit — increases adaptive delay */
  private recordRateLimit(): void {
    this.consecutiveSuccesses = 0;
    const prev = this.delayMultiplier;
    this.delayMultiplier = Math.min(ADAPTIVE_MAX_MULTIPLIER, this.delayMultiplier * 2.0);
    if (prev !== this.delayMultiplier) {
      log.warn("adaptive delay increased", { multiplier: this.delayMultiplier.toFixed(2), effectiveDelayMs: Math.round(this.options.delayMs * this.delayMultiplier) });
    }
  }

  private async fetchWithRetry(url: string, extraHeaders?: Record<string, string>): Promise<string> {
    let lastError: Error | null = null;
    let cumulativeBackoffMs = 0;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
          headers: {
            "User-Agent": ua,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            ...extraHeaders,
          },
          redirect: "follow",
          signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          // 429 Too Many Requests — retry with aggressive backoff
          if (response.status === 429) {
            this.recordRateLimit();
            const retryAfter = response.headers.get("Retry-After");
            // Use Retry-After header, or 4s * 2^attempt (4s, 8s, 16s, 32s, 64s)
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : HTTP_RATE_LIMIT_BASE_MS * Math.pow(2, attempt);
            cumulativeBackoffMs += waitMs;
            if (cumulativeBackoffMs > HTTP_MAX_CUMULATIVE_BACKOFF_MS) {
              log.warn("cumulative backoff budget exceeded, bailing", { url, cumulativeBackoffMs, budgetMs: HTTP_MAX_CUMULATIVE_BACKOFF_MS });
              lastError = new Error(`Rate limit backoff budget exceeded (${Math.round(cumulativeBackoffMs / 1000)}s > ${Math.round(HTTP_MAX_CUMULATIVE_BACKOFF_MS / 1000)}s) for ${url}`);
              break;
            }
            log.warn("rate limited (429), backing off", { url, attempt: attempt + 1, waitMs, cumulativeBackoffMs });
            lastError = err;
            if (attempt < this.options.maxRetries) {
              await this.sleep(waitMs);
            }
            continue;
          }
          // Don't retry on other 4xx client errors (404, 403, etc.) — they won't change
          if (response.status >= 400 && response.status < 500) {
            log.warn("non-retryable client error", { url, status: response.status });
            lastError = err;
            break;
          }
          throw err;
        }

        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > HTTP_MAX_RESPONSE_SIZE) {
          log.warn("response too large, skipping", { url, contentLength });
          lastError = new Error(`Response too large: ${contentLength} bytes (max ${HTTP_MAX_RESPONSE_SIZE})`);
          break;
        }

        const text = await response.text();
        if (text.length > HTTP_MAX_RESPONSE_SIZE) {
          log.warn("response body too large", { url, size: text.length });
        }
        this.recordSuccess();
        return text;
      } catch (error) {
        lastError = error as Error;
        log.warn("fetch attempt failed", {
          url,
          attempt: attempt + 1,
          maxAttempts: this.options.maxRetries + 1,
          error: lastError.message,
        });

        if (attempt < this.options.maxRetries) {
          const backoff = Math.min(Math.pow(2, attempt) * 500, 4000);
          const jitter = backoff * (0.8 + Math.random() * 0.4); // ±20% jitter
          await this.sleep(jitter);
        }
      }
    }

    log.error("all fetch attempts exhausted", {
      url,
      attempts: this.options.maxRetries + 1,
      error: lastError?.message,
    });

    // Record failure to circuit breaker if platform is set
    if (this.platform) {
      recordCircuitFailure(this.platform).catch(() => {});
    }

    throw new Error(
      `All ${this.options.maxRetries + 1} attempts failed for ${url}: ${lastError?.message}`
    );
  }

  private async fetchRawWithRetry(url: string, init: RequestInit): Promise<string> {
    let lastError: Error | null = null;
    let cumulativeBackoffMs = 0;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
          ...init,
          headers: {
            "User-Agent": ua,
            "Accept-Encoding": "gzip, deflate, br",
            ...init.headers,
          },
          signal: init.signal ?? AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          if (response.status === 429) {
            this.recordRateLimit();
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : HTTP_RAW_RATE_LIMIT_BASE_MS * Math.pow(2, attempt);
            cumulativeBackoffMs += waitMs;
            if (cumulativeBackoffMs > HTTP_MAX_CUMULATIVE_BACKOFF_MS) {
              log.warn("cumulative backoff budget exceeded, bailing", { url, cumulativeBackoffMs, budgetMs: HTTP_MAX_CUMULATIVE_BACKOFF_MS });
              lastError = new Error(`Rate limit backoff budget exceeded (${Math.round(cumulativeBackoffMs / 1000)}s > ${Math.round(HTTP_MAX_CUMULATIVE_BACKOFF_MS / 1000)}s) for ${url}`);
              break;
            }
            log.warn("rate limited (429), backing off", { url, attempt: attempt + 1, waitMs, cumulativeBackoffMs });
            lastError = err;
            if (attempt < this.options.maxRetries) {
              await this.sleep(waitMs);
            }
            continue;
          }
          if (response.status >= 400 && response.status < 500) {
            log.warn("non-retryable client error", { url, status: response.status });
            lastError = err;
            break;
          }
          throw err;
        }

        this.recordSuccess();
        return await response.text();
      } catch (error) {
        lastError = error as Error;
        log.warn("fetch attempt failed", {
          url,
          attempt: attempt + 1,
          maxAttempts: this.options.maxRetries + 1,
          error: lastError.message,
        });

        if (attempt < this.options.maxRetries) {
          const backoff = Math.min(Math.pow(2, attempt) * 500, 4000);
          const jitter = backoff * (0.8 + Math.random() * 0.4); // ±20% jitter
          await this.sleep(jitter);
        }
      }
    }

    // Record failure to circuit breaker if platform is set
    if (this.platform) {
      recordCircuitFailure(this.platform).catch(() => {});
    }

    throw new Error(
      `All ${this.options.maxRetries + 1} attempts failed for ${url}: ${lastError?.message}`
    );
  }

  /** @internal — visible for testing */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
