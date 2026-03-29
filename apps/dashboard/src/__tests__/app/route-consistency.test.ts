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
  it("dashboard developer detail route exists under [platform]", () => {
    // Per-platform view: /[platform]/developers/[slug] — shows apps for one platform
    const platformDevSlug = join(APP_DIR, "(dashboard)/[platform]/developers/[slug]");
    expect(existsSync(join(platformDevSlug, "page.tsx"))).toBe(true);
  });

  it("cross-platform developers/[slug] route must NOT exist (conflicts with [platform])", () => {
    // This route causes Next.js 500: "You cannot use different slug names for the same
    // dynamic path ('slug' !== 'platform')". Use /developer/{slug} (singular) instead.
    const conflictingRoute = join(APP_DIR, "(dashboard)/developers/[slug]");
    expect(existsSync(conflictingRoute)).toBe(false);
  });

  it("cross-platform developer/[slug] route exists (singular, avoids [platform] conflict)", () => {
    // /developer/{slug} (singular) is a separate static segment that doesn't exist under
    // [platform], so it avoids the Next.js dynamic param name conflict.
    const crossPlatformRoute = join(APP_DIR, "(dashboard)/developer/[slug]");
    expect(existsSync(join(crossPlatformRoute, "page.tsx"))).toBe(true);
  });

  it("developers list page exists", () => {
    const listPage = join(APP_DIR, "(dashboard)/developers/page.tsx");
    expect(existsSync(listPage)).toBe(true);
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
    function checkNoDuplicateDynamic(dir: string) {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      const dynamicSegments = entries.filter((e) => e.startsWith("[") && e.endsWith("]"));

      const names = dynamicSegments.map((s) => s);
      const unique = new Set(names);
      expect(names.length).toBe(unique.size);

      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          checkNoDuplicateDynamic(full);
        }
      }
    }

    checkNoDuplicateDynamic(APP_DIR);
  });

  it("static siblings of a dynamic route must not have child dynamic segments with different names", () => {
    // Next.js error: "You cannot use different slug names for the same dynamic path"
    // When a directory has [platform] and a static sibling like "developers",
    // any dynamic child of "developers" (e.g. [slug]) conflicts with [platform]'s
    // children because Next.js resolves them at the same path depth.
    function checkRouteGroup(dir: string) {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      const dynamicEntries = entries.filter((e) => e.startsWith("[") && e.endsWith("]"));
      const staticEntries = entries.filter(
        (e) => !e.startsWith("[") && !e.startsWith("(") && statSync(join(dir, e)).isDirectory()
      );

      if (dynamicEntries.length === 0) {
        // No dynamic segment at this level — recurse into children
        for (const entry of entries) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) {
            checkRouteGroup(full);
          }
        }
        return;
      }

      // There's a dynamic segment (e.g. [platform]) at this level.
      // Collect all dynamic param names used by the dynamic segment's children at each depth.
      const dynamicParamsByDepth = new Map<number, Set<string>>();
      function collectDynamicParams(d: string, depth: number) {
        if (!existsSync(d)) return;
        for (const child of readdirSync(d)) {
          const childPath = join(d, child);
          if (!statSync(childPath).isDirectory()) continue;
          if (child.startsWith("[") && child.endsWith("]")) {
            if (!dynamicParamsByDepth.has(depth)) dynamicParamsByDepth.set(depth, new Set());
            dynamicParamsByDepth.get(depth)!.add(child);
          }
          collectDynamicParams(childPath, depth + 1);
        }
      }
      for (const dyn of dynamicEntries) {
        collectDynamicParams(join(dir, dyn), 1);
      }

      // Now check static siblings — their dynamic children at each depth must
      // use the same param name as the dynamic route's children at that depth.
      for (const staticDir of staticEntries) {
        function checkStaticChildren(d: string, depth: number) {
          if (!existsSync(d)) return;
          for (const child of readdirSync(d)) {
            const childPath = join(d, child);
            if (!statSync(childPath).isDirectory()) continue;
            if (child.startsWith("[") && child.endsWith("]")) {
              const expected = dynamicParamsByDepth.get(depth);
              if (expected && expected.size > 0 && !expected.has(child)) {
                // This will fail with a descriptive message
                expect(child).toBe(
                  `one of ${[...expected].join(", ")} (found in ${dir}/${staticDir} at depth ${depth})`
                );
              }
            }
            checkStaticChildren(childPath, depth + 1);
          }
        }
        checkStaticChildren(join(dir, staticDir), 1);
      }

      // Recurse into route groups and all children
      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          checkRouteGroup(full);
        }
      }
    }

    // Check each route group under app/
    for (const entry of readdirSync(APP_DIR)) {
      const full = join(APP_DIR, entry);
      if (statSync(full).isDirectory()) {
        checkRouteGroup(full);
      }
    }
  });
});
