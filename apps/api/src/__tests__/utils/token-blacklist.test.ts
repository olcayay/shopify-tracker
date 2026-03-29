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

  // -----------------------------------------------------------------------
  // Additional edge-case tests
  // -----------------------------------------------------------------------

  describe("TTL edge cases", () => {
    it("sets TTL to at least 1 second even for already-expired tokens", async () => {
      const mock = createMockRedis();
      _resetBlacklistRedis(mock);
      const alreadyExpired = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
      await blacklistToken("expired-jti", alreadyExpired);
      // TTL should be clamped to at least 1
      const setCall = mock.set.mock.calls[0];
      expect(setCall[3]).toBe(1); // TTL argument
    });

    it("sets correct TTL for tokens expiring far in the future", async () => {
      const mock = createMockRedis();
      _resetBlacklistRedis(mock);
      const farFuture = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      await blacklistToken("future-jti", farFuture);
      const ttl = mock.set.mock.calls[0][3];
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe("multiple tokens and users", () => {
    it("independently tracks multiple blacklisted tokens", async () => {
      const now = Math.floor(Date.now() / 1000);
      await blacklistToken("jti-a", now + 900);
      await blacklistToken("jti-b", now + 900);

      expect(await isTokenBlacklisted("jti-a")).toBe(true);
      expect(await isTokenBlacklisted("jti-b")).toBe(true);
      expect(await isTokenBlacklisted("jti-c")).toBe(false);
    });

    it("revocation of one user does not affect another", async () => {
      const now = Math.floor(Date.now() / 1000);
      await revokeAllTokensForUser("user-A");

      // user-A tokens from before revocation are revoked
      expect(await isUserTokenRevoked("user-A", now - 10)).toBe(true);
      // user-B is unaffected
      expect(await isUserTokenRevoked("user-B", now - 10)).toBe(false);
    });

    it("re-revoking a user updates the timestamp", async () => {
      const now = Math.floor(Date.now() / 1000);

      await revokeAllTokensForUser("user-re");
      // Token issued 1 second after first revocation is NOT revoked
      expect(await isUserTokenRevoked("user-re", now + 1)).toBe(false);

      // Simulate time passing and re-revoking (iat check uses the stored timestamp)
      // After second revocation, the stored timestamp is now >= now+1
      // We mock this by calling revoke again (timestamp updates to current time)
      await revokeAllTokensForUser("user-re");
      // Token issued before second revocation should be revoked
      expect(await isUserTokenRevoked("user-re", now - 1)).toBe(true);
    });
  });

  describe("Redis error handling", () => {
    it("isTokenBlacklisted returns false when Redis.get throws", async () => {
      const errorRedis = createMockRedis();
      errorRedis.get = vi.fn().mockRejectedValue(new Error("Connection refused"));
      _resetBlacklistRedis(errorRedis);

      expect(await isTokenBlacklisted("any-jti")).toBe(false);
    });

    it("blacklistToken does not throw when Redis.set throws", async () => {
      const errorRedis = createMockRedis();
      errorRedis.set = vi.fn().mockRejectedValue(new Error("Connection refused"));
      _resetBlacklistRedis(errorRedis);

      // Should not throw
      await expect(blacklistToken("jti", Math.floor(Date.now() / 1000) + 900)).resolves.toBeUndefined();
    });

    it("isUserTokenRevoked returns false when Redis.get throws", async () => {
      const errorRedis = createMockRedis();
      errorRedis.get = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
      _resetBlacklistRedis(errorRedis);

      expect(await isUserTokenRevoked("user", 0)).toBe(false);
    });

    it("revokeAllTokensForUser does not throw when Redis.set throws", async () => {
      const errorRedis = createMockRedis();
      errorRedis.set = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
      _resetBlacklistRedis(errorRedis);

      await expect(revokeAllTokensForUser("user")).resolves.toBeUndefined();
    });
  });
});
