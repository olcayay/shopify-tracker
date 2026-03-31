/**
 * Dark Mode CSS Antipattern Scanner
 *
 * Scans all dashboard TSX files for common dark mode issues:
 * 1. Missing dark: variants for light-mode-specific classes
 * 2. Hardcoded hex colors in className without dark variant
 *
 * Exclusions:
 * - Files in preview/ directories (intentionally light-themed marketplace previews)
 * - Files with force-light class usage
 * - OG image route (api/og/route.tsx — server-rendered, no dark mode)
 * - Test files
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, relative, join } from "path";

const DASHBOARD_SRC = resolve(__dirname, "../../");

// Files/directories excluded from scanning
const EXCLUDED_PATTERNS = [
  /\/preview\//,
  /\/api\/og\//,
  /\/__tests__\//,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
];

// Additional per-file allowlist: file path pattern => reason
const FILE_ALLOWLIST: Record<string, string> = {
  "components/landing/cta-section.tsx":
    "bg-white used on violet gradient background — works in both modes",
};

// Per-line allowlist: { "relative/file:lineNumber" => reason }
// Use when only specific lines in a file are false positives
const LINE_ALLOWLIST: Record<string, string> = {
  // bg-white progress bar fill on purple gradient background — always on colored bg
  "app/(dashboard)/[platform]/research/[id]/research-virtual-apps.tsx:97":
    "progress bar fill on purple gradient background",
  // text-gray-700 in a JS object literal (fallback badge color), not a direct className
  "app/(dashboard)/[platform]/research/[id]/research-word-analysis.tsx:113":
    "color string in JS object literal, not direct className",
  // bg-gray-300 in STATUS_COLORS map — used as small colored dot, context is always ring/indicator
  "app/(dashboard)/system-admin/scraper/components/matrix-cell.tsx:66":
    "status color dot in STATUS_COLORS map — always on card bg with ring",
};

// Class patterns that need dark: variants when used alone
// [lightRegex, requiredDarkPrefix, description]
const LIGHT_ONLY_PATTERNS: Array<[RegExp, string, string]> = [
  // bg-white (but NOT bg-white/NN opacity variants on colored backgrounds)
  [/\bbg-white\b(?!\/\d)/, "dark:bg-", "bg-white without dark:bg-* variant"],
  // bg-gray-50 through bg-gray-300 (light backgrounds)
  [
    /\bbg-gray-(?:50|100|150|200|250|300)\b/,
    "dark:bg-",
    "bg-gray-{light} without dark:bg-* variant",
  ],
  // text-gray-700+ and text-black (dark text on light bg)
  [
    /\btext-gray-(?:700|750|800|850|900|950)\b/,
    "dark:text-",
    "dark text-gray without dark:text-* variant",
  ],
  [/\btext-black\b/, "dark:text-", "text-black without dark:text-* variant"],
  // border-gray light values
  [
    /\bborder-gray-(?:100|150|200|250|300)\b/,
    "dark:border-",
    "light border-gray without dark:border-* variant",
  ],
  // Hardcoded hex colors in className
  [
    /\bbg-\[#[0-9a-fA-F]+\]/,
    "dark:bg-",
    "hardcoded bg hex color without dark variant",
  ],
  [
    /\btext-\[#[0-9a-fA-F]+\]/,
    "dark:text-",
    "hardcoded text hex color without dark variant",
  ],
  [
    /\bborder-\[#[0-9a-fA-F]+\]/,
    "dark:border-",
    "hardcoded border hex color without dark variant",
  ],
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

function isExcluded(filePath: string): boolean {
  const rel = relative(DASHBOARD_SRC, filePath);
  if (EXCLUDED_PATTERNS.some((p) => p.test(filePath))) return true;
  if (Object.keys(FILE_ALLOWLIST).some((allowed) => rel.includes(allowed)))
    return true;
  return false;
}

function hasForceLight(content: string): boolean {
  return content.includes("force-light");
}

function scanFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, "utf-8");

  // Skip files that use force-light (entire file is light-mode intentional)
  if (hasForceLight(content)) return [];

  const lines = content.split("\n");
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    for (const [lightPattern, darkPrefix, description] of LIGHT_ONLY_PATTERNS) {
      if (lightPattern.test(line)) {
        // Check if this line or surrounding context has the required dark: variant
        const contextWindow = lines
          .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
          .join(" ");

        if (!contextWindow.includes(darkPrefix)) {
          const rel = relative(DASHBOARD_SRC, filePath);
          const lineKey = `${rel}:${i + 1}`;
          if (lineKey in LINE_ALLOWLIST) continue;

          violations.push({
            file: rel,
            line: i + 1,
            pattern: description,
            content: line.trim().substring(0, 120),
          });
        }
      }
    }
  }

  return violations;
}

describe("Dark mode CSS antipatterns", () => {
  let allFiles: string[];

  beforeAll(() => {
    allFiles = findTsxFiles(DASHBOARD_SRC);
  });

  it("should find TSX files to scan", () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it("should have no missing dark: variants in non-excluded files", () => {
    const allViolations: Violation[] = [];

    for (const file of allFiles) {
      if (isExcluded(file)) continue;
      const violations = scanFile(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(
          (v) => `  ${v.file}:${v.line} — ${v.pattern}\n    ${v.content}`
        )
        .join("\n\n");

      expect(allViolations).toEqual(
        expect.objectContaining({ length: 0 })
      );
      // If the above fails, print detailed report
      throw new Error(
        `Found ${allViolations.length} dark mode antipattern(s):\n\n${report}\n\n` +
          `To fix: add the corresponding dark: variant class, or add the file to the allowlist in this test if intentional.`
      );
    }
  });

  it("should exclude preview files from scanning", () => {
    const previewFiles = allFiles.filter((f) => f.includes("/preview/"));
    expect(previewFiles.length).toBeGreaterThan(0);
    for (const f of previewFiles) {
      expect(isExcluded(f)).toBe(true);
    }
  });

  it("should exclude OG image route from scanning", () => {
    const ogFile = allFiles.find((f) => f.includes("/api/og/"));
    if (ogFile) {
      expect(isExcluded(ogFile)).toBe(true);
    }
  });

  it("should exclude test files from scanning", () => {
    const testFiles = allFiles.filter((f) => f.includes("/__tests__/"));
    expect(testFiles.length).toBeGreaterThan(0);
    for (const f of testFiles) {
      expect(isExcluded(f)).toBe(true);
    }
  });
});
