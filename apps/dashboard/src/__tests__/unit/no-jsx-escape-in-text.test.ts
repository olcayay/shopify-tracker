import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// PLA-1108 regression guard.
//
// JSX text nodes do NOT interpret JS escape sequences. Writing `\u00B7`
// between `}` and `{` (or plain `>`…`<`) renders the literal 6-char string
// "\u00B7" instead of "·". Real bug shipped on /organization.
//
// Heuristic: flag any `\u[0-9A-Fa-f]{4}` in a .tsx file that sits BETWEEN
// a closing `}` and an opening `{` (i.e. raw JSX text between two
// expressions), or between `>` and `<` on the same line. Anything inside
// backticks, single-quotes, or double-quotes is fine (JS string position).

const SRC_ROOT = resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(p, out);
    } else if (p.endsWith(".tsx") && !p.includes("__tests__")) {
      out.push(p);
    }
  }
  return out;
}

// Strip JS strings + template literals + JSX expressions-with-escape to a
// conservative approximation. Simpler: split the line by quoted-string regex
// and only scan the non-quoted parts for the bug pattern.
const QUOTED = /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

// Bug pattern: a unicode escape sitting in a raw-text position.
//   Case A: `} \uXXXX {`  (between two expressions)
//   Case B: `> \uXXXX <`  (between tags)
//   Case C: `} \uXXXX <`  (expression then closing tag)
//   Case D: `> \uXXXX {`  (opening tag text then expression)
const BUG = /[}>][^\n{}<>"'`]*\\u[0-9A-Fa-f]{4}[^\n{}<>"'`]*[{<]/;

describe("no \\uXXXX escapes in JSX text positions (PLA-1108)", () => {
  it("has no occurrences repo-wide", () => {
    const files = walk(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Remove quoted string contents so escapes inside JS strings are ignored.
      const scrubbed = src.replace(QUOTED, (m) => '"'.repeat(m.length));
      const lines = scrubbed.split("\n");
      lines.forEach((ln, i) => {
        if (BUG.test(ln)) {
          offenders.push(`${file}:${i + 1}: ${ln.trim().slice(0, 180)}`);
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
