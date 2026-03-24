import { chromium, type Browser, type Page } from "playwright";
import { createLogger } from "@appranks/shared";

const log = createLogger("browser-client");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Lazy Playwright wrapper — browser is launched on first use,
 * reused across calls, and closed on shutdown.
 */
export class BrowserClient {
  private browser: Browser | null = null;

  async fetchPage(url: string, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; waitForSelector?: string; extraWaitMs?: number }): Promise<string> {
    if (!this.browser) {
      log.info("launching browser");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
    }

    const context = await this.browser.newContext({ userAgent: USER_AGENT });
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
    }
  }

  /**
   * Opens a page, then hands the live Playwright Page to a callback
   * for custom interactions (clicking, evaluating JS, etc.).
   */
  async withPage<T>(url: string, callback: (page: Page) => Promise<T>, opts?: { waitUntil?: "networkidle" | "domcontentloaded" | "load"; extraWaitMs?: number }): Promise<T> {
    if (!this.browser) {
      log.info("launching browser");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
    }

    const context = await this.browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    try {
      const waitUntil = opts?.waitUntil ?? "networkidle";
      log.info("opening page for interaction", { url, waitUntil });
      await page.goto(url, { waitUntil, timeout: 45_000 });
      await page.waitForTimeout(opts?.extraWaitMs ?? 3000);
      return await callback(page);
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
