/**
 * Regression tests for Date serialization in sql tagged template literals.
 *
 * The postgres-js driver's internal Buffer.byteLength() rejects raw Date objects
 * passed via sql`...${date}...` — they must be converted to ISO strings first.
 * Drizzle .set() / .values() handle Date objects fine (the ORM serializes them),
 * but sql`` template interpolation does NOT.
 *
 * These tests scan source files that use sql templates with cutoff/date variables
 * and verify they call .toISOString() before interpolation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../../..");

/** Read a source file and return lines containing sql template Date interpolation */
function findRawDateInSqlTemplates(filePath: string): string[] {
  const absPath = resolve(projectRoot, filePath);
  const content = readFileSync(absPath, "utf-8");
  const lines = content.split("\n");
  const issues: string[] = [];

  // Track variables assigned as `new Date()` (without .toISOString())
  const dateVars = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track: `const/let/var x = new Date()` (not followed by .toISOString())
    const assignMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+Date\(\)/);
    if (assignMatch && !line.includes(".toISOString()")) {
      dateVars.add(assignMatch[1]);
    }

    // Check: sql`...${varName}...` where varName is a tracked Date variable
    // and does NOT have .toISOString() appended
    for (const varName of dateVars) {
      // Match ${varName} without .toISOString()
      const sqlInterpolation = new RegExp(`\\$\\{${varName}\\}`);
      const sqlInterpolationWithIso = new RegExp(`\\$\\{${varName}\\.toISOString\\(\\)\\}`);
      if (sqlInterpolation.test(line) && !sqlInterpolationWithIso.test(line)) {
        // Verify this is inside a sql`` template (check surrounding context)
        const contextStart = Math.max(0, i - 10);
        const context = lines.slice(contextStart, i + 1).join("\n");
        if (context.includes("sql`") || context.includes("sql.raw")) {
          issues.push(`Line ${i + 1}: raw Date variable '${varName}' in sql template — needs .toISOString()`);
        }
      }
    }
  }

  return issues;
}

describe("Date serialization in sql templates", () => {
  const filesToCheck = [
    "apps/api/src/routes/email-analytics.ts",
    "apps/api/src/routes/email-errors.ts",
    "apps/api/src/routes/email-alerts.ts",
    "apps/api/src/routes/notification-analytics.ts",
    "apps/api/src/routes/admin-notifications.ts",
    "apps/api/src/routes/suppression.ts",
    "apps/api/src/routes/notification-stream.ts",
  ];

  for (const file of filesToCheck) {
    it(`${file} — no raw Date objects in sql templates`, () => {
      const issues = findRawDateInSqlTemplates(file);
      if (issues.length > 0) {
        throw new Error(
          `Found raw Date objects in sql templates (will crash with Buffer.byteLength error):\n` +
          issues.map(i => `  ${i}`).join("\n")
        );
      }
    });
  }

  it("regression: cutoff Date must use .toISOString() in sql templates", () => {
    // This test ensures the pattern `const cutoff = new Date(); ... sql`...${cutoff}...``
    // always includes .toISOString() — the fix for PLA-867
    const emailAnalytics = readFileSync(resolve(projectRoot, "apps/api/src/routes/email-analytics.ts"), "utf-8");
    const emailErrors = readFileSync(resolve(projectRoot, "apps/api/src/routes/email-errors.ts"), "utf-8");
    const notifAnalytics = readFileSync(resolve(projectRoot, "apps/api/src/routes/notification-analytics.ts"), "utf-8");
    const emailAlerts = readFileSync(resolve(projectRoot, "apps/api/src/routes/email-alerts.ts"), "utf-8");
    const adminNotifs = readFileSync(resolve(projectRoot, "apps/api/src/routes/admin-notifications.ts"), "utf-8");

    // None of these files should contain ${cutoff} without .toISOString()
    for (const [name, content] of [
      ["email-analytics", emailAnalytics],
      ["email-errors", emailErrors],
      ["notification-analytics", notifAnalytics],
      ["email-alerts", emailAlerts],
      ["admin-notifications", adminNotifs],
    ] as const) {
      const rawCutoffInSql = /\$\{cutoff\}/.test(content);
      const isoInSql = /\$\{cutoff\.toISOString\(\)\}/.test(content);

      if (rawCutoffInSql) {
        expect.fail(`${name}: found raw \${cutoff} in sql template — must use \${cutoff.toISOString()}`);
      }
    }
  });
});
