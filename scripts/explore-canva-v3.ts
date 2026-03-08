/**
 * Canva Marketplace Exploration v3 — Extract embedded JSON data
 *
 * Usage: npx tsx scripts/explore-canva-v3.ts
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const OUT_DIR = "scripts/canva-output";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  const page = await context.newPage();

  console.log("Loading /apps page...");
  await page.goto("https://www.canva.com/apps", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(10_000);

  // Extract all apps from the embedded JSON in the page
  const result = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;

    // Find all app entries: "A":"AAxxxx","B":"SDK_APP","C":"Name","D":"Description",...
    const appPattern =
      /"A":"(AA[FG][^"]+)","B":"SDK_APP","C":"([^"]+)","D":"([^"]*)","E":"([^"]*)","F":"([^"]*)","G":\{"A":"([^"]*)"/g;

    const apps: {
      id: string;
      name: string;
      shortDescription: string;
      tagline: string;
      developer: string;
      iconUrl: string;
    }[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = appPattern.exec(html)) !== null) {
      const [, id, name, shortDesc, tagline, developer, iconUrl] = match;
      if (seen.has(id)) continue;
      seen.add(id);
      apps.push({
        id,
        name,
        shortDescription: shortDesc,
        tagline,
        developer,
        iconUrl,
      });
    }

    // Also try simpler pattern without icon
    const simplePattern =
      /"A":"(AA[FG][^"]+)","B":"SDK_APP","C":"([^"]+)","D":"([^"]*)","E":"([^"]*)","F":"([^"]*)"/g;

    while ((match = simplePattern.exec(html)) !== null) {
      const [, id, name, shortDesc, tagline, developer] = match;
      if (seen.has(id)) continue;
      seen.add(id);
      apps.push({
        id,
        name,
        shortDescription: shortDesc,
        tagline,
        developer,
        iconUrl: "",
      });
    }

    // Extract categories from filter tabs
    const categories: string[] = [];
    document.querySelectorAll("button span").forEach((el) => {
      const text = el.textContent?.trim();
      if (
        text &&
        [
          "All apps",
          "AI generation",
          "Audio and voiceover",
          "Communication",
          "File and data management",
          "Graphic design",
          "Marketing",
          "Photo editing",
          "Project management",
          "Text styling",
          "Video and animation",
        ].includes(text)
      ) {
        categories.push(text);
      }
    });

    // Extract featured sections from h2 headings that are within the app area
    const featuredSections: { title: string; appCount: number; appIds: string[] }[] = [];
    const sectionTitles = [
      "Design with your favorite media",
      "Enhance your images",
      "Supercharge your workflow",
    ];

    for (const title of sectionTitles) {
      const headings = Array.from(document.querySelectorAll("h2"));
      const heading = headings.find((h) => h.textContent?.trim() === title);
      if (heading) {
        const section = heading.closest("section, div") || heading.parentElement;
        const appLinks = section?.querySelectorAll('a[href*="/apps/AAF"], a[href*="/apps/AAG"]') || [];
        const appIds: string[] = [];
        appLinks.forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          const m = href.match(/\/apps\/(AA[FG][A-Za-z0-9_-]+)/);
          if (m) appIds.push(m[1]);
        });
        featuredSections.push({ title, appCount: appIds.length, appIds });
      }
    }

    // Extract the visible app links with their positions (ordered as displayed)
    const displayedApps: { id: string; name: string; position: number; urlSlug: string }[] = [];
    const appLinksSeen = new Set<string>();
    let pos = 0;
    document.querySelectorAll('a[href*="/apps/AA"]').forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      const m = href.match(/\/apps\/(AA[FG][A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?/);
      if (!m || appLinksSeen.has(m[1])) return;
      appLinksSeen.add(m[1]);
      pos++;
      displayedApps.push({
        id: m[1],
        name: a.textContent?.trim()?.substring(0, 80) || "",
        position: pos,
        urlSlug: m[2] || "",
      });
    });

    return { apps, categories, featuredSections, displayedApps };
  });

  console.log(`Apps in embedded JSON: ${result.apps.length}`);
  console.log(`Categories: ${result.categories.join(", ")}`);
  console.log(`Featured sections: ${result.featuredSections.map((s) => `${s.title} (${s.appCount})`).join(", ")}`);
  console.log(`Displayed apps: ${result.displayedApps.length}`);

  writeFileSync(`${OUT_DIR}/apps-full.json`, JSON.stringify(result.apps, null, 2));
  writeFileSync(`${OUT_DIR}/categories.json`, JSON.stringify(result.categories, null, 2));
  writeFileSync(`${OUT_DIR}/featured-sections.json`, JSON.stringify(result.featuredSections, null, 2));
  writeFileSync(`${OUT_DIR}/displayed-apps.json`, JSON.stringify(result.displayedApps, null, 2));

  // Now click each category tab and extract app IDs for that category
  console.log("\nExtracting apps per category...");
  const categoryApps: Record<string, { id: string; name: string; position: number; urlSlug: string }[]> = {};

  for (const cat of result.categories) {
    if (cat === "All apps") continue;

    console.log(`  Clicking "${cat}"...`);
    try {
      // Click the category tab
      const button = await page.$(`button:has(span:text-is("${cat}"))`);
      if (button) {
        await button.click();
        await page.waitForTimeout(3000);

        // Extract visible apps
        const apps = await page.evaluate(() => {
          const displayedApps: { id: string; name: string; position: number; urlSlug: string }[] = [];
          const seen = new Set<string>();
          let pos = 0;
          document.querySelectorAll('a[href*="/apps/AA"]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            const m = href.match(/\/apps\/(AA[FG][A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?/);
            if (!m || seen.has(m[1])) return;
            seen.add(m[1]);
            pos++;
            displayedApps.push({
              id: m[1],
              name: a.textContent?.trim()?.substring(0, 80) || "",
              position: pos,
              urlSlug: m[2] || "",
            });
          });
          return displayedApps;
        });

        categoryApps[cat] = apps;
        console.log(`    Found ${apps.length} apps`);

        // Take a screenshot for this category
        await page.screenshot({
          path: `${OUT_DIR}/category-${cat.toLowerCase().replace(/\s+/g, "-")}.png`,
          fullPage: false,
        });
      } else {
        console.log(`    Button not found`);
      }
    } catch (e) {
      console.log(`    Error: ${(e as Error).message.substring(0, 100)}`);
    }
  }

  writeFileSync(`${OUT_DIR}/category-apps.json`, JSON.stringify(categoryApps, null, 2));

  // Print summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total apps in JSON: ${result.apps.length}`);
  console.log(`Categories: ${result.categories.length}`);
  console.log(`Displayed on "All apps": ${result.displayedApps.length}`);
  for (const [cat, apps] of Object.entries(categoryApps)) {
    console.log(`  ${cat}: ${apps.length} apps`);
  }

  // Sample app data
  console.log("\nSample app:");
  console.log(JSON.stringify(result.apps[0], null, 2));

  // Developer distribution
  const devCounts = new Map<string, number>();
  for (const app of result.apps) {
    devCounts.set(app.developer, (devCounts.get(app.developer) || 0) + 1);
  }
  const topDevs = Array.from(devCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("\nTop developers:");
  for (const [dev, count] of topDevs) {
    console.log(`  ${dev}: ${count} apps`);
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch(console.error);
