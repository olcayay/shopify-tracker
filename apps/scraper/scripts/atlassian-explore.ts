/**
 * Atlassian Marketplace Discovery Script
 *
 * Explores the Atlassian Marketplace to:
 * 1. Enumerate all categories from the HTML page (Apollo cache in window.__INITIAL_STATE__)
 * 2. Analyze API v2 responses for app details, search, reviews
 * 3. Validate featured collection marketing labels (Spotlight, Bestseller, Rising Star)
 *
 * Usage:
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts categories
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts app <addonKey>
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts search <keyword>
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts reviews <addonKey>
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts featured
 *   npx tsx apps/scraper/scripts/atlassian-explore.ts category <slug>
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve(import.meta.dirname, "../../scripts/atlassian-output");
const API_BASE = "https://marketplace.atlassian.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function saveOutput(filename: string, data: unknown) {
  ensureOutputDir();
  const path = resolve(OUTPUT_DIR, filename);
  const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  writeFileSync(path, content, "utf-8");
  console.log(`Saved: ${path}`);
}

async function fetchJson(url: string) {
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchHtml(url: string) {
  console.log(`Fetching HTML: ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": UA,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract window.__INITIAL_STATE__ JSON from HTML */
function extractInitialState(html: string): any {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
  if (!match) {
    // Try alternative pattern
    const alt = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\('(.+?)'\)/);
    if (alt) {
      return JSON.parse(alt[1].replace(/\\'/g, "'"));
    }
    throw new Error("Could not find window.__INITIAL_STATE__ in HTML");
  }
  return JSON.parse(match[1]);
}

// ─── Commands ───

async function exploreCategories() {
  console.log("\n=== Exploring Atlassian Marketplace Categories ===\n");

  const html = await fetchHtml(`${API_BASE}/categories`);
  saveOutput("categories-page.html", html);

  try {
    const state = extractInitialState(html);
    saveOutput("categories-initial-state.json", state);

    // Extract category data from Apollo cache
    const categories: { slug: string; title: string; appCount?: number }[] = [];

    // Walk the Apollo cache looking for category references
    if (state.ROOT_QUERY) {
      console.log("\nROOT_QUERY keys:", Object.keys(state.ROOT_QUERY).join(", "));
    }

    // Look for category-like objects in the cache
    for (const [key, value] of Object.entries(state)) {
      if (key.startsWith("Category:") || key.startsWith("MarketplaceCategory:")) {
        const cat = value as any;
        if (cat.slug || cat.name) {
          categories.push({
            slug: cat.slug || cat.key || key.split(":")[1],
            title: cat.name || cat.title || "",
            appCount: cat.addonCount ?? cat.appCount ?? undefined,
          });
        }
      }
    }

    if (categories.length > 0) {
      console.log(`\nFound ${categories.length} categories in Apollo cache:`);
      for (const c of categories) {
        console.log(`  - ${c.slug}: ${c.title} (${c.appCount ?? "?"} apps)`);
      }
      saveOutput("categories-extracted.json", categories);
    } else {
      console.log("\nNo categories found in Apollo cache keys. Trying link extraction...");
      // Fallback: extract category links from HTML
      const linkPattern = /href="\/categories\/([^"]+)"/g;
      const slugs = new Set<string>();
      let m;
      while ((m = linkPattern.exec(html)) !== null) {
        slugs.add(m[1]);
      }
      if (slugs.size > 0) {
        console.log(`\nFound ${slugs.size} category slugs from links:`);
        for (const slug of slugs) {
          console.log(`  - ${slug}`);
        }
        saveOutput("categories-from-links.json", [...slugs]);
      }
    }
  } catch (err) {
    console.error("Failed to extract initial state:", err);
    console.log("Falling back to link extraction...");

    const linkPattern = /href="\/categories\/([^"]+)"/g;
    const slugs = new Set<string>();
    let m;
    while ((m = linkPattern.exec(html)) !== null) {
      slugs.add(m[1]);
    }
    console.log(`Found ${slugs.size} category slugs from links:`);
    for (const slug of slugs) {
      console.log(`  - ${slug}`);
    }
    saveOutput("categories-from-links.json", [...slugs]);
  }
}

async function exploreApp(addonKey: string) {
  console.log(`\n=== Exploring App: ${addonKey} ===\n`);

  const data = await fetchJson(`${API_BASE}/rest/2/addons/${addonKey}`);
  saveOutput(`app-${addonKey.replace(/\./g, "_")}.json`, data);

  console.log("\nTop-level fields:", Object.keys(data).join(", "));
  console.log("Name:", data.name);
  console.log("Key:", data.key);
  console.log("Summary:", data.summary);
  console.log("Tag Line:", data.tagLine);

  if (data._embedded) {
    console.log("\n_embedded keys:", Object.keys(data._embedded).join(", "));
    if (data._embedded.vendor) {
      console.log("Vendor:", data._embedded.vendor.name);
    }
    if (data._embedded.reviews) {
      console.log("Reviews:", {
        averageStars: data._embedded.reviews.averageStars,
        count: data._embedded.reviews.count,
      });
    }
    if (data._embedded.distribution) {
      console.log("Distribution:", {
        totalInstalls: data._embedded.distribution.totalInstalls,
        totalDownloads: data._embedded.distribution.totalDownloads,
      });
    }
    if (data._embedded.logo) {
      console.log("Logo:", data._embedded.logo._links?.image?.href);
    }
    if (data._embedded.categories) {
      console.log("Categories:", data._embedded.categories.map((c: any) => c.name || c.key).join(", "));
    }
  }

  if (data._links) {
    console.log("\n_links keys:", Object.keys(data._links).join(", "));
  }

  // Check programs (Cloud Fortified, etc.)
  if (data.programs) {
    console.log("\nPrograms:", JSON.stringify(data.programs, null, 2));
  }
}

