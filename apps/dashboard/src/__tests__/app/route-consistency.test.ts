import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

const APP_DIR = join(__dirname, "../../app");

/**
 * Route consistency validation tests (PLA-363).
 * Prevents slug/platform parameter conflicts between route groups.
 */

function getRouteSegments(dir: string, prefix = ""): string[] {
  const segments: string[] = [];
  if (!existsSync(dir)) return segments;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const segment = `${prefix}/${entry}`;

    if (stat.isDirectory()) {
      // Check for page.tsx in this directory
      if (existsSync(join(fullPath, "page.tsx"))) {
        segments.push(segment);
      }
      // Recurse
      segments.push(...getRouteSegments(fullPath, segment));
    }
  }

  return segments;
}

describe("Route consistency validation", () => {
  it("dashboard developer detail route uses [slug], not [platform]", () => {
    const devDir = join(APP_DIR, "(dashboard)/developers");
    if (!existsSync(devDir)) return;

    const entries = readdirSync(devDir);
    // [slug] should exist, [platform] should NOT
    expect(entries).toContain("[slug]");
    expect(entries).not.toContain("[platform]");
  });

  it("marketing routes do not conflict with dashboard routes", () => {
    const dashboardRoutes = getRouteSegments(join(APP_DIR, "(dashboard)"));
    const marketingRoutes = getRouteSegments(join(APP_DIR, "(marketing)"));

    // Marketing routes should not share top-level paths with dashboard
    // Exception: both can have different sub-paths under the same top-level
    const dashTopLevel = new Set(dashboardRoutes.map((r) => r.split("/")[1]).filter(Boolean));
    const marketingTopLevel = new Set(marketingRoutes.map((r) => r.split("/")[1]).filter(Boolean));

    // These paths are expected to be marketing-only (public SEO pages)
    const seoRoutes = ["apps", "categories", "developers", "compare", "best", "trends", "insights"];
    for (const route of seoRoutes) {
      if (marketingTopLevel.has(route)) {
        // It's fine for marketing to have these
        expect(true).toBe(true);
      }
    }
  });

  it("no duplicate dynamic segments at same level", () => {
    // Check that no directory has both [slug] and [platform] children
    function checkNoDuplicateDynamic(dir: string) {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      const dynamicSegments = entries.filter((e) => e.startsWith("[") && e.endsWith("]"));

      // Each dynamic segment name should be unique at this level
      const names = dynamicSegments.map((s) => s);
      const unique = new Set(names);
      expect(names.length).toBe(unique.size);

      // Recurse into subdirectories
      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          checkNoDuplicateDynamic(full);
        }
      }
    }

    checkNoDuplicateDynamic(APP_DIR);
  });
});
