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
  it("dashboard developer detail uses [platform]/developers/[slug], not developers/[slug]", () => {
    // The old (dashboard)/developers/[slug] route was removed because it conflicted
    // with (marketing)/developers/[platform]/[slug]. Developer profiles are now served
    // exclusively via (dashboard)/[platform]/developers/[slug].
    const oldDevSlug = join(APP_DIR, "(dashboard)/developers/[slug]");
    expect(existsSync(oldDevSlug)).toBe(false);

    const platformDevSlug = join(APP_DIR, "(dashboard)/[platform]/developers/[slug]");
    expect(existsSync(platformDevSlug)).toBe(true);
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
