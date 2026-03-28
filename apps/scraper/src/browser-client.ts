import { createLogger } from "@appranks/shared";
import { browserPool } from "./browser-pool.js";

const log = createLogger("browser-client");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Per-job Playwright wrapper — uses the shared BrowserPool
 * for the browser process, but creates isolated contexts per job.
 *
 * Each BrowserClient tracks its own contexts and closes them on `close()`.
 * The underlying browser process is managed by BrowserPool.
 */
export class BrowserClient {
  private contexts: import("playwright").BrowserContext[] = [];

  async fetchPage(url: string, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; waitForSelector?: string; extraWaitMs?: number }): Promise<string> {
    const context = await browserPool.newContext({ userAgent: USER_AGENT });
    this.contexts.push(context);
    const page = await context.newPage();

    try {
      const waitUntil = opts?.waitUntil ?? "networkidle";
      log.info("fetching page", { url, waitUntil });
      await page.goto(url, { waitUntil, timeout: 30_000 });
      if (opts?.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, { timeout: 15_000 }).catch(() => {
          log.warn("waitForSelector timed out, continuing", { selector: opts.waitForSelector });
        });
      }
      // Extra wait for SPA hydration (matches Python script pattern)
      await page.waitForTimeout(opts?.extraWaitMs ?? 2000);
      return await page.content();
    } finally {
      await context.close();
      this.contexts = this.contexts.filter((c) => c !== context);
    }
  }

  /**
   * Opens a page, then hands the live Playwright Page to a callback
   * for custom interactions (clicking, evaluating JS, etc.).
   */
  async withPage<T>(url: string, callback: (page: import("playwright").Page) => Promise<T>, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; extraWaitMs?: number }): Promise<T> {
    const context = await browserPool.newContext({ userAgent: USER_AGENT });
    this.contexts.push(context);
    const page = await context.newPage();

    try {
      const waitUntil = opts?.waitUntil ?? "networkidle";
      log.info("opening page for interaction", { url, waitUntil });
      await page.goto(url, { waitUntil, timeout: 45_000 });
      await page.waitForTimeout(opts?.extraWaitMs ?? 3000);
      return await callback(page);
    } finally {
      await context.close();
      this.contexts = this.contexts.filter((c) => c !== context);
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
