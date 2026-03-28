import { describe, it, expect } from "vitest";
import { validateEnv, API_REQUIRED_ENV, SCRAPER_REQUIRED_ENV } from "../env.js";

describe("validateEnv", () => {
  it("should not throw when all required vars are present", () => {
    const env = { DATABASE_URL: "postgres://localhost/test", JWT_SECRET: "secret" };
    expect(() => validateEnv(["DATABASE_URL", "JWT_SECRET"], env)).not.toThrow();
  });

  it("should throw when a single var is missing", () => {
    const env = { JWT_SECRET: "secret" };
    expect(() => validateEnv(["DATABASE_URL", "JWT_SECRET"], env)).toThrow(
      "Missing required environment variables",
    );
  });

  it("should list ALL missing vars, not just the first", () => {
    const env = {};
    try {
      validateEnv(["DATABASE_URL", "JWT_SECRET", "REDIS_URL"], env);
      expect.unreachable("should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("DATABASE_URL");
      expect(err.message).toContain("JWT_SECRET");
      expect(err.message).toContain("REDIS_URL");
      expect(err.missing).toEqual(["DATABASE_URL", "JWT_SECRET", "REDIS_URL"]);
    }
  });

  it("should treat empty string as missing", () => {
    const env = { DATABASE_URL: "" };
    expect(() => validateEnv(["DATABASE_URL"], env)).toThrow("DATABASE_URL");
  });

  it("should pass when required list is empty", () => {
    expect(() => validateEnv([], {})).not.toThrow();
  });

  it("should ignore extra env vars not in the required list", () => {
    const env = { DATABASE_URL: "postgres://localhost/test", EXTRA: "value" };
    expect(() => validateEnv(["DATABASE_URL"], env)).not.toThrow();
  });

  it("should use process.env by default when env param is omitted", () => {
    const original = process.env.__TEST_VALIDATE_ENV__;
    process.env.__TEST_VALIDATE_ENV__ = "present";
    try {
      expect(() => validateEnv(["__TEST_VALIDATE_ENV__"])).not.toThrow();
    } finally {
      if (original === undefined) delete process.env.__TEST_VALIDATE_ENV__;
      else process.env.__TEST_VALIDATE_ENV__ = original;
    }
  });
});

describe("constant arrays", () => {
  it("API_REQUIRED_ENV should contain DATABASE_URL and JWT_SECRET", () => {
    expect(API_REQUIRED_ENV).toContain("DATABASE_URL");
    expect(API_REQUIRED_ENV).toContain("JWT_SECRET");
  });

  it("SCRAPER_REQUIRED_ENV should contain DATABASE_URL", () => {
    expect(SCRAPER_REQUIRED_ENV).toContain("DATABASE_URL");
  });
});
