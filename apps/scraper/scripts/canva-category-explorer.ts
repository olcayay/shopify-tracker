/**
 * Canva Category Explorer v2
 *
 * Navigates to canva.com/apps, clicks each category filter tab,
 * and extracts the subcategory section headings from the rendered SPA.
 * Also extracts all marketplace_topic tags from embedded app data.
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const AUTH_STATE_CANDIDATES = [
  path.resolve(process.cwd(), "apps/scraper/canva-auth-state.json"),
  path.resolve(process.cwd(), "canva-auth-state.json"),
];

const OUTPUT_PATH = path.resolve(process.cwd(), "scripts/canva-output/category-tree.json");

function cssEscape(value: string): string {
  return value.replace(/([\0-\x1f\x7f]|^-?\d)|[\x80-\uffff]|[^\0-\x7e]/g, (ch) => {
    return '\\' + ch.charCodeAt(0).toString(16) + ' ';
  }).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

async function main() {
  let storageState: any;
  for (const p of AUTH_STATE_CANDIDATES) {
    if (fs.existsSync(p)) {
      storageState = JSON.parse(fs.readFileSync(p, "utf-8"));
      console.log(`Auth state loaded from: ${p} (${storageState.cookies?.length} cookies)`);
      break;
    }
  }
  if (!storageState) {
    console.error("No auth state found");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    ...(storageState && { storageState }),
  });

  const page = await context.newPage();

  console.log("Step 1: Loading /apps page...");
  await page.goto("https://www.canva.com/apps", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(8000);

  const title = await page.title();
  console.log(`  Page title: ${title}`);
  if (title.includes("moment") || title.includes("challenge")) {
    console.error("Cloudflare challenge — auth state expired");
    await browser.close();
    process.exit(1);
  }

  // Extract all marketplace_topic tags from page source
  const htmlContent = await page.content();
  const topicMatches = htmlContent.match(/marketplace_topic\.[a-z_]+/g) || [];
  const uniqueTopics = [...new Set(topicMatches)].sort();
  console.log(`\nFound ${uniqueTopics.length} unique marketplace_topic tags in page source`);
  uniqueTopics.forEach((t) => console.log(`  ${t}`));

  // Get tab IDs from the page
  const tabIds = await page.evaluate(() => {
    const tabs = document.querySelectorAll('button[role="tab"]');
    return Array.from(tabs).map((t) => ({
      id: t.id,
      text: t.textContent?.trim() || "",
      ariaControls: t.getAttribute("aria-controls") || "",
      ariaSelected: t.getAttribute("aria-selected"),
    }));
  });

  console.log(`\nFound ${tabIds.length} category tabs:`);
  tabIds.forEach((t) =>
    console.log(`  ${t.text} (${t.id}) → panel: ${t.ariaControls} [selected=${t.ariaSelected}]`)
  );

  const categoryTree: Record<
    string,
    {
      label: string;
      description: string;
      tabId: string;
      subcategories: { label: string; slug: string }[];
    }
  > = {};

  for (const tab of tabIds) {
    const slug = tab.id.replace(/_r_\d+_-tab-/, "");
    console.log(`\n--- Clicking tab: ${tab.text} (${slug}) ---`);

    // Click the tab by evaluating in page context (avoids CSS.escape issues)
    await page.evaluate((tabId) => {
      const el = document.getElementById(tabId);
      if (el) (el as HTMLElement).click();
    }, tab.id);
    await page.waitForTimeout(3000);

    // Scroll down to load all lazy sections
    await page.evaluate(async () => {
      for (let i = 0; i < 25; i++) {
        window.scrollBy(0, 500);
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    await page.waitForTimeout(2000);

    // Extract the section headings visible in the tab panel
    const panelId = tab.ariaControls;
    const sectionData = await page.evaluate((pId) => {
      const panel = document.getElementById(pId);
      if (!panel) return { headings: [], description: "" };

      let description = "";
      const firstP = panel.querySelector("p");
      if (firstP) {
        description = firstP.textContent?.trim() || "";
      }

      const headings: string[] = [];
      const seen = new Set<string>();
      panel.querySelectorAll("h2, h3, h4, h5, h6").forEach((h) => {
        const text = h.textContent?.trim() || "";
        if (text.length > 1 && text.length < 60 && !seen.has(text)) {
          const skipList = [
            "Download Canva for free",
            "Product",
            "Plans",
            "About",
            "Community",
            "Inspiration",
            "Help",
            "Tools",
            "Apps Marketplace",
            "Try Canva with your favorite apps",
            "Build Canva's next app",
          ];
          if (!skipList.includes(text)) {
            seen.add(text);
            headings.push(text);
          }
        }
      });

      return { headings, description };
    }, panelId);

    console.log(`  Description: ${sectionData.description || "(none)"}`);
    console.log(`  Subcategory sections (${sectionData.headings.length}):`);
    sectionData.headings.forEach((h) => console.log(`    - ${h}`));

    categoryTree[slug] = {
      label: tab.text,
      tabId: tab.id,
      description: sectionData.description,
      subcategories: sectionData.headings.map((h) => ({
        label: h,
        slug: h
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
      })),
    };

    // Take full-page screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.resolve(process.cwd(), `scripts/canva-output/cat-full-${slug}.png`),
      fullPage: true,
    });
    console.log(`  Screenshot saved: cat-full-${slug}.png`);

    // Scroll back to top for next tab click
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }

  // Save results
  const fullResult = {
    timestamp: new Date().toISOString(),
    uniqueTopicTags: uniqueTopics,
    topicTagCount: uniqueTopics.length,
    categoryTabCount: tabIds.length,
    categoryTree,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fullResult, null, 2));
  console.log(`\n\nResults saved to: ${OUTPUT_PATH}`);

  await browser.close();
  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
