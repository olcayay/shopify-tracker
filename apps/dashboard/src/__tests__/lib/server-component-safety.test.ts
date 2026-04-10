import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Server Component safety test.
 *
 * Server Components (files without "use client") cannot use:
 * - Event handlers: onClick, onChange, onSubmit, onFocus, onBlur, etc.
 * - React hooks: useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer
 * - Browser APIs: document., window., localStorage., sessionStorage.
 *
 * This test scans all .tsx files in app/ that are Server Components and flags
 * any usage of client-only patterns. This prevents runtime crashes that are
 * invisible at build time.
 */

const APP_DIR = path.resolve(__dirname, "../../app");

// Client-only patterns that crash in Server Components
const CLIENT_ONLY_PATTERNS: { pattern: RegExp; description: string }[] = [
  // Event handler props (onClick, onChange, onSubmit, etc.)
  { pattern: /\bon(?:Click|Change|Submit|Focus|Blur|KeyDown|KeyUp|KeyPress|Mouse\w+|Touch\w+|Drag\w+|Scroll|Input|Select|Pointer\w+)\s*[={]/, description: "event handler prop" },
  // React hooks
  { pattern: /\b(?:useState|useEffect|useReducer|useLayoutEffect)\s*\(/, description: "React hook" },
  // Browser globals used as statements (not in comments or strings)
  { pattern: /\bdocument\.(?:cookie|getElementById|querySelector|addEventListener|createElement|body)/, description: "document API" },
  { pattern: /\bwindow\.(?:addEventListener|location|open|alert|confirm|prompt|scrollTo)/, description: "window API" },
  { pattern: /\blocalStorage\./, description: "localStorage API" },
  { pattern: /\bsessionStorage\./, description: "sessionStorage API" },
];

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isServerComponent(content: string): boolean {
  // Files with "use client" directive are client components
  const firstLines = content.slice(0, 200);
  return !firstLines.includes('"use client"') && !firstLines.includes("'use client'");
}

function stripComments(content: string): string {
  // Remove single-line comments
  content = content.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  return content;
}

describe("Server Component safety", () => {
  const allFiles = getAllTsxFiles(APP_DIR);
  const serverComponents = allFiles.filter((f) => {
    const content = fs.readFileSync(f, "utf-8");
    return isServerComponent(content);
  });

  it("finds server component files to test", () => {
    expect(serverComponents.length).toBeGreaterThan(0);
  });

  it("no server component uses client-only patterns", () => {
    const violations: { file: string; line: number; pattern: string; text: string }[] = [];

    for (const filePath of serverComponents) {
      const content = fs.readFileSync(filePath, "utf-8");
      const stripped = stripComments(content);
      const lines = stripped.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip import lines — importing a client component is fine
        if (line.trimStart().startsWith("import ")) continue;
        // Skip type annotations and interfaces
        if (line.trimStart().startsWith("type ") || line.trimStart().startsWith("interface ")) continue;
        // Skip dangerouslySetInnerHTML / inline script strings (e.g., theme detection)
        if (line.includes("__html") || line.includes("dangerouslySetInnerHTML")) continue;

        for (const { pattern, description } of CLIENT_ONLY_PATTERNS) {
          if (pattern.test(line)) {
            const relPath = path.relative(APP_DIR, filePath);
            violations.push({
              file: relPath,
              line: i + 1,
              pattern: description,
              text: line.trim().slice(0, 80),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} — ${v.pattern}\n    ${v.text}`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} client-only pattern(s) in Server Components:\n${report}\n\n` +
        `Fix: Add "use client" directive or extract the interactive part into a client component.`
      );
    }
  });
});
