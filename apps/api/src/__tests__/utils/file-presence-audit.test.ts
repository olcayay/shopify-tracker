/**
 * File presence audit — verify all required project files exist.
 * Catches accidentally deleted or renamed files before deployment.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../../../..");

describe("Required file presence audit", () => {
  const requiredFiles = [
    // Dockerfiles
    "Dockerfile.api",
    "Dockerfile.dashboard",
    "Dockerfile.worker",
    // Docker compose
    "docker-compose.yml",
    // Config
    "package.json",
    "turbo.json",
    "tsconfig.base.json",
    ".env.example",
    // CI
    ".github/workflows/ci.yml",
    // Documentation
    "CONTRIBUTING.md",
    "CLAUDE.md",
    // DB migrations
    "packages/db/src/migrations/meta/_journal.json",
    // Package configs
    "apps/api/package.json",
    "apps/dashboard/package.json",
    "apps/scraper/package.json",
    "packages/db/package.json",
    "packages/shared/package.json",
    // Key source files
    "apps/api/src/index.ts",
    "apps/dashboard/src/app/layout.tsx",
    "apps/dashboard/next.config.ts",
    // Env examples
    "apps/api/.env.example",
    "apps/dashboard/.env.example",
    "apps/scraper/.env.example",
    // Scripts
    "scripts/backup-db.sh",
    "scripts/smoke-test.sh",
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(existsSync(resolve(root, file)), `Missing required file: ${file}`).toBe(true);
    });
  }
});
