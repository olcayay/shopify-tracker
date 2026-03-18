/**
 * Canva App Detail Page Explorer
 *
 * Navigates to a real Canva app detail page via browser (React SPA behind Cloudflare),
 * waits for hydration, and dumps:
 *   - Rendered HTML → scripts/canva-output/detail-explore.html
 *   - Intercepted API responses → scripts/canva-output/detail-explore-api.json
 *   - Any global JSON (__NEXT_DATA__, etc.) → scripts/canva-output/detail-explore-globals.json
 *
 * Usage: cd apps/scraper && npx tsx scripts/canva-detail-explore.ts [url]
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const TARGET_URL =
  process.argv[2] || "https://www.canva.com/apps/AAGX23MX5S8/jotform";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../scripts/canva-output");
const AUTH_STATE_CANDIDATES = [
  path.resolve(import.meta.dirname, "../canva-auth-state.json"),
  path.resolve(process.cwd(), "canva-auth-state.json"),
  path.resolve(process.cwd(), "apps/scraper/canva-auth-state.json"),
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load auth state
  let storageState: any;
  for (const p of AUTH_STATE_CANDIDATES) {
    if (fs.existsSync(p)) {
      storageState = JSON.parse(fs.readFileSync(p, "utf-8"));
      console.log(`Auth state loaded from: ${p} (${storageState.cookies?.length} cookies)`);
      break;
    }
  }
  if (!storageState) {
    console.warn("No auth state found — Cloudflare may block us");
  }

  console.log(`\nTarget: ${TARGET_URL}\n`);

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ...(storageState && { storageState }),
  });

  const page = await context.newPage();

  // --- Intercept all XHR/fetch responses ---
  const interceptedResponses: {
    url: string;
    status: number;
    contentType: string;
    body: string;
  }[] = [];

  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] || "";

    // Capture JSON API calls (skip static assets)
    if (
      ct.includes("json") ||
      url.includes("/_ajax/") ||
      url.includes("/api/") ||
      url.includes("graphql")
    ) {
      try {
        const body = await response.text();
        interceptedResponses.push({
          url,
          status: response.status(),
          contentType: ct,
          body: body.substring(0, 50000), // cap at 50KB per response
        });
        console.log(`  [API] ${response.status()} ${url.substring(0, 120)} (${body.length} bytes)`);
      } catch {}
    }
  });

  // --- First navigate to /apps to establish Cloudflare session ---
  console.log("Step 1: Loading /apps to establish Cloudflare session...");
  await page.goto("https://www.canva.com/apps", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(5000);
  console.log("  /apps loaded\n");

  // --- Navigate to detail page ---
  console.log("Step 2: Navigating to detail page...");
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  console.log("  Waiting for SPA hydration (8s)...");
  await page.waitForTimeout(8000);

  // --- Dump rendered HTML ---
  const html = await page.content();
  const htmlPath = path.join(OUTPUT_DIR, "detail-explore.html");
  fs.writeFileSync(htmlPath, html);
  console.log(`\nRendered HTML: ${htmlPath} (${html.length} bytes)`);

  // --- Extract global JSON variables ---
  const globals: Record<string, any> = {};

  const globalChecks = [
    "__NEXT_DATA__",
    "__APP_DATA__",
    "__CANVA_DATA__",
    "__INITIAL_STATE__",
    "__PRELOADED_STATE__",
    "window.stores",
    "window.__data",
    "window.__remixContext",
  ];

  for (const key of globalChecks) {
    try {
      const val = await page.evaluate((k) => {
        try {
          // Handle both window.X and nested paths like window.stores
          const parts = k.replace("window.", "").split(".");
          let obj: any = window;
          for (const p of parts) obj = obj[p];
          return obj;
        } catch {
          return undefined;
        }
      }, key);
      if (val !== undefined && val !== null) {
        globals[key] = val;
        console.log(`  [GLOBAL] ${key} found (${typeof val})`);
      }
    } catch {}
  }

  // Also check for any inline <script> tags with JSON data
  const scriptContents = await page.evaluate(() => {
    const scripts = document.querySelectorAll(
      'script[type="application/json"], script[type="application/ld+json"], script#__NEXT_DATA__'
    );
    return Array.from(scripts).map((s) => ({
      id: s.id || null,
      type: s.getAttribute("type"),
      content: s.textContent?.substring(0, 50000) || "",
    }));
  });

  if (scriptContents.length > 0) {
    globals["_inlineScripts"] = scriptContents;
    console.log(`  [SCRIPTS] ${scriptContents.length} inline JSON script tag(s) found`);
  }

  const globalsPath = path.join(OUTPUT_DIR, "detail-explore-globals.json");
  fs.writeFileSync(globalsPath, JSON.stringify(globals, null, 2));
  console.log(`Global JSON: ${globalsPath}`);

  // --- Save intercepted API responses ---
  const apiPath = path.join(OUTPUT_DIR, "detail-explore-api.json");
  fs.writeFileSync(apiPath, JSON.stringify(interceptedResponses, null, 2));
  console.log(`API responses: ${apiPath} (${interceptedResponses.length} calls)`);

  // --- Extract visible page structure ---
  const pageStructure = await page.evaluate(() => {
    const result: Record<string, any> = {};

    // Page title
    result.title = document.title;

    // Meta tags
    result.meta = {};
    document.querySelectorAll('meta[property], meta[name]').forEach((m) => {
      const key = m.getAttribute("property") || m.getAttribute("name");
      if (key) result.meta[key] = m.getAttribute("content");
    });

    // Main headings
    result.headings = Array.from(document.querySelectorAll("h1, h2, h3")).map((h) => ({
      tag: h.tagName,
      text: h.textContent?.trim().substring(0, 200),
    }));

    // All text sections (looking for description blocks)
    result.sections = [];
    document.querySelectorAll("section, [data-testid], [role='main']").forEach((s) => {
      const text = s.textContent?.trim().substring(0, 500);
      if (text && text.length > 20) {
        result.sections.push({
          tag: s.tagName,
          testId: s.getAttribute("data-testid"),
          role: s.getAttribute("role"),
          textPreview: text,
        });
      }
    });

    // Images (screenshots, icons)
    result.images = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.src?.substring(0, 200),
      alt: img.alt?.substring(0, 100),
      width: img.width,
      height: img.height,
    }));

    // Links
    result.links = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({
        href: a.getAttribute("href")?.substring(0, 200),
        text: a.textContent?.trim().substring(0, 100),
      }))
      .filter((l) => l.text && l.text.length > 0);

    // Check for specific app detail patterns
    result.appDetailElements = {};

    // Look for description/about sections
    const descEl = document.querySelector(
      '[data-testid*="description"], [class*="description"], [class*="about"]'
    );
    if (descEl) {
      result.appDetailElements.description = descEl.textContent?.trim().substring(0, 2000);
    }

    // Look for pricing section
    const pricingEl = document.querySelector(
      '[data-testid*="pricing"], [class*="pricing"], [class*="price"]'
    );
    if (pricingEl) {
      result.appDetailElements.pricing = pricingEl.textContent?.trim().substring(0, 1000);
    }

    // Look for screenshots/gallery
    const galleryImages = document.querySelectorAll(
      '[data-testid*="screenshot"] img, [class*="gallery"] img, [class*="screenshot"] img, [class*="carousel"] img'
    );
    result.appDetailElements.galleryImages = Array.from(galleryImages).map((img) => ({
      src: (img as HTMLImageElement).src?.substring(0, 200),
      alt: (img as HTMLImageElement).alt,
    }));

    // Body text length as a signal
    result.bodyTextLength = document.body?.textContent?.length || 0;

    return result;
  });

  const structurePath = path.join(OUTPUT_DIR, "detail-explore-structure.json");
  fs.writeFileSync(structurePath, JSON.stringify(pageStructure, null, 2));
  console.log(`Page structure: ${structurePath}`);

  // --- Summary ---
  console.log("\n=== SUMMARY ===");
  console.log(`Title: ${pageStructure.title}`);
  console.log(`Body text length: ${pageStructure.bodyTextLength} chars`);
  console.log(`Headings: ${pageStructure.headings?.length || 0}`);
  console.log(`Images: ${pageStructure.images?.length || 0}`);
  console.log(`Sections: ${pageStructure.sections?.length || 0}`);
  console.log(`API calls intercepted: ${interceptedResponses.length}`);
  console.log(`Global JSON vars found: ${Object.keys(globals).length}`);

  if (pageStructure.headings?.length > 0) {
    console.log("\nHeadings:");
    pageStructure.headings.slice(0, 10).forEach((h: any) => {
      console.log(`  <${h.tag}> ${h.text}`);
    });
  }

  await browser.close();
  console.log("\nDone! Analyze the output files to understand the page structure.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
