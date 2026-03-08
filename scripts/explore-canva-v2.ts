/**
 * Canva Marketplace Exploration v2 — focused on getting actual page content
 *
 * Usage: npx tsx scripts/explore-canva-v2.ts
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const OUT_DIR = "scripts/canva-output";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: false }); // Non-headless to avoid bot detection
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  const page = await context.newPage();

  // --- 1. Main /apps page ---
  console.log("\n1. Loading /apps page...");
  await page.goto("https://www.canva.com/apps", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(10_000);

  // Take screenshot
  await page.screenshot({ path: `${OUT_DIR}/main-page.png`, fullPage: false });
  console.log("  Screenshot saved");

  // Save page HTML
  const mainHtml = await page.content();
  writeFileSync(`${OUT_DIR}/main-page.html`, mainHtml);
  console.log(`  HTML saved (${mainHtml.length} chars)`);

  // Scroll down to load more content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${OUT_DIR}/main-page-scrolled.png`, fullPage: false });

  // Extract structured data
  const mainData = await page.evaluate(() => {
    // Get all app links with their context
    const appLinks: { href: string; text: string; section: string }[] = [];
    const allLinks = document.querySelectorAll('a[href*="/apps/AAF"]');

    allLinks.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      const text = a.textContent?.trim() || "";

      // Find parent section heading
      let section = "";
      let el: Element | null = a;
      while (el) {
        const prev = el.previousElementSibling;
        if (prev?.tagName?.match(/^H[1-4]$/)) {
          section = prev.textContent?.trim() || "";
          break;
        }
        el = el.parentElement;
        if (el) {
          const heading = el.querySelector("h2, h3");
          if (heading) {
            section = heading.textContent?.trim() || "";
            break;
          }
        }
      }

      appLinks.push({ href, text: text.substring(0, 100), section });
    });

    // Get all collection/category links
    const collLinks: { href: string; text: string }[] = [];
    document.querySelectorAll("a").forEach((a) => {
      const href = a.href;
      if (href.includes("/apps/") && !href.includes("/apps/AAF")) {
        collLinks.push({ href, text: a.textContent?.trim()?.substring(0, 100) || "" });
      }
    });

    // Get page sections with their app counts
    const sections: { heading: string; tag: string; appCount: number }[] = [];
    document.querySelectorAll("h2, h3").forEach((h) => {
      const text = h.textContent?.trim() || "";
      const parent = h.closest("section, div[class]") || h.parentElement;
      const appCount = parent?.querySelectorAll('a[href*="/apps/AAF"]').length || 0;
      if (appCount > 0) {
        sections.push({ heading: text, tag: h.tagName, appCount });
      }
    });

    return { appLinks, collLinks, sections };
  });

  writeFileSync(`${OUT_DIR}/main-data.json`, JSON.stringify(mainData, null, 2));
  console.log(`  App links: ${mainData.appLinks.length}`);
  console.log(`  Collection links: ${mainData.collLinks.length}`);
  console.log(`  Sections with apps: ${mainData.sections.length}`);
  for (const s of mainData.sections) {
    console.log(`    [${s.tag}] ${s.heading}: ${s.appCount} apps`);
  }

  // Extract unique collection URLs
  const uniqueCollUrls = new Map<string, string>();
  for (const link of mainData.collLinks) {
    if (!uniqueCollUrls.has(link.href)) {
      uniqueCollUrls.set(link.href, link.text);
    }
  }
  console.log("\n  Unique non-app /apps/ links:");
  for (const [url, text] of uniqueCollUrls) {
    console.log(`    ${text} -> ${url}`);
  }

  // --- 2. App detail page ---
  if (mainData.appLinks.length > 0) {
    const appUrl = mainData.appLinks[0].href;
    console.log(`\n2. Loading app detail page: ${appUrl}`);

    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(10_000);

    await page.screenshot({ path: `${OUT_DIR}/app-detail.png`, fullPage: false });

    const appHtml = await page.content();
    writeFileSync(`${OUT_DIR}/app-detail.html`, appHtml);
    console.log(`  HTML saved (${appHtml.length} chars)`);

    // Extract app detail data
    const appData = await page.evaluate(() => {
      const data: Record<string, unknown> = {};

      // Title
      const h1 = document.querySelector("h1");
      data.title = h1?.textContent?.trim();

      // All headings
      const headings: string[] = [];
      document.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
        headings.push(`[${h.tagName}] ${h.textContent?.trim()}`);
      });
      data.headings = headings;

      // All images
      const images: { src: string; alt: string }[] = [];
      document.querySelectorAll("img").forEach((img) => {
        images.push({
          src: img.src?.substring(0, 200) || "",
          alt: img.alt || "",
        });
      });
      data.images = images;

      // Body text (first 3000 chars)
      data.bodyText = document.body.innerText?.substring(0, 3000);

      // Check for JSON-LD
      const jsonLd: unknown[] = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try { jsonLd.push(JSON.parse(s.textContent || "{}")); } catch {}
      });
      data.jsonLd = jsonLd;

      // All script tags with inline data
      const scriptData: string[] = [];
      document.querySelectorAll("script:not([src])").forEach((s) => {
        const text = s.textContent || "";
        if (text.includes("app") && text.includes("{") && text.length > 50 && text.length < 10000) {
          scriptData.push(text.substring(0, 500));
        }
      });
      data.inlineScripts = scriptData;

      // Meta tags
      const metaTags: Record<string, string> = {};
      document.querySelectorAll("meta[property], meta[name]").forEach((m) => {
        const key = m.getAttribute("property") || m.getAttribute("name") || "";
        const value = m.getAttribute("content") || "";
        if (key && value) metaTags[key] = value;
      });
      data.metaTags = metaTags;

      return data;
    });

    writeFileSync(`${OUT_DIR}/app-detail-data.json`, JSON.stringify(appData, null, 2));
    console.log(`  Title: ${appData.title}`);
    console.log(`  Headings: ${(appData.headings as string[])?.length}`);
    console.log(`  Images: ${(appData.images as unknown[])?.length}`);
    console.log(`  Body text length: ${(appData.bodyText as string)?.length}`);
    if (appData.metaTags && typeof appData.metaTags === "object") {
      console.log("  Key meta tags:");
      for (const [k, v] of Object.entries(appData.metaTags as Record<string, string>)) {
        if (k.startsWith("og:") || k.startsWith("twitter:") || k === "description") {
          console.log(`    ${k}: ${v.substring(0, 100)}`);
        }
      }
    }
  }

  // --- 3. Try to find a collection page ---
  console.log("\n3. Looking for collection pages...");

  // Try known collection URL patterns
  const collectionUrls = [
    "https://www.canva.com/apps/integrations",
    "https://www.canva.com/apps/ai-apps",
    "https://www.canva.com/apps/trending",
    "https://www.canva.com/apps/new",
    "https://www.canva.com/apps/featured",
    "https://www.canva.com/apps/popular",
  ];

  for (const url of collectionUrls) {
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForTimeout(3000);
      const status = resp?.status();
      const finalUrl = page.url();
      const appCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/apps/AAF"]').length;
      });
      console.log(`  ${url} -> status=${status}, redirected=${finalUrl !== url}, apps=${appCount}`);
      if (appCount > 0 && finalUrl !== "https://www.canva.com/apps") {
        await page.screenshot({ path: `${OUT_DIR}/collection-${url.split("/").pop()}.png`, fullPage: false });
        const html = await page.content();
        writeFileSync(`${OUT_DIR}/collection-${url.split("/").pop()}.html`, html);
      }
    } catch (e) {
      console.log(`  ${url} -> ERROR: ${(e as Error).message.substring(0, 100)}`);
    }
  }

  // --- 4. Explore the full apps page with all sections ---
  console.log("\n4. Re-loading /apps to do deep section analysis...");
  await page.goto("https://www.canva.com/apps", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(10_000);

  // Scroll through entire page to trigger lazy loading
  let lastScroll = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    const curScroll = await page.evaluate(() => document.body.scrollHeight);
    if (curScroll === lastScroll) break;
    lastScroll = curScroll;
  }

  // Get ALL apps after full scroll
  const allApps = await page.evaluate(() => {
    const apps: {
      slug: string;
      name: string;
      url: string;
      urlSlug: string;
      section: string;
      position: number;
    }[] = [];
    const seen = new Set<string>();

    // Find all app card links
    const links = document.querySelectorAll('a[href*="/apps/AAF"]');
    let globalPos = 0;

    links.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      const match = href.match(/\/apps\/(AAF[A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?/);
      if (!match) return;

      const slug = match[1];
      if (seen.has(slug)) return;
      seen.add(slug);
      globalPos++;

      // Try to find containing section
      let section = "";
      let el: Element | null = a.parentElement;
      for (let depth = 0; el && depth < 10; depth++) {
        const heading = el.querySelector("h2");
        if (heading) {
          section = heading.textContent?.trim() || "";
          break;
        }
        el = el.parentElement;
      }

      // Extract name from the card
      const text = a.textContent?.trim() || "";
      // Name is usually the first part before the description
      const nameMatch = text.match(/^([^A-Z][a-z]+(?:\s[A-Z][a-z]+)*|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);

      apps.push({
        slug,
        name: text.substring(0, 60),
        url: href,
        urlSlug: match[2] || "",
        section,
        position: globalPos,
      });
    });

    return apps;
  });

  writeFileSync(`${OUT_DIR}/all-apps.json`, JSON.stringify(allApps, null, 2));
  console.log(`\n  Total unique apps after full scroll: ${allApps.length}`);

  // Group by section
  const bySection = new Map<string, typeof allApps>();
  for (const app of allApps) {
    const key = app.section || "(no section)";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(app);
  }
  console.log("  Apps by section:");
  for (const [section, apps] of bySection) {
    console.log(`    ${section}: ${apps.length} apps`);
  }

  // Save full scrolled HTML
  const fullHtml = await page.content();
  writeFileSync(`${OUT_DIR}/main-page-full.html`, fullHtml);
  console.log(`  Full page HTML: ${fullHtml.length} chars`);

  await page.screenshot({ path: `${OUT_DIR}/main-page-full-bottom.png`, fullPage: false });

  await browser.close();
  console.log("\nDone! Check scripts/canva-output/ for results.");
}

main().catch(console.error);
