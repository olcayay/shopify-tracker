import { describe, it, expect } from "vitest";
import { sqlArray } from "../index.js";

describe("sqlArray", () => {
  it("generates correct PG array for integer values", () => {
    const result = sqlArray([1, 2, 3]);
    // SQL chunks contain the raw string
    const sqlStr = (result as any).queryChunks
      ? (result as any).queryChunks.map((c: any) => c.value ?? c).join("")
      : String(result);
    expect(sqlStr).toContain("ARRAY[1,2,3]");
  });

  it("generates correct PG array for string values", () => {
    const result = sqlArray(["foo", "bar"]);
    const sqlStr = (result as any).queryChunks
      ? (result as any).queryChunks.map((c: any) => c.value ?? c).join("")
      : String(result);
    expect(sqlStr).toContain("ARRAY['foo','bar']");
  });

  it("escapes single quotes in string values", () => {
    const result = sqlArray(["it's", "O'Brien"]);
    const sqlStr = (result as any).queryChunks
      ? (result as any).queryChunks.map((c: any) => c.value ?? c).join("")
      : String(result);
    expect(sqlStr).toContain("it''s");
    expect(sqlStr).toContain("O''Brien");
  });

  it("returns empty PG array for empty input", () => {
    const result = sqlArray([]);
    const sqlStr = (result as any).queryChunks
      ? (result as any).queryChunks.map((c: any) => c.value ?? c).join("")
      : String(result);
    expect(sqlStr).toContain("ARRAY[]::integer[]");
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
