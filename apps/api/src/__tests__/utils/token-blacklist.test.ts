import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  blacklistToken,
  isTokenBlacklisted,
  revokeAllTokensForUser,
  isUserTokenRevoked,
  _resetBlacklistRedis,
} from "../../utils/token-blacklist.js";

let store: Map<string, { value: string; ttl?: number }>;

function createMockRedis() {
  store = new Map();
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, { value, ttl: _ttl });
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  } as any;
}

describe("token blacklist", () => {
  beforeEach(() => {
    _resetBlacklistRedis(createMockRedis());
  });

  describe("blacklistToken / isTokenBlacklisted", () => {
    it("blacklists a token by jti", async () => {
      const jti = "test-jti-123";
      const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 min from now

      await blacklistToken(jti, expiresAt);
      expect(await isTokenBlacklisted(jti)).toBe(true);
    });

    it("returns false for non-blacklisted token", async () => {
      expect(await isTokenBlacklisted("unknown-jti")).toBe(false);
    });

    it("sets TTL based on remaining token lifetime", async () => {
      const jti = "ttl-test";
      const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 min from now

      await blacklistToken(jti, expiresAt);

      const setCall = (store as any);
      const entry = store.get("token:blacklist:ttl-test");
      expect(entry).toBeDefined();
      expect(entry!.ttl).toBeLessThanOrEqual(600);
      expect(entry!.ttl).toBeGreaterThan(0);
    });
  });

  describe("revokeAllTokensForUser / isUserTokenRevoked", () => {
    it("revokes all tokens for a user", async () => {
      const userId = "user-123";
      const tokenIssuedAt = Math.floor(Date.now() / 1000) - 60; // 1 min ago

      await revokeAllTokensForUser(userId);
      expect(await isUserTokenRevoked(userId, tokenIssuedAt)).toBe(true);
    });

    it("does not revoke tokens issued after revocation", async () => {
      const userId = "user-456";

      await revokeAllTokensForUser(userId);

      // Token issued 1 second in the future
      const futureIat = Math.floor(Date.now() / 1000) + 1;
      expect(await isUserTokenRevoked(userId, futureIat)).toBe(false);
    });

    it("returns false for users without revocation", async () => {
      expect(await isUserTokenRevoked("no-revoke-user", Math.floor(Date.now() / 1000))).toBe(false);
    });
  });

  describe("Redis unavailable", () => {
    it("blacklistToken is a no-op when Redis is null", async () => {
      _resetBlacklistRedis(null);
      await blacklistToken("jti", Math.floor(Date.now() / 1000) + 900);
      // No error thrown
    });

    it("isTokenBlacklisted returns false when Redis is null", async () => {
      _resetBlacklistRedis(null);
      expect(await isTokenBlacklisted("jti")).toBe(false);
    });

    it("isUserTokenRevoked returns false when Redis is null", async () => {
      _resetBlacklistRedis(null);
      expect(await isUserTokenRevoked("user", 0)).toBe(false);
    });
  });
});
