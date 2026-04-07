import { describe, it, expect } from "vitest";
import { sqlArray } from "../index.js";

/** Helper to extract the raw SQL string from a drizzle sql.raw() result */
function toSqlString(result: ReturnType<typeof sqlArray>): string {
  const r = result as any;
  return r.queryChunks
    ? r.queryChunks.map((c: any) => c.value ?? c).join("")
    : String(r);
}

describe("sqlArray", () => {
  // --- Integer arrays ---
  it("generates correct PG array for integer values", () => {
    expect(toSqlString(sqlArray([1, 2, 3]))).toContain("ARRAY[1,2,3]");
  });

  it("handles single integer", () => {
    expect(toSqlString(sqlArray([42]))).toContain("ARRAY[42]");
  });

  it("handles negative integers", () => {
    expect(toSqlString(sqlArray([-1, 0, 100]))).toContain("ARRAY[-1,0,100]");
  });

  it("handles large integers", () => {
    const big = [999999999, 1000000000];
    expect(toSqlString(sqlArray(big))).toContain(
      "ARRAY[999999999,1000000000]"
    );
  });

  it("handles floating point numbers", () => {
    expect(toSqlString(sqlArray([1.5, 2.75]))).toContain("ARRAY[1.5,2.75]");
  });

  // --- String arrays ---
  it("generates correct PG array for string values", () => {
    expect(toSqlString(sqlArray(["foo", "bar"]))).toContain(
      "ARRAY['foo','bar']"
    );
  });

  it("handles single string", () => {
    expect(toSqlString(sqlArray(["hello"]))).toContain("ARRAY['hello']");
  });

  it("escapes single quotes in string values", () => {
    const str = toSqlString(sqlArray(["it's", "O'Brien"]));
    expect(str).toContain("it''s");
    expect(str).toContain("O''Brien");
  });

  it("escapes multiple single quotes in one string", () => {
    const str = toSqlString(sqlArray(["it's a 'test'"]));
    expect(str).toContain("it''s a ''test''");
  });

  it("handles strings with backslashes", () => {
    const str = toSqlString(sqlArray(["path\\to\\file"]));
    // Backslashes are not escaped — PG standard quoting only escapes single quotes
    expect(str).toContain("path\\to\\file");
  });

  it("handles strings with commas", () => {
    const str = toSqlString(sqlArray(["a,b", "c,d"]));
    // Commas inside quotes are safe in PG ARRAY syntax
    expect(str).toContain("'a,b'");
    expect(str).toContain("'c,d'");
  });

  it("handles strings with special characters", () => {
    const str = toSqlString(sqlArray(["hello world", "foo@bar.com", "100%"]));
    expect(str).toContain("'hello world'");
    expect(str).toContain("'foo@bar.com'");
    expect(str).toContain("'100%'");
  });

  it("handles strings with unicode characters", () => {
    const str = toSqlString(sqlArray(["über", "日本語", "émoji 🚀"]));
    expect(str).toContain("'über'");
    expect(str).toContain("'日本語'");
    expect(str).toContain("'émoji 🚀'");
  });

  it("handles empty strings in array", () => {
    const str = toSqlString(sqlArray(["", "notempty"]));
    expect(str).toContain("''");
    expect(str).toContain("'notempty'");
  });

  // --- SQL injection prevention ---
  it("prevents SQL injection via single quote escaping", () => {
    const malicious = "'; DROP TABLE users; --";
    const str = toSqlString(sqlArray([malicious]));
    // The single quote is doubled to escape it: ' → ''
    // Input: '; DROP TABLE users; --
    // After escape: ''; DROP TABLE users; --
    // Wrapped in quotes: '''; DROP TABLE users; --'
    // The leading quote is escaped (doubled), so PG treats it as a literal apostrophe
    expect(str).toBe("ARRAY['''; DROP TABLE users; --']");
  });

  it("prevents injection via nested array syntax", () => {
    const str = toSqlString(sqlArray(["a]); DROP TABLE apps; --"]));
    expect(str).toContain("'a]); DROP TABLE apps; --'");
  });

  // --- Empty array ---
  it("returns empty PG array with integer cast for empty input", () => {
    const str = toSqlString(sqlArray([]));
    expect(str).toBe("ARRAY[]::integer[]");
  });

  it("returns empty PG array with uuid cast when pgType specified", () => {
    const str = toSqlString(sqlArray([], "uuid"));
    expect(str).toBe("ARRAY[]::uuid[]");
  });

  // --- pgType parameter (explicit PostgreSQL type cast) ---
  it("adds ::uuid[] cast for UUID string arrays", () => {
    const str = toSqlString(sqlArray(["869253b7-eb5a-42c2-8751-e1211dbdf0c4"], "uuid"));
    expect(str).toBe("ARRAY['869253b7-eb5a-42c2-8751-e1211dbdf0c4']::uuid[]");
  });

  it("adds ::text[] cast for text arrays when explicitly requested", () => {
    const str = toSqlString(sqlArray(["foo", "bar"], "text"));
    expect(str).toBe("ARRAY['foo','bar']::text[]");
  });

  it("no cast for string arrays when pgType not specified (backwards compat)", () => {
    const str = toSqlString(sqlArray(["foo", "bar"]));
    expect(str).toBe("ARRAY['foo','bar']");
  });

  it("adds cast to integer arrays when pgType specified", () => {
    const str = toSqlString(sqlArray([1, 2, 3], "integer"));
    expect(str).toBe("ARRAY[1,2,3]::integer[]");
  });

  // --- Type detection ---
  it("detects type from first element — number", () => {
    // First element is number → no quoting
    const str = toSqlString(sqlArray([1, 2, 3]));
    expect(str).not.toContain("'");
  });

  it("detects type from first element — string", () => {
    // First element is string → all are quoted
    const str = toSqlString(sqlArray(["1", "2", "3"]));
    expect(str).toContain("'1'");
    expect(str).toContain("'2'");
    expect(str).toContain("'3'");
  });

  it("handles large arrays efficiently", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
    const str = toSqlString(sqlArray(ids));
    expect(str).toMatch(/^ARRAY\[\d/);
    expect(str).toContain("1000");
  });
});

describe("no raw ANY(${array}) in codebase", () => {
  it("all ANY() calls use sqlArray, not raw interpolation", async () => {
    const { readdirSync, readFileSync } = await import("fs");
    const { join } = await import("path");

    const root = join(__dirname, "../../../../apps");
    const violations: string[] = [];

    function scanDir(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".d.ts")) {
          const content = readFileSync(full, "utf-8");
          // Match ANY(${...}) where the interpolation does NOT start with sqlArray
          const regex = /ANY\(\$\{(?!sqlArray\()/g;
          let match;
          while ((match = regex.exec(content)) !== null) {
            const line = content.substring(0, match.index).split("\n").length;
            violations.push(`${full.replace(root + "/", "apps/")}:${line}`);
          }
        }
      }
    }

    scanDir(root);
    expect(violations).toEqual([]);
  });
});
