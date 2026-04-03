/**
 * Tests that verify Docker HEALTHCHECK configuration exists
 * in the application Dockerfiles.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../../..");

describe("Docker HEALTHCHECK configuration", () => {
  const dockerfiles = [
    { file: "Dockerfile.api", name: "API" },
    { file: "Dockerfile.dashboard", name: "Dashboard" },
  ];

  for (const { file, name } of dockerfiles) {
    it(`${name} Dockerfile exists`, () => {
      expect(existsSync(resolve(projectRoot, file))).toBe(true);
    });

    it(`${name} Dockerfile has HEALTHCHECK directive`, () => {
      const content = readFileSync(resolve(projectRoot, file), "utf-8");
      expect(content).toContain("HEALTHCHECK");
    });

    it(`${name} HEALTHCHECK has interval and timeout`, () => {
      const content = readFileSync(resolve(projectRoot, file), "utf-8");
      expect(content).toMatch(/--interval=\d+s/);
      expect(content).toMatch(/--timeout=\d+s/);
    });

    it(`${name} HEALTHCHECK has retries configured`, () => {
      const content = readFileSync(resolve(projectRoot, file), "utf-8");
      expect(content).toMatch(/--retries=\d+/);
    });
  }

  it("Worker Dockerfiles have process-based HEALTHCHECK", () => {
    const workerFiles = ["Dockerfile.worker", "Dockerfile.worker-email", "Dockerfile.worker-interactive"];
    for (const file of workerFiles) {
      const content = readFileSync(resolve(projectRoot, file), "utf-8");
      expect(content, `${file} missing HEALTHCHECK`).toContain("HEALTHCHECK");
      expect(content, `${file} should use pgrep for process check`).toContain("pgrep");
    }
  });

  it("All Dockerfiles have CMD instruction", () => {
    const files = ["Dockerfile.api", "Dockerfile.dashboard", "Dockerfile.worker"];
    for (const file of files) {
      const content = readFileSync(resolve(projectRoot, file), "utf-8");
      expect(content, `${file} missing CMD`).toContain("CMD");
    }
  });

  it("All Dockerfiles expose correct ports", () => {
    const apiContent = readFileSync(resolve(projectRoot, "Dockerfile.api"), "utf-8");
    expect(apiContent).toContain("EXPOSE 3001");

    const dashContent = readFileSync(resolve(projectRoot, "Dockerfile.dashboard"), "utf-8");
    expect(dashContent).toContain("EXPOSE 3000");
  });
});
