import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ioredis before importing RedisLock
const mockSet = vi.fn();
const mockEval = vi.fn();
const mockQuit = vi.fn().mockResolvedValue("OK");

vi.mock("ioredis", () => {
  const MockRedis = vi.fn().mockImplementation(function (this: any) {
    this.set = mockSet;
    this.eval = mockEval;
    this.quit = mockQuit;
  });
  return { default: MockRedis };
});

import { RedisLock } from "../redis-lock.js";

describe("RedisLock", () => {
  let lock: RedisLock;

  beforeEach(() => {
    vi.clearAllMocks();
    lock = new RedisLock({ host: "localhost", port: 6379 });
  });

  describe("acquire", () => {
    it("should return true when SET NX succeeds", async () => {
      mockSet.mockResolvedValue("OK");

      const result = await lock.acquire("platform:shopify");

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        "lock:platform:shopify",
        expect.any(String),
        "PX",
        300_000,
        "NX",
      );
    });

    it("should return false when SET NX fails (lock held by another)", async () => {
      mockSet.mockResolvedValue(null);

      const result = await lock.acquire("platform:shopify");

      expect(result).toBe(false);
    });

    it("should use custom TTL when provided", async () => {
      mockSet.mockResolvedValue("OK");

      await lock.acquire("platform:wix", 60_000);

      expect(mockSet).toHaveBeenCalledWith(
        "lock:platform:wix",
        expect.any(String),
        "PX",
        60_000,
        "NX",
      );
    });
  });

  describe("release", () => {
    it("should call Lua script to atomically release the lock", async () => {
      mockEval.mockResolvedValue(1);

      const result = await lock.release("platform:shopify");

      expect(result).toBe(true);
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get"'),
        1,
        "lock:platform:shopify",
        expect.any(String),
      );
    });

    it("should return false if we no longer own the lock", async () => {
      mockEval.mockResolvedValue(0);

      const result = await lock.release("platform:shopify");

      expect(result).toBe(false);
    });
  });

  describe("extend", () => {
    it("should extend TTL via Lua script when we own the lock", async () => {
      mockEval.mockResolvedValue(1);

      const result = await lock.extend("platform:shopify", 600_000);

      expect(result).toBe(true);
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining("pexpire"),
        1,
        "lock:platform:shopify",
        expect.any(String),
        "600000",
      );
    });

    it("should return false if we do not own the lock", async () => {
      mockEval.mockResolvedValue(0);

      const result = await lock.extend("platform:shopify");

      expect(result).toBe(false);
    });
  });

  describe("acquireWithWait", () => {
    it("should return release function on first try when lock is available", async () => {
      mockSet.mockResolvedValue("OK");
      mockEval.mockResolvedValue(1);

      const release = await lock.acquireWithWait("platform:shopify");

      expect(release).toBeTypeOf("function");

      // Calling release should invoke the Lua-based release
      await release!();
      expect(mockEval).toHaveBeenCalled();
    });

    it("should retry and succeed when lock becomes available", async () => {
      // Fail twice, succeed on third attempt
      mockSet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("OK");

      const release = await lock.acquireWithWait("platform:shopify", 300_000, 10, 5000);

      expect(release).toBeTypeOf("function");
      expect(mockSet).toHaveBeenCalledTimes(3);
    });

    it("should return null when timeout is exceeded", async () => {
      mockSet.mockResolvedValue(null);

      const release = await lock.acquireWithWait("platform:shopify", 300_000, 10, 50);

      expect(release).toBeNull();
    });
  });

  describe("disconnect", () => {
    it("should close the Redis connection", async () => {
      await lock.disconnect();
      expect(mockQuit).toHaveBeenCalled();
    });
  });
});
