import { createLogger } from "@appranks/shared";
import { browserPool } from "./browser-pool.js";
import { IS_SMOKE_TEST } from "./constants.js";

const log = createLogger("browser-client");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Error messages that indicate the browser process has crashed or been killed (e.g. OOM) */
const BROWSER_CRASH_PATTERNS = [
  "Target page, context or browser has been closed",
  "browser has been closed",
  "Browser closed",
  "Protocol error",
  "Target closed",
];

/**
 * Per-job Playwright wrapper — uses the shared BrowserPool
 * for the browser process, but creates isolated contexts per job.
 *
 * Each BrowserClient tracks its own contexts and closes them on `close()`.
 * The underlying browser process is managed by BrowserPool.
 */
export class BrowserClient {
  private contexts: import("playwright").BrowserContext[] = [];

  /** Check if an error indicates the browser process has crashed */
  static isBrowserCrash(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return BROWSER_CRASH_PATTERNS.some((pattern) => msg.includes(pattern));
  }

  private async fetchPageInternal(url: string, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; waitForSelector?: string; extraWaitMs?: number }): Promise<string> {
    const t0 = Date.now();
    const context = await browserPool.newContext({ userAgent: USER_AGENT });
    this.contexts.push(context);
    const page = await context.newPage();

    try {
      // Smoke test: use faster wait strategy
      const waitUntil = IS_SMOKE_TEST ? "domcontentloaded" : (opts?.waitUntil ?? "networkidle");
      const gotoTimeout = IS_SMOKE_TEST ? 15_000 : 30_000;
      const selectorTimeout = IS_SMOKE_TEST ? 8_000 : 15_000;
      const extraWait = IS_SMOKE_TEST ? 500 : (opts?.extraWaitMs ?? 2000);

      log.info("fetching page", { url, waitUntil });
      const tGoto = Date.now();
      await page.goto(url, { waitUntil, timeout: gotoTimeout });
      const gotoMs = Date.now() - tGoto;

      let selectorMs = 0;
      if (opts?.waitForSelector) {
        const tSel = Date.now();
        await page.waitForSelector(opts.waitForSelector, { timeout: selectorTimeout }).catch(() => {
          log.warn("waitForSelector timed out, continuing", { selector: opts.waitForSelector });
        });
        selectorMs = Date.now() - tSel;
      }
      await page.waitForTimeout(extraWait);
      log.info("browser:page_timing", { url: url.slice(0, 120), gotoMs, selectorMs, extraWait, totalMs: Date.now() - t0 });
      return await page.content();
    } finally {
      await context.close().catch(() => {});
      this.contexts = this.contexts.filter((c) => c !== context);
    }
  }

  async fetchPage(url: string, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; waitForSelector?: string; extraWaitMs?: number }): Promise<string> {
    try {
      return await this.fetchPageInternal(url, opts);
    } catch (err) {
      if (!BrowserClient.isBrowserCrash(err)) throw err;

      log.warn("browser crash detected during fetchPage, recycling browser and retrying", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      await browserPool.recycleBrowser();

      // Retry once with a fresh browser
      return await this.fetchPageInternal(url, opts);
    }
  }

  private async withPageInternal<T>(url: string, callback: (page: import("playwright").Page) => Promise<T>, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; extraWaitMs?: number }): Promise<T> {
    const t0 = Date.now();
    const context = await browserPool.newContext({ userAgent: USER_AGENT });
    this.contexts.push(context);
    const page = await context.newPage();

    try {
      const waitUntil = IS_SMOKE_TEST ? "domcontentloaded" : (opts?.waitUntil ?? "networkidle");
      const gotoTimeout = IS_SMOKE_TEST ? 15_000 : 45_000;
      const extraWait = IS_SMOKE_TEST ? 500 : (opts?.extraWaitMs ?? 3000);

      log.info("opening page for interaction", { url, waitUntil });
      await page.goto(url, { waitUntil, timeout: gotoTimeout });
      await page.waitForTimeout(extraWait);
      log.info("browser:page_timing", { url: url.slice(0, 120), totalMs: Date.now() - t0 });
      return await callback(page);
    } finally {
      await context.close().catch(() => {});
      this.contexts = this.contexts.filter((c) => c !== context);
    }
  }

  /**
   * Opens a page, then hands the live Playwright Page to a callback
   * for custom interactions (clicking, evaluating JS, etc.).
   */
  async withPage<T>(url: string, callback: (page: import("playwright").Page) => Promise<T>, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; extraWaitMs?: number }): Promise<T> {
    try {
      return await this.withPageInternal(url, callback, opts);
    } catch (err) {
      if (!BrowserClient.isBrowserCrash(err)) throw err;

      log.warn("browser crash detected during withPage, recycling browser and retrying", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      await browserPool.recycleBrowser();

      // Retry once with a fresh browser
      return await this.withPageInternal(url, callback, opts);
    }
  }

  /** Close any remaining open contexts for this job */
  async close(): Promise<void> {
    for (const ctx of this.contexts) {
      await ctx.close().catch(() => {});
    }
    this.contexts = [];
    // NOTE: We do NOT close the shared browser pool here.
    // The pool manages the browser lifecycle independently.
  }
}
