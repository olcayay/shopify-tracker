import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, createLogger } from "../logger.js";

describe("Logger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.LOG_LEVEL;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.env.LOG_LEVEL = originalEnv;
  });

  describe("constructor defaults", () => {
    it("defaults minLevel to info when LOG_LEVEL env is not set", () => {
      delete process.env.LOG_LEVEL;
      const logger = new Logger();
      // debug should be suppressed at info level
      logger.debug("should not appear");
      expect(stdoutSpy).not.toHaveBeenCalled();
      // info should go through
      logger.info("should appear");
      expect(stdoutSpy).toHaveBeenCalledOnce();
    });

    it("reads minLevel from LOG_LEVEL env variable", () => {
      process.env.LOG_LEVEL = "debug";
      const logger = new Logger();
      logger.debug("debug message");
      expect(stdoutSpy).toHaveBeenCalledOnce();
    });
  });

  describe("log levels", () => {
    it("logs debug messages when minLevel is debug", () => {
      const logger = new Logger({}, "debug");
      logger.debug("test debug");
      expect(stdoutSpy).toHaveBeenCalledOnce();
    });

    it("logs info messages", () => {
      const logger = new Logger({}, "info");
      logger.info("test info");
      expect(stdoutSpy).toHaveBeenCalledOnce();
    });

    it("logs warn messages", () => {
      const logger = new Logger({}, "info");
      logger.warn("test warn");
      expect(stdoutSpy).toHaveBeenCalledOnce();
    });

    it("logs error messages", () => {
      const logger = new Logger({}, "info");
      logger.error("test error");
      expect(stderrSpy).toHaveBeenCalledOnce();
    });
  });

  describe("level filtering", () => {
    it("suppresses debug logs when minLevel is info", () => {
      const logger = new Logger({}, "info");
      logger.debug("suppressed");
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("suppresses debug and info logs when minLevel is warn", () => {
      const logger = new Logger({}, "warn");
      logger.debug("suppressed");
      logger.info("suppressed");
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it("error always goes through regardless of minLevel", () => {
      const logger = new Logger({}, "error");
      logger.error("always visible");
      expect(stderrSpy).toHaveBeenCalledOnce();
    });
  });

  describe("JSON output format", () => {
    it("outputs valid JSON with level, time, and msg fields", () => {
      const logger = new Logger({}, "info");
      logger.info("hello world");

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toMatch(/\n$/);

      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe("info");
      expect(parsed.msg).toBe("hello world");
      expect(parsed.time).toBeDefined();
      // time should be ISO string
      expect(() => new Date(parsed.time)).not.toThrow();
      expect(new Date(parsed.time).toISOString()).toBe(parsed.time);
    });

    it("each line ends with a newline", () => {
      const logger = new Logger({}, "debug");
      logger.info("line1");
      logger.warn("line2");

      for (const call of stdoutSpy.mock.calls) {
        expect((call[0] as string).endsWith("\n")).toBe(true);
      }
    });
  });

  describe("context inheritance", () => {
    it("includes context in log output", () => {
      const logger = new Logger({ service: "api" }, "info");
      logger.info("started");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.service).toBe("api");
    });

    it("child() merges parent context with new context", () => {
      const parent = new Logger({ service: "api" }, "info");
      const child = parent.child({ requestId: "abc123" });
      child.info("handling request");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.service).toBe("api");
      expect(parsed.requestId).toBe("abc123");
    });

    it("child context overrides parent context for same keys", () => {
      const parent = new Logger({ component: "old" }, "info");
      const child = parent.child({ component: "new" });
      child.info("test");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.component).toBe("new");
    });
  });

  describe("extra context in log methods", () => {
    it("merges extra context into output", () => {
      const logger = new Logger({ service: "worker" }, "info");
      logger.info("processing", { appSlug: "formful", duration: 150 });

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.service).toBe("worker");
      expect(parsed.appSlug).toBe("formful");
      expect(parsed.duration).toBe(150);
    });
  });

  describe("output streams", () => {
    it("error goes to stderr", () => {
      const logger = new Logger({}, "info");
      logger.error("something broke");
      expect(stderrSpy).toHaveBeenCalledOnce();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it("debug, info, warn go to stdout", () => {
      const logger = new Logger({}, "debug");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      expect(stdoutSpy).toHaveBeenCalledTimes(3);
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("createLogger()", () => {
    it("creates a logger with module field", () => {
      const logger = createLogger("scraper");
      logger.info("test");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.module).toBe("scraper");
    });

    it("accepts extra context alongside module", () => {
      const logger = createLogger("scraper", { platform: "shopify" });
      logger.info("test");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.module).toBe("scraper");
      expect(parsed.platform).toBe("shopify");
    });
  });
});
