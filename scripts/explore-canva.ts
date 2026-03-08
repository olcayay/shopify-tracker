/**
 * Canva Marketplace Exploration Script
 *
 * Uses Playwright to explore canva.com/apps, intercepting network requests
 * and extracting page structure, categories, app metadata, and pagination.
 *
 * Usage: npx tsx scripts/explore-canva.ts
 */

import { chromium, type Page, type Request } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface DiscoveredApi {
  url: string;
  method: string;
  resourceType: string;
  responseContentType?: string;
  sampleResponseKeys?: string[];
}

interface DiscoveredCategory {
  title: string;
  slug: string;
  url: string;
  appCount?: number;
}

interface DiscoveredApp {
  name: string;
  slug: string;
  url: string;
  iconUrl?: string;
  developer?: string;
  shortDescription?: string;
}

interface ExplorationReport {
  timestamp: string;
  mainPage: {
    title: string;
    hasNextData: boolean;
    hasInitialState: boolean;
    embeddedDataKeys: string[];
    sections: { title: string; appCount: number }[];
  };
  categories: DiscoveredCategory[];
  sampleApps: DiscoveredApp[];
  apiEndpoints: DiscoveredApi[];
  appDetailPage: {
    url: string;
    metadata: Record<string, unknown>;
    hasEmbeddedJson: boolean;
    embeddedDataKeys: string[];
  } | null;
  collectionPage: {
    url: string;
    appCount: number;
    paginationMechanism: string;
    hasNextPage: boolean;
  } | null;
  domSelectors: Record<string, string>;
  recommendations: string[];
}

