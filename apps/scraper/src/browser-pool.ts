import { createLogger } from "@appranks/shared";

const log = createLogger("browser-pool");

/** Maximum number of jobs before browser is recycled */
const MAX_JOBS_PER_BROWSER = parseInt(process.env.BROWSER_POOL_MAX_JOBS || "10", 10);
/** Maximum lifetime of a browser in ms (default: 1 hour) */
const MAX_LIFETIME_MS = parseInt(process.env.BROWSER_POOL_MAX_LIFETIME_MS || "3600000", 10);

/** Lazily resolve playwright's chromium */
async function getChromium() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch {
    throw new Error(
      "Playwright is not installed. Browser-based scraping is unavailable in this environment.",
    );
  }
}

/**
 * Singleton browser pool that reuses a single Chromium process across jobs.
 * Each job gets its own BrowserContext (isolated cookies/storage).
 *
 * The browser is recycled after:
 *   - MAX_JOBS_PER_BROWSER jobs processed (default: 10)
 *   - MAX_LIFETIME_MS elapsed (default: 1 hour)
 */
export class BrowserPool {
  private browser: import("playwright").Browser | null = null;
  private jobCount = 0;
  private launchedAt = 0;
  private launching: Promise<import("playwright").Browser> | null = null;

  private shouldRecycle(): boolean {
    if (!this.browser || !this.browser.isConnected()) return true;
    if (this.jobCount >= MAX_JOBS_PER_BROWSER) return true;
    if (Date.now() - this.launchedAt >= MAX_LIFETIME_MS) return true;
    return false;
  }

  private async launchBrowser(): Promise<import("playwright").Browser> {
    const chromium = await getChromium();
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    this.launchedAt = Date.now();
    this.jobCount = 0;
    log.info("browser launched", { maxJobs: MAX_JOBS_PER_BROWSER, maxLifetimeMs: MAX_LIFETIME_MS });
    return browser;
  }

  /**
   * Get or create the shared browser instance.
   * Recycles the browser if it exceeds job count or lifetime limits.
   * Thread-safe: concurrent calls during launch wait for the same promise.
   */
  async getBrowser(): Promise<import("playwright").Browser> {
    if (this.shouldRecycle()) {
      // Close old browser if it exists
      if (this.browser) {
        const old = this.browser;
        this.browser = null;
        this.launching = null;
        await old.close().catch((err) => {
          log.warn("failed to close recycled browser", { error: String(err) });
        });
        log.info("browser recycled", { jobCount: this.jobCount });
      }
    }

    if (this.browser && this.browser.isConnected()) {
      this.jobCount++;
      return this.browser;
    }

    // Prevent concurrent launches
    if (!this.launching) {
      this.launching = this.launchBrowser().then((b) => {
        this.browser = b;
        this.launching = null;
        this.jobCount++;
        return b;
      });
    }

    return this.launching;
  }

  /** Create a new isolated context on the shared browser */
  async newContext(opts?: {
    userAgent?: string;
  }): Promise<import("playwright").BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      userAgent: opts?.userAgent,
    });
  }

  /** Shutdown the browser pool */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.launching = null;
      log.info("browser pool closed");
    }
  }

  /** Get current stats for monitoring */
  getStats() {
    return {
      isConnected: this.browser?.isConnected() ?? false,
      jobCount: this.jobCount,
      uptimeMs: this.launchedAt ? Date.now() - this.launchedAt : 0,
      maxJobs: MAX_JOBS_PER_BROWSER,
      maxLifetimeMs: MAX_LIFETIME_MS,
    };
  }
}

/** Singleton instance shared across all jobs in the worker process */
export const browserPool = new BrowserPool();
