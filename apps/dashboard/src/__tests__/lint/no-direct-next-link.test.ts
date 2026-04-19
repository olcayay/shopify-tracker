/**
 * Prevent direct `import Link from "next/link"` usage.
 *
 * All dashboard code must use `@/components/ui/link` instead, which wraps
 * next/link with `prefetch={false}` by default. Without this, Next.js eagerly
 * prefetches RSC data for every visible <Link> on render, causing 50-100+
 * duplicate network requests on data-heavy pages (overview, platform pages).
 *
 * The only file allowed to import from "next/link" is the wrapper itself.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const SRC_ROOT = resolve(__dirname, "../..");

// Only the custom Link wrapper is allowed to import from next/link
const ALLOWED_FILES = new Set([
  "components/ui/link.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(p, out);
    } else if ((p.endsWith(".tsx") || p.endsWith(".ts")) && !p.includes("__tests__")) {
      out.push(p);
    }
  }
  return out;
}

// Match: import Link from "next/link"  or  import Link from 'next/link'
// Also catch: import { ... } from "next/link" (named imports)
// Also catch: import NextLink from "next/link" (aliased imports)
const NEXT_LINK_IMPORT = /import\s+(?:\w+|{[^}]+})\s+from\s+["']next\/link["']/;

describe("no direct next/link imports", () => {
  it("all files use @/components/ui/link instead of next/link", () => {
    const files = walk(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(SRC_ROOT, file);
      if (ALLOWED_FILES.has(rel)) continue;

      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (NEXT_LINK_IMPORT.test(lines[i])) {
          violations.push(
            `${rel}:${i + 1} — use import Link from "@/components/ui/link" instead of "next/link"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} file(s) importing directly from "next/link".\n` +
      "Use @/components/ui/link which defaults prefetch={false} to prevent RSC request storms.\n\n" +
      violations.join("\n")
    ).toEqual([]);
  });
});
