import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Structural guard: sendMail from mailer.ts should only be imported
 * by pipeline internals (pipeline.ts, process-instant-email.ts) and mailer.ts itself.
 * All other email senders must use sendEmail() from pipeline.ts.
 */

const ALLOWED_FILES = new Set([
  "mailer.ts",
  "pipeline.ts",
  "process-instant-email.ts",
]);

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("sendMail import guard", () => {
  it("sendMail is not imported outside pipeline internals", () => {
    const srcDir = join(__dirname, "..", "..", "email");
    const scraperSrc = join(__dirname, "..", "..");
    const allFiles = collectTsFiles(scraperSrc);

    const violations: string[] = [];

    for (const file of allFiles) {
      const basename = file.split("/").pop()!;
      if (ALLOWED_FILES.has(basename)) continue;
      // Skip test files
      if (file.includes("__tests__")) continue;

      const content = readFileSync(file, "utf-8");
      // Check for sendMail imports (both static and dynamic)
      if (
        content.includes('from "./email/mailer') ||
        content.includes('from "../email/mailer') ||
        content.includes('from "./mailer') ||
        content.includes('import("./email/mailer') ||
        content.includes('import("../email/mailer') ||
        content.includes('import("./mailer')
      ) {
        const relative = file.replace(scraperSrc + "/", "");
        violations.push(relative);
      }
    }

    expect(
      violations,
      `These files import sendMail directly — use sendEmail() from pipeline.ts instead:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