async function exploreSearch(keyword: string) {
  console.log(`\n=== Searching: "${keyword}" ===\n`);

  const url = `${API_BASE}/rest/2/addons?text=${encodeURIComponent(keyword)}&limit=10`;
  const data = await fetchJson(url);
  saveOutput(`search-${keyword.replace(/\s+/g, "_")}.json`, data);

  console.log("Top-level fields:", Object.keys(data).join(", "));

  if (data._embedded?.addons) {
    const addons = data._embedded.addons;
    console.log(`\nFound ${addons.length} results:`);
    for (const addon of addons) {
      console.log(`  ${addon.key}: ${addon.name}`);
    }
    console.log("\nSample addon fields:", Object.keys(addons[0] || {}).join(", "));
    if (addons[0]?._embedded) {
      console.log("Sample _embedded keys:", Object.keys(addons[0]._embedded).join(", "));
    }
  }

  if (data.count !== undefined) console.log("Count:", data.count);
  if (data.totalSize !== undefined) console.log("Total size:", data.totalSize);
}

async function exploreReviews(addonKey: string) {
  console.log(`\n=== Reviews for: ${addonKey} ===\n`);

  const url = `${API_BASE}/rest/2/addons/${addonKey}/reviews?limit=5`;
  const data = await fetchJson(url);
  saveOutput(`reviews-${addonKey.replace(/\./g, "_")}.json`, data);

  console.log("Top-level fields:", Object.keys(data).join(", "));

  if (data._embedded?.reviews) {
    const reviews = data._embedded.reviews;
    console.log(`\nFound ${reviews.length} reviews:`);
    for (const r of reviews) {
      console.log(`  [${r.stars}★] by ${r._embedded?.author?.name ?? "?"} on ${r.date}: ${(r.review || "").slice(0, 80)}...`);
    }
    console.log("\nSample review fields:", Object.keys(reviews[0] || {}).join(", "));
  }
}

async function exploreFeatured() {
  console.log("\n=== Exploring Featured Collections ===\n");

  const labels = ["Spotlight", "Bestseller", "Rising+Star"];

  for (const label of labels) {
    console.log(`\n--- ${label} ---`);
    try {
      const url = `${API_BASE}/rest/2/addons?marketingLabel=${label}&limit=10`;
      const data = await fetchJson(url);
      saveOutput(`featured-${label.replace(/\+/g, "_").toLowerCase()}.json`, data);

      if (data._embedded?.addons) {
        const addons = data._embedded.addons;
        console.log(`Found ${addons.length} apps:`);
        for (const addon of addons) {
          console.log(`  ${addon.key}: ${addon.name}`);
        }
      } else {
        console.log("No addons found");
      }
      if (data.count !== undefined) console.log(`Total count: ${data.count}`);
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }
}

async function exploreCategoryPage(slug: string) {
  console.log(`\n=== Category Page: ${slug} ===\n`);

  const html = await fetchHtml(`${API_BASE}/categories/${slug}`);
  saveOutput(`category-${slug}.html`, html);

  try {
    const state = extractInitialState(html);
    saveOutput(`category-${slug}-initial-state.json`, state);
    console.log("Apollo cache keys:", Object.keys(state).slice(0, 30).join(", "));

    // Count addon references
    let addonCount = 0;
    for (const key of Object.keys(state)) {
      if (key.startsWith("Addon:") || key.startsWith("Plugin:") || key.startsWith("App:")) {
        addonCount++;
      }
    }
    console.log(`\nFound ${addonCount} addon entries in cache`);
  } catch (err) {
    console.error("Failed to extract initial state:", err);
  }
}

// ─── Main ───

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "categories":
    await exploreCategories();
    break;
  case "app":
    if (!args[0]) {
      console.error("Usage: atlassian-explore.ts app <addonKey>");
      process.exit(1);
    }
    await exploreApp(args[0]);
    break;
  case "search":
    if (!args[0]) {
      console.error("Usage: atlassian-explore.ts search <keyword>");
      process.exit(1);
    }
    await exploreSearch(args.join(" "));
    break;
  case "reviews":
    if (!args[0]) {
      console.error("Usage: atlassian-explore.ts reviews <addonKey>");
      process.exit(1);
    }
    await exploreReviews(args[0]);
    break;
  case "featured":
    await exploreFeatured();
    break;
  case "category":
    if (!args[0]) {
      console.error("Usage: atlassian-explore.ts category <slug>");
      process.exit(1);
    }
    await exploreCategoryPage(args[0]);
    break;
  default:
    console.log("Atlassian Marketplace Discovery Script\n");
    console.log("Commands:");
    console.log("  categories              — Enumerate all categories from HTML");
    console.log("  app <addonKey>          — Fetch app details via REST API");
    console.log("  search <keyword>        — Search apps via REST API");
    console.log("  reviews <addonKey>      — Fetch reviews via REST API");
    console.log("  featured                — Validate featured collection labels");
    console.log("  category <slug>         — Fetch category page and analyze Apollo cache");
    break;
}
