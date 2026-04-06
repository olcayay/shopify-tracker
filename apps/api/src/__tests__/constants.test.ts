import { describe, it, expect } from "vitest";
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  PAGINATION_MAX_LIMIT_SMALL,
  PAGINATION_MAX_LIMIT_AI_LOGS,
  PAGINATION_DEFAULT_DEVELOPER_APPS,
  PAGINATION_MAX_DEVELOPER_APPS,
  LIVE_SEARCH_LIMIT,
  RATE_LIMIT_AUTHENTICATED_MAX,
  RATE_LIMIT_AUTHENTICATED_WINDOW_MS,
  RATE_LIMIT_UNAUTHENTICATED_MAX,
  RATE_LIMIT_UNAUTHENTICATED_WINDOW_MS,
  RATE_LIMIT_SYSTEM_ADMIN_MAX,
  RATE_LIMIT_SYSTEM_ADMIN_WINDOW_MS,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_LOGIN_WINDOW_MS,
  RATE_LIMIT_REGISTER_MAX,
  RATE_LIMIT_REGISTER_WINDOW_MS,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  DEFAULT_MAX_TRACKED_APPS,
  DEFAULT_MAX_TRACKED_KEYWORDS,
  DEFAULT_MAX_COMPETITOR_APPS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_OPERATION_TIMEOUT_MS,
} from "../constants.js";

describe("API constants", () => {
  describe("pagination", () => {
    it("has correct default and max limits", () => {
      expect(PAGINATION_DEFAULT_LIMIT).toBe(50);
      expect(PAGINATION_MAX_LIMIT).toBe(200);
      expect(PAGINATION_MAX_LIMIT_SMALL).toBe(100);
      expect(PAGINATION_MAX_LIMIT_AI_LOGS).toBe(250);
      expect(PAGINATION_DEFAULT_DEVELOPER_APPS).toBe(20);
      expect(PAGINATION_MAX_DEVELOPER_APPS).toBe(50);
      expect(LIVE_SEARCH_LIMIT).toBe(50);
    });

    it("default limit is less than max limit", () => {
      expect(PAGINATION_DEFAULT_LIMIT).toBeLessThanOrEqual(PAGINATION_MAX_LIMIT);
      expect(PAGINATION_DEFAULT_LIMIT).toBeLessThanOrEqual(PAGINATION_MAX_LIMIT_SMALL);
    });
  });

  describe("rate limiting", () => {
    it("has correct rate limit values", () => {
      expect(RATE_LIMIT_AUTHENTICATED_MAX).toBe(200);
      expect(RATE_LIMIT_AUTHENTICATED_WINDOW_MS).toBe(60_000);
      expect(RATE_LIMIT_UNAUTHENTICATED_MAX).toBe(30);
      expect(RATE_LIMIT_UNAUTHENTICATED_WINDOW_MS).toBe(60_000);
      expect(RATE_LIMIT_SYSTEM_ADMIN_MAX).toBe(20);
      expect(RATE_LIMIT_SYSTEM_ADMIN_WINDOW_MS).toBe(60_000);
    });

    it("has correct auth rate limit values", () => {
      expect(RATE_LIMIT_LOGIN_MAX).toBe(5);
      expect(RATE_LIMIT_LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMIT_REGISTER_MAX).toBe(3);
      expect(RATE_LIMIT_REGISTER_WINDOW_MS).toBe(60 * 60 * 1000);
    });

    it("has cleanup interval shorter than any rate limit window", () => {
      expect(RATE_LIMIT_CLEANUP_INTERVAL_MS).toBeLessThan(RATE_LIMIT_LOGIN_WINDOW_MS);
      expect(RATE_LIMIT_CLEANUP_INTERVAL_MS).toBeLessThan(RATE_LIMIT_REGISTER_WINDOW_MS);
    });

    it("unauthenticated limit is stricter than authenticated", () => {
      expect(RATE_LIMIT_UNAUTHENTICATED_MAX).toBeLessThan(RATE_LIMIT_AUTHENTICATED_MAX);
    });
  });

  describe("auth", () => {
    it("has correct JWT expiry values", () => {
      expect(ACCESS_TOKEN_EXPIRY).toBe("15m");
      expect(REFRESH_TOKEN_EXPIRY_DAYS).toBe(7);
    });
  });

  describe("default account limits", () => {
    it("has correct default account limits", () => {
      expect(DEFAULT_MAX_TRACKED_APPS).toBe(100);
      expect(DEFAULT_MAX_TRACKED_KEYWORDS).toBe(100);
      expect(DEFAULT_MAX_COMPETITOR_APPS).toBe(50);
    });
  });

  describe("redis", () => {
    it("has correct Redis connect timeout", () => {
      expect(REDIS_CONNECT_TIMEOUT_MS).toBe(5000);
    });

    it("has correct Redis operation timeout", () => {
      expect(REDIS_OPERATION_TIMEOUT_MS).toBe(2000);
    });

    it("operation timeout is shorter than connect timeout", () => {
      expect(REDIS_OPERATION_TIMEOUT_MS).toBeLessThan(REDIS_CONNECT_TIMEOUT_MS);
    });
  });
});
