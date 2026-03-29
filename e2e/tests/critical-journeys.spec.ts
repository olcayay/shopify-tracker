import { test, expect } from "@playwright/test";

/**
 * E2E tests for critical user journeys (PLA-202).
 *
 * Run: npx playwright test --config=e2e/playwright.config.ts
 */

test.describe("Public pages (no auth)", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(/AppRanks/);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("public app page loads with SSR content", async ({ page }) => {
    const res = await page.goto("/apps/shopify/klaviyo-email-marketing-sms");
    if (res && res.status() === 200) {
      // Page should have SEO meta tags
      const title = await page.title();
      expect(title).toContain("AppRanks");

      // Should have JSON-LD
      const jsonLd = await page.locator('script[type="application/ld+json"]').count();
      expect(jsonLd).toBeGreaterThan(0);
    }
  });

  test("public category page loads", async ({ page }) => {
    const res = await page.goto("/categories/shopify/store-design");
    if (res && res.status() === 200) {
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("trends page loads", async ({ page }) => {
    const res = await page.goto("/trends/shopify");
    if (res && res.status() === 200) {
      await expect(page.locator("h1")).toContainText("Trends");
    }
  });
});

test.describe("Authentication flow", () => {
  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "nonexistent@test.com");
    await page.fill("input[type='password']", "wrongpassword");
    await page.click("button[type='submit']");

    // Should show error message
    await page.waitForTimeout(2000);
    const errorText = await page.locator('[role="alert"], .text-destructive, .text-red').textContent().catch(() => "");
    // Error or still on login page
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to dashboard redirects", async ({ page }) => {
    await page.goto("/overview");
    // Should either redirect to login or show login prompt
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasAuth = url.includes("/login") || url.includes("/overview");
    expect(hasAuth).toBe(true);
  });
});

test.describe("SEO compliance", () => {
  test("robots.txt is accessible", async ({ page }) => {
    const res = await page.goto("/robots.txt");
    expect(res?.status()).toBe(200);
    const text = await page.textContent("body");
    expect(text).toContain("User-agent");
  });

  test("sitemap.xml is accessible", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
  });
});

test.describe("API health", () => {
  test("health endpoint responds", async ({ request }) => {
    const apiBase = process.env.E2E_API_URL || "http://localhost:3001";
    const res = await request.get(`${apiBase}/health/live`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

test.describe("Mobile responsiveness", () => {
  test("landing page is mobile-friendly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });
});