async function main() {
  console.log("🔍 Starting Canva Marketplace exploration...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
  });

  const apiEndpoints: DiscoveredApi[] = [];

  // Intercept network requests globally
  context.on("request", (req: Request) => {
    const url = req.url();
    const resourceType = req.resourceType();

    // Capture XHR/fetch calls that might be API endpoints
    if (
      (resourceType === "xhr" || resourceType === "fetch") &&
      !url.includes("analytics") &&
      !url.includes("tracking") &&
      !url.includes("sentry") &&
      !url.includes("googletagmanager") &&
      !url.includes("google-analytics") &&
      !url.includes("facebook") &&
      !url.includes("hotjar")
    ) {
      apiEndpoints.push({
        url: url.length > 200 ? url.substring(0, 200) + "..." : url,
        method: req.method(),
        resourceType,
      });
    }
  });

  const page = await context.newPage();

  const report: ExplorationReport = {
    timestamp: new Date().toISOString(),
    mainPage: {
      title: "",
      hasNextData: false,
      hasInitialState: false,
      embeddedDataKeys: [],
      sections: [],
    },
    categories: [],
    sampleApps: [],
    apiEndpoints: [],
    appDetailPage: null,
    collectionPage: null,
    domSelectors: {},
    recommendations: [],
  };

  try {
    // --- Step 1: Explore main /apps page ---
    console.log("📄 Step 1: Navigating to canva.com/apps...");
    await page.goto("https://www.canva.com/apps", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Wait for app cards to render (Canva is an SPA, networkidle may never resolve)
    await page.waitForTimeout(8000);

    report.mainPage.title = await page.title();
    console.log(`  Title: ${report.mainPage.title}`);

    // Check for embedded JSON data
    const embeddedData = await page.evaluate(() => {
      const result: Record<string, boolean> = {};

      // Check __NEXT_DATA__
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      result.__NEXT_DATA__ = !!nextDataEl;

      // Check common embedded state patterns
      result.__INITIAL_STATE__ = !!(window as any).__INITIAL_STATE__;
      result.__APOLLO_STATE__ = !!(window as any).__APOLLO_STATE__;
      result.__NUXT__ = !!(window as any).__NUXT__;
      result.__APP_DATA__ = !!(window as any).__APP_DATA__;

      // Check for any window-level JSON data
      const windowKeys = Object.keys(window).filter(
        (k) =>
          k.startsWith("__") &&
          k.endsWith("__") &&
          typeof (window as any)[k] === "object"
      );
      for (const key of windowKeys) {
        result[key] = true;
      }

      return result;
    });

    report.mainPage.hasNextData = embeddedData.__NEXT_DATA__ || false;
    report.mainPage.hasInitialState = embeddedData.__INITIAL_STATE__ || false;
    report.mainPage.embeddedDataKeys = Object.keys(embeddedData).filter(
      (k) => embeddedData[k]
    );
    console.log(`  Embedded data: ${JSON.stringify(report.mainPage.embeddedDataKeys)}`);

    // If __NEXT_DATA__ exists, extract it
    if (report.mainPage.hasNextData) {
      const nextData = await page.evaluate(() => {
        const el = document.getElementById("__NEXT_DATA__");
        if (!el) return null;
        try {
          return JSON.parse(el.textContent || "{}");
        } catch {
          return null;
        }
      });
      if (nextData) {
        console.log(`  __NEXT_DATA__ keys: ${Object.keys(nextData).join(", ")}`);
        if (nextData.props?.pageProps) {
          console.log(
            `  pageProps keys: ${Object.keys(nextData.props.pageProps).join(", ")}`
          );
        }
      }
    }

    // --- Step 2: Extract sections and categories ---
    console.log("\n📂 Step 2: Extracting sections and categories...");

    // Extract visible sections from the main page
    const sections = await page.evaluate(() => {
      const results: { title: string; appCount: number; type: string }[] = [];

      // Look for section headings (h2, h3)
      const headings = document.querySelectorAll("h1, h2, h3, h4");
      headings.forEach((h) => {
        const text = h.textContent?.trim();
        if (text && text.length < 100) {
          // Count sibling app cards
          const section = h.closest("section") || h.parentElement;
          const cards = section?.querySelectorAll("a[href*='/apps/']") || [];
          results.push({
            title: text,
            appCount: cards.length,
            type: h.tagName,
          });
        }
      });

      return results;
    });

    report.mainPage.sections = sections.map((s) => ({
      title: s.title,
      appCount: s.appCount,
    }));
    console.log(`  Found ${sections.length} sections:`);
    for (const s of sections) {
      console.log(`    [${s.type}] ${s.title} (${s.appCount} apps)`);
    }

    // Extract all category/collection links
    const categoryLinks = await page.evaluate(() => {
      const links: { title: string; url: string; href: string }[] = [];
      const allLinks = document.querySelectorAll("a[href*='/apps/']");

      allLinks.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        const text = a.textContent?.trim() || "";

        // Collection/category links (not individual app links)
        if (
          href.includes("/apps/collection/") ||
          href.includes("/apps/category/") ||
          href.includes("/apps?") ||
          (href.match(/\/apps\/[a-z-]+$/) && !href.includes("/apps/AAF"))
        ) {
          links.push({
            title: text,
            url: href,
            href: (a as HTMLAnchorElement).getAttribute("href") || "",
          });
        }
      });

      return links;
    });

    // Deduplicate by URL
    const uniqueCategories = new Map<string, DiscoveredCategory>();
    for (const link of categoryLinks) {
      const slug = link.url.split("/").pop()?.split("?")[0] || "";
      if (slug && !uniqueCategories.has(slug)) {
        uniqueCategories.set(slug, {
          title: link.title,
          slug,
          url: link.url,
        });
      }
    }
    report.categories = Array.from(uniqueCategories.values());
    console.log(`  Found ${report.categories.length} categories/collections`);

    // --- Step 3: Extract app cards from main page ---
    console.log("\n🏪 Step 3: Extracting app cards...");

    const appCards = await page.evaluate(() => {
      const apps: {
        name: string;
        slug: string;
        url: string;
        iconUrl: string;
        developer: string;
        shortDescription: string;
      }[] = [];

      // Try various selectors for app cards
      const allLinks = document.querySelectorAll('a[href*="/apps/"]');

      allLinks.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;

        // App detail links typically have a specific slug pattern
        const match = href.match(/\/apps\/(AAF[A-Za-z0-9_-]+)/);
        if (!match) return;

        const slug = match[1];
        const card = a.closest("[class]") || a;

        // Extract metadata from the card
        const imgs = card.querySelectorAll("img");
        const iconImg = imgs[0];
        const iconUrl = iconImg?.src || iconImg?.getAttribute("srcset") || "";

        const textNodes = Array.from(card.querySelectorAll("span, p, div"))
          .map((el) => el.textContent?.trim())
          .filter((t) => t && t.length > 0 && t.length < 200);

        apps.push({
          name: textNodes[0] || slug,
          slug,
          url: href,
          iconUrl,
          developer: "",
          shortDescription: textNodes[1] || "",
        });
      });

      // Deduplicate by slug
      const seen = new Set<string>();
      return apps.filter((app) => {
        if (seen.has(app.slug)) return false;
        seen.add(app.slug);
        return true;
      });
    });

    report.sampleApps = appCards.slice(0, 20);
    console.log(`  Found ${appCards.length} unique apps on main page`);
    for (const app of appCards.slice(0, 5)) {
      console.log(`    - ${app.name} (${app.slug})`);
    }

    // --- Step 4: Identify DOM selectors ---
    console.log("\n🔧 Step 4: Identifying DOM selectors...");

    const selectors = await page.evaluate(() => {
      const result: Record<string, string> = {};

      // Try to identify app card structure
      const firstAppLink = document.querySelector('a[href*="/apps/AAF"]');
      if (firstAppLink) {
        const card = firstAppLink.closest("[class]");
        if (card) {
          result.appCardContainer = card.tagName + (card.className ? `.${card.className.split(" ")[0]}` : "");
        }
        result.appLink = 'a[href*="/apps/AAF"]';
      }

      // Collection links
      const collLink = document.querySelector('a[href*="/apps/collection/"]');
      if (collLink) {
        result.collectionLink = 'a[href*="/apps/collection/"]';
      }

      return result;
    });

    report.domSelectors = selectors;
    console.log(`  Selectors: ${JSON.stringify(selectors, null, 2)}`);

    // --- Step 5: Visit a sample app detail page ---
    if (appCards.length > 0) {
      const sampleApp = appCards[0];
      console.log(`\n📱 Step 5: Visiting app detail page: ${sampleApp.slug}...`);

      // Clear api endpoints before navigating
      const prevEndpointCount = apiEndpoints.length;

      await page.goto(sampleApp.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(8000);

      // New API endpoints from app detail page
      const appDetailEndpoints = apiEndpoints.slice(prevEndpointCount);

      // Extract app detail metadata
      const appDetail = await page.evaluate(() => {
        const meta: Record<string, unknown> = {};

        // Check for __NEXT_DATA__
        const nextDataEl = document.getElementById("__NEXT_DATA__");
        if (nextDataEl) {
          try {
            const nd = JSON.parse(nextDataEl.textContent || "{}");
            meta.__NEXT_DATA__keys = Object.keys(nd);
            if (nd.props?.pageProps) {
              meta.pagePropsKeys = Object.keys(nd.props.pageProps);
              // Extract app data from pageProps
              const pp = nd.props.pageProps;
              if (pp.app || pp.appData || pp.listing) {
                const appData = pp.app || pp.appData || pp.listing;
                meta.appDataKeys = Object.keys(appData);
                meta.appDataSample = JSON.stringify(appData).substring(0, 2000);
              }
              // Check for any key that looks like app data
              for (const key of Object.keys(pp)) {
                const val = pp[key];
                if (val && typeof val === "object" && !Array.isArray(val)) {
                  const valKeys = Object.keys(val);
                  if (
                    valKeys.some((k) =>
                      ["name", "title", "description", "slug", "developer"].includes(k)
                    )
                  ) {
                    meta[`pageProps.${key}_keys`] = valKeys;
                    meta[`pageProps.${key}_sample`] = JSON.stringify(val).substring(
                      0,
                      1000
                    );
                  }
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Extract visible metadata
        const title = document.querySelector("h1")?.textContent?.trim();
        if (title) meta.visibleTitle = title;

        // Get all text content that might be metadata
        const allText = document.body.innerText;
        meta.pageLength = allText.length;

        // Look for developer/company info
        const devMatches = allText.match(/(?:by|from|developer|company)\s+([^\n]+)/i);
        if (devMatches) meta.developerHint = devMatches[1].trim();

        // Look for structured data (JSON-LD)
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        if (jsonLdScripts.length > 0) {
          meta.hasJsonLd = true;
          try {
            meta.jsonLdSample = JSON.parse(
              jsonLdScripts[0].textContent || "{}"
            );
          } catch {
            // Ignore parse errors
          }
        }

        return meta;
      });

      report.appDetailPage = {
        url: sampleApp.url,
        metadata: appDetail,
        hasEmbeddedJson: !!appDetail.__NEXT_DATA__keys,
        embeddedDataKeys: (appDetail.__NEXT_DATA__keys as string[]) || [],
      };

      console.log(`  Title: ${appDetail.visibleTitle}`);
      console.log(`  Has __NEXT_DATA__: ${!!appDetail.__NEXT_DATA__keys}`);
      console.log(`  New API calls: ${appDetailEndpoints.length}`);
      if (appDetail.pagePropsKeys) {
        console.log(`  pageProps keys: ${(appDetail.pagePropsKeys as string[]).join(", ")}`);
      }
    }

    // --- Step 6: Visit a collection/category page ---
    if (report.categories.length > 0) {
      const sampleCategory = report.categories[0];
      console.log(
        `\n📁 Step 6: Visiting collection page: ${sampleCategory.slug}...`
      );

      const prevEndpointCount = apiEndpoints.length;

      await page.goto(sampleCategory.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(8000);

      // Count apps on collection page
      const collectionInfo = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/apps/AAF"]');
        const uniqueSlugs = new Set<string>();
        links.forEach((a) => {
          const match = (a as HTMLAnchorElement).href.match(
            /\/apps\/(AAF[A-Za-z0-9_-]+)/
          );
          if (match) uniqueSlugs.add(match[1]);
        });

        // Check for pagination elements
        const hasLoadMore = !!document.querySelector(
          'button[class*="load"], button[class*="more"], [class*="pagination"]'
        );
        const hasInfiniteScroll =
          document.body.scrollHeight > window.innerHeight * 2;

        // Check for "Show all" or "See more" links
        const seeMoreLinks = Array.from(document.querySelectorAll("a, button"))
          .filter((el) => {
            const text = el.textContent?.toLowerCase() || "";
            return (
              text.includes("show all") ||
              text.includes("see more") ||
              text.includes("view all") ||
              text.includes("load more")
            );
          })
          .map((el) => ({
            text: el.textContent?.trim(),
            href: (el as HTMLAnchorElement).href || "",
          }));

        return {
          appCount: uniqueSlugs.size,
          hasLoadMore,
          hasInfiniteScroll,
          seeMoreLinks,
          pageHeight: document.body.scrollHeight,
        };
      });

      // Try scrolling to trigger infinite scroll
      let prevAppCount = collectionInfo.appCount;
      let scrolledAppCount = prevAppCount;
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        scrolledAppCount = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/apps/AAF"]');
          const slugs = new Set<string>();
          links.forEach((a) => {
            const match = (a as HTMLAnchorElement).href.match(
              /\/apps\/(AAF[A-Za-z0-9_-]+)/
            );
            if (match) slugs.add(match[1]);
          });
          return slugs.size;
        });
        if (scrolledAppCount > prevAppCount) {
          prevAppCount = scrolledAppCount;
        } else {
          break;
        }
      }

      const paginationMechanism =
        scrolledAppCount > collectionInfo.appCount
          ? "infinite-scroll"
          : collectionInfo.hasLoadMore
            ? "load-more-button"
            : collectionInfo.seeMoreLinks.length > 0
              ? "see-more-links"
              : "none-detected";

      report.collectionPage = {
        url: sampleCategory.url,
        appCount: scrolledAppCount,
        paginationMechanism,
        hasNextPage: scrolledAppCount > collectionInfo.appCount,
      };

      console.log(`  Apps on page: ${scrolledAppCount}`);
      console.log(`  Pagination: ${paginationMechanism}`);
      console.log(`  See more links: ${JSON.stringify(collectionInfo.seeMoreLinks)}`);

      const collEndpoints = apiEndpoints.slice(prevEndpointCount);
      console.log(`  New API calls: ${collEndpoints.length}`);
    }

    // --- Step 7: Check all /apps/* links for full category listing ---
    console.log("\n🔗 Step 7: Discovering all categories via /apps page...");
    await page.goto("https://www.canva.com/apps", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8000);

    // Scroll entire page to load all lazy content
    let lastHeight = 0;
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
    }

    // Re-extract all links after full scroll
    const allCollectionLinks = await page.evaluate(() => {
      const results: { title: string; slug: string; url: string }[] = [];
      const seen = new Set<string>();

      document.querySelectorAll("a").forEach((a) => {
        const href = a.href;
        // Collection pages
        const collMatch = href.match(/\/apps\/collection\/([a-z0-9-]+)/);
        if (collMatch && !seen.has(collMatch[1])) {
          seen.add(collMatch[1]);
          results.push({
            title: a.textContent?.trim() || collMatch[1],
            slug: collMatch[1],
            url: href,
          });
        }
        // Category pages
        const catMatch = href.match(/\/apps\/([a-z][a-z0-9-]+)$/);
        if (
          catMatch &&
          !seen.has(catMatch[1]) &&
          !["apps", "collection"].includes(catMatch[1])
        ) {
          seen.add(catMatch[1]);
          results.push({
            title: a.textContent?.trim() || catMatch[1],
            slug: catMatch[1],
            url: href,
          });
        }
      });

      return results;
    });

    // Merge with existing categories
    for (const link of allCollectionLinks) {
      const existing = report.categories.find((c) => c.slug === link.slug);
      if (!existing) {
        report.categories.push({
          title: link.title,
          slug: link.slug,
          url: link.url,
        });
      }
    }

    console.log(`  Total categories/collections found: ${report.categories.length}`);
    for (const cat of report.categories) {
      console.log(`    - ${cat.title} (${cat.slug})`);
    }

    // Filter unique API endpoints
    const seenUrls = new Set<string>();
    report.apiEndpoints = apiEndpoints.filter((ep) => {
      const key = `${ep.method}:${ep.url}`;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

    // --- Generate recommendations ---
    console.log("\n📋 Step 8: Generating recommendations...");

    if (report.mainPage.hasNextData) {
      report.recommendations.push(
        "Canva uses Next.js with __NEXT_DATA__ — embedded JSON data can be extracted without full DOM parsing"
      );
    }

    const hasJsonApi = report.apiEndpoints.some(
      (ep) =>
        ep.url.includes("api") ||
        ep.url.includes("graphql") ||
        ep.url.includes("/v1/") ||
        ep.url.includes("/v2/")
    );
    if (hasJsonApi) {
      report.recommendations.push(
        "Internal API endpoints detected — consider using HttpClient for category/listing data"
      );
    } else {
      report.recommendations.push(
        "No clear internal API found — use BrowserClient for all page fetching"
      );
    }

    if (report.collectionPage?.paginationMechanism === "infinite-scroll") {
      report.recommendations.push(
        "Collection pages use infinite scroll — BrowserClient.withPage() needed for scrolling"
      );
    }

    report.recommendations.push(
      `Found ${report.categories.length} categories and ${appCards.length} apps on main page`
    );

  } catch (error) {
    console.error("Error during exploration:", error);
  } finally {
    await browser.close();
  }

  // Output the full report
  const reportPath = "scripts/canva-exploration-report.json";
  const fs = await import("fs");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to ${reportPath}`);
  console.log("\n--- Summary ---");
  console.log(`Categories: ${report.categories.length}`);
  console.log(`Sample apps: ${report.sampleApps.length}`);
  console.log(`API endpoints: ${report.apiEndpoints.length}`);
  console.log(`Recommendations: ${report.recommendations.join("; ")}`);

  return report;
}

main().catch(console.error);
