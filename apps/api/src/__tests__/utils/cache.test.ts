import { describe, it, expect, beforeEach, vi } from "vitest";
import { cacheGet, cacheDel, cacheInvalidate, _resetCacheRedis } from "../../utils/cache.js";

// Create a mock Redis client
function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return count;
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace("*", "");
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    _store: store,
  };
}

describe("Cache utility", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    _resetCacheRedis(mockRedis as any);
  });

  describe("cacheGet", () => {
    it("calls fetcher on cache miss and stores result", async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
      const result = await cacheGet("test:key", fetcher, 300);

      expect(result).toEqual({ data: "fresh" });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(mockRedis.set).toHaveBeenCalledWith("cache:test:key", '{"data":"fresh"}', "EX", 300);
    });

    it("returns cached result on cache hit without calling fetcher", async () => {
      mockRedis._store.set("cache:test:key", '{"data":"cached"}');
      const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });

      const result = await cacheGet("test:key", fetcher, 300);

      expect(result).toEqual({ data: "cached" });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("falls through to fetcher when Redis read fails", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis down"));
      const fetcher = vi.fn().mockResolvedValue({ data: "fallback" });

      const result = await cacheGet("test:key", fetcher, 300);

      expect(result).toEqual({ data: "fallback" });
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it("returns fetcher result even when Redis write fails", async () => {
      mockRedis.set.mockRejectedValueOnce(new Error("Redis down"));
      const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });

      const result = await cacheGet("test:key", fetcher, 300);

      expect(result).toEqual({ data: "fresh" });
    });
  });

  describe("cacheDel", () => {
    it("deletes a single cache key", async () => {
      mockRedis._store.set("cache:test:key", "value");
      await cacheDel("test:key");
      expect(mockRedis.del).toHaveBeenCalledWith("cache:test:key");
    });
  });

  describe("cacheInvalidate", () => {
    it("deletes all keys matching pattern", async () => {
      mockRedis._store.set("cache:features:tree:shopify", "v1");
      mockRedis._store.set("cache:features:tree:salesforce", "v2");
      mockRedis._store.set("cache:other:key", "v3");

      const deleted = await cacheInvalidate("features:tree:*");

      expect(deleted).toBe(2);
    });

    it("returns 0 when no keys match", async () => {
      const deleted = await cacheInvalidate("nonexistent:*");
      expect(deleted).toBe(0);
    });
  });

  describe("disabled Redis", () => {
    it("always calls fetcher when Redis is disabled", async () => {
      _resetCacheRedis(null);
      const fetcher = vi.fn().mockResolvedValue({ data: "direct" });

      const result = await cacheGet("test:key", fetcher, 300);

      expect(result).toEqual({ data: "direct" });
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });
});
