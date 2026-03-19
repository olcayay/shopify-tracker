/**
 * Google Workspace Marketplace DOM Explorer
 *
 * Use this script to explore the rendered DOM structure of Google Workspace
 * Marketplace pages. Since it's an Angular SPA, we need Playwright to render
 * pages and then inspect the resulting HTML.
 *
 * Usage:
 *   npx tsx apps/scraper/scripts/gworkspace-explore.ts [page-type] [slug]
 *
 * Examples:
 *   npx tsx apps/scraper/scripts/gworkspace-explore.ts home
 *   npx tsx apps/scraper/scripts/gworkspace-explore.ts app "form_builder_by_jotform/989594444654"
 *   npx tsx apps/scraper/scripts/gworkspace-explore.ts category "business-tools"
 *   npx tsx apps/scraper/scripts/gworkspace-explore.ts search "project management"
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://workspace.google.com/marketplace";

const OUTPUT_DIR = resolve(import.meta.dirname, "../../../scripts/gworkspace-output");

async function explore() {
  const [pageType = "home", slug = ""] = process.argv.slice(2);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🔍 Exploring Google Workspace Marketplace: ${pageType} ${slug}\n`);

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Log all network requests (XHR/fetch)
  const networkRequests: { url: string; method: string; type: string; status?: number }[] = [];
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "xhr" || type === "fetch") {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        type,
      });
    }
  });
  page.on("response", (resp) => {
    const req = resp.request();
    const type = req.resourceType();
    if (type === "xhr" || type === "fetch") {
      const existing = networkRequests.find((r) => r.url === req.url());
      if (existing) existing.status = resp.status();
    }
  });

  // Determine URL
  let url: string;
  switch (pageType) {
    case "home":
      url = BASE_URL;
      break;
    case "app":
      url = `${BASE_URL}/app/${slug}`;
      break;
    case "category":
      url = `${BASE_URL}/category/${slug}`;
      break;
    case "search":
      url = `${BASE_URL}/search/${encodeURIComponent(slug)}?flow_type=2`;
      break;
    default:
      url = BASE_URL;
  }

  console.log(`📡 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "load", timeout: 30_000 });

  // Wait for Angular render
  console.log("⏳ Waiting for Angular render...");
  try {
    await page.waitForFunction(
      () => {
        const root = document.querySelector("app-root, [ng-version]");
        return root && root.children.length > 0;
      },
      { timeout: 15_000 },
    );
    console.log("✅ Angular rendered");
  } catch {
    console.log("⚠️  Angular render wait timed out");
  }

  // Extra wait for dynamic content
  await page.waitForTimeout(3000);

  // Get page info
  const title = await page.title();
  const html = await page.content();

  console.log(`\n📄 Page title: "${title}"`);
  console.log(`📏 HTML length: ${html.length} chars`);

  // Analyze DOM structure
  const analysis = await page.evaluate(() => {
    const result: Record<string, any> = {};

    // Angular app root
    const appRoot = document.querySelector("app-root");
    result.hasAppRoot = !!appRoot;
    result.ngVersion = document.querySelector("[ng-version]")?.getAttribute("ng-version");

    // All app links
    const appLinks = document.querySelectorAll('a[href*="/marketplace/app/"]');
    result.appLinkCount = appLinks.length;
    result.sampleAppLinks = Array.from(appLinks).slice(0, 5).map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent?.trim().slice(0, 100),
    }));

    // Category links
    const catLinks = document.querySelectorAll('a[href*="/marketplace/category/"]');
    result.categoryLinkCount = catLinks.length;
    result.sampleCategoryLinks = Array.from(catLinks).slice(0, 10).map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent?.trim().slice(0, 100),
    }));

    // Images from Google's CDN
    const images = document.querySelectorAll('img[src*="lh3.googleusercontent.com"]');
    result.googleImageCount = images.length;

    // Schema.org markup
    const schemas = document.querySelectorAll("[itemtype]");
    result.schemaTypes = Array.from(schemas).map((el) => el.getAttribute("itemtype"));

    // itemprop elements
    const itemprops = document.querySelectorAll("[itemprop]");
    result.itemprops = [...new Set(Array.from(itemprops).map((el) => el.getAttribute("itemprop")))];

    // All headings
    const headings = document.querySelectorAll("h1, h2, h3");
    result.headings = Array.from(headings).slice(0, 10).map((h) => ({
      tag: h.tagName,
      text: h.textContent?.trim().slice(0, 100),
    }));

    // data-* attributes (common in Angular apps)
    const dataAttrs = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-") || attr.name.startsWith("_ng")) {
          dataAttrs.add(attr.name);
        }
      }
    });
    result.dataAttributes = [...dataAttrs].slice(0, 30);

    // Rating-related elements
    const ratingEls = document.querySelectorAll('[aria-label*="star"], [aria-label*="rating"], [class*="rating"]');
    result.ratingElementCount = ratingEls.length;

    // Pricing-related text
    const bodyText = document.body.textContent || "";
    result.hasPricingInfo = /free|paid|trial|premium/i.test(bodyText);
    result.hasInstallCount = /\d+\+?\s*(users|installs|downloads)/i.test(bodyText);

    return result;
  });

  console.log("\n📊 DOM Analysis:");
  console.log(JSON.stringify(analysis, null, 2));

  console.log(`\n🌐 Network requests (XHR/Fetch): ${networkRequests.length}`);
  for (const req of networkRequests.slice(0, 20)) {
    console.log(`  ${req.method} ${req.status ?? "?"} ${req.url.slice(0, 120)}`);
  }

  // Save outputs
  const safeName = `${pageType}-${slug.replace(/[/\\]/g, "_") || "index"}`;
  writeFileSync(resolve(OUTPUT_DIR, `${safeName}.html`), html);
  writeFileSync(
    resolve(OUTPUT_DIR, `${safeName}-analysis.json`),
    JSON.stringify({ title, url, htmlLength: html.length, analysis, networkRequests }, null, 2),
  );

  console.log(`\n💾 Saved to: ${OUTPUT_DIR}/${safeName}.*`);

  await browser.close();
  console.log("\n✅ Done!\n");
}

explore().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
