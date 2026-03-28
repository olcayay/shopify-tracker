import { createLogger } from "@appranks/shared";
import {
  HTTP_DEFAULT_DELAY_MS,
  HTTP_DEFAULT_MAX_RETRIES,
  HTTP_DEFAULT_MAX_CONCURRENCY,
  HTTP_MAX_RESPONSE_SIZE,
  HTTP_CONCURRENCY_POLL_MS,
  HTTP_RATE_LIMIT_BASE_MS,
  HTTP_RAW_RATE_LIMIT_BASE_MS,
} from "./constants.js";

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
}

const DEFAULT_OPTIONS: Required<HttpClientOptions> = {
  delayMs: HTTP_DEFAULT_DELAY_MS,
  maxRetries: HTTP_DEFAULT_MAX_RETRIES,
  maxConcurrency: HTTP_DEFAULT_MAX_CONCURRENCY,
};

export class HttpClient {
  private options: Required<HttpClientOptions>;
  private lastRequestTime = 0;
  private activeRequests = 0;

  constructor(options: HttpClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async fetchPage(url: string, extraHeaders?: Record<string, string>): Promise<string> {
    await this.waitForSlot();

    this.activeRequests++;
    try {
      return await this.fetchWithRetry(url, extraHeaders);
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

    // Enforce delay between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.options.delayMs) {
      await this.sleep(this.options.delayMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchWithRetry(url: string, extraHeaders?: Record<string, string>): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
          headers: {
            "User-Agent": ua,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            ...extraHeaders,
          },
          redirect: "follow",
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          // 429 Too Many Requests — retry with aggressive backoff
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            // Use Retry-After header, or 4s * 2^attempt (4s, 8s, 16s, 32s, 64s)
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : HTTP_RATE_LIMIT_BASE_MS * Math.pow(2, attempt);
            log.warn("rate limited (429), backing off", { url, attempt: attempt + 1, waitMs });
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
          const backoff = Math.pow(2, attempt) * 1000;
          await this.sleep(backoff);
        }
      }
    }

    log.error("all fetch attempts exhausted", {
      url,
      attempts: this.options.maxRetries + 1,
      error: lastError?.message,
    });

    throw new Error(
      `All ${this.options.maxRetries + 1} attempts failed for ${url}: ${lastError?.message}`
    );
  }

  private async fetchRawWithRetry(url: string, init: RequestInit): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
          ...init,
          headers: {
            "User-Agent": ua,
            ...init.headers,
          },
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : HTTP_RAW_RATE_LIMIT_BASE_MS * Math.pow(2, attempt);
            log.warn("rate limited (429), backing off", { url, attempt: attempt + 1, waitMs });
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
          const backoff = Math.pow(2, attempt) * 1000;
          await this.sleep(backoff);
        }
      }
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
