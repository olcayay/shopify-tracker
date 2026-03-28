import { describe, it, expect } from "vitest";
import {
  JOB_DEFAULT_ATTEMPTS,
  JOB_BACKOFF_DELAY_MS,
  JOB_REMOVE_ON_COMPLETE_COUNT,
  JOB_REMOVE_ON_FAIL_COUNT,
  QUEUE_CLEAN_FAILED_LIMIT,
  BACKGROUND_WORKER_CONCURRENCY,
  PLATFORM_LOCK_TTL_MS,
  PLATFORM_LOCK_TIMEOUT_MS,
  LOCK_POLL_INTERVAL_MS,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  HTTP_DEFAULT_DELAY_MS,
  HTTP_DEFAULT_MAX_RETRIES,
  HTTP_DEFAULT_MAX_CONCURRENCY,
  HTTP_MAX_RESPONSE_SIZE,
  HTTP_CONCURRENCY_POLL_MS,
  HTTP_RATE_LIMIT_BASE_MS,
  HTTP_RAW_RATE_LIMIT_BASE_MS,
  JOB_TIMEOUT_CATEGORY_MS,
  JOB_TIMEOUT_KEYWORD_SEARCH_MS,
  JOB_TIMEOUT_REVIEWS_MS,
  JOB_TIMEOUT_APP_DETAILS_MS,
  JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS,
  JOB_TIMEOUT_COMPUTE_MS,
  JOB_TIMEOUT_DAILY_DIGEST_MS,
  JOB_TIMEOUT_DEFAULT_MS,
  DB_BATCH_CHUNK_SIZE,
  QUEUE_INSPECT_WAITING_LIMIT,
  QUEUE_INSPECT_OTHER_LIMIT,
} from "../constants.js";

describe("scraper constants", () => {
  describe("queue job defaults", () => {
    it("has correct job retry and cleanup values", () => {
      expect(JOB_DEFAULT_ATTEMPTS).toBe(2);
      expect(JOB_BACKOFF_DELAY_MS).toBe(30_000);
      expect(JOB_REMOVE_ON_COMPLETE_COUNT).toBe(100);
      expect(JOB_REMOVE_ON_FAIL_COUNT).toBe(50);
      expect(QUEUE_CLEAN_FAILED_LIMIT).toBe(1000);
    });
  });

  describe("worker concurrency and locking", () => {
    it("has correct lock and concurrency values", () => {
      expect(BACKGROUND_WORKER_CONCURRENCY).toBe(11);
      expect(PLATFORM_LOCK_TTL_MS).toBe(300_000);
      expect(PLATFORM_LOCK_TIMEOUT_MS).toBe(300_000);
      expect(LOCK_POLL_INTERVAL_MS).toBe(500);
      expect(GRACEFUL_SHUTDOWN_TIMEOUT_MS).toBe(60_000);
    });
  });

  describe("HTTP client defaults", () => {
    it("has correct HTTP defaults", () => {
      expect(HTTP_DEFAULT_DELAY_MS).toBe(2000);
      expect(HTTP_DEFAULT_MAX_RETRIES).toBe(4);
      expect(HTTP_DEFAULT_MAX_CONCURRENCY).toBe(2);
      expect(HTTP_MAX_RESPONSE_SIZE).toBe(20 * 1024 * 1024);
      expect(HTTP_CONCURRENCY_POLL_MS).toBe(100);
    });

    it("has correct rate limit backoff values", () => {
      expect(HTTP_RATE_LIMIT_BASE_MS).toBe(4_000);
      expect(HTTP_RAW_RATE_LIMIT_BASE_MS).toBe(15_000);
    });
  });

  describe("job timeouts", () => {
    it("has correct timeout values in minutes", () => {
      expect(JOB_TIMEOUT_CATEGORY_MS).toBe(45 * 60 * 1000);
      expect(JOB_TIMEOUT_KEYWORD_SEARCH_MS).toBe(45 * 60 * 1000);
      expect(JOB_TIMEOUT_REVIEWS_MS).toBe(45 * 60 * 1000);
      expect(JOB_TIMEOUT_APP_DETAILS_MS).toBe(30 * 60 * 1000);
      expect(JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS).toBe(20 * 60 * 1000);
      expect(JOB_TIMEOUT_COMPUTE_MS).toBe(15 * 60 * 1000);
      expect(JOB_TIMEOUT_DAILY_DIGEST_MS).toBe(10 * 60 * 1000);
      expect(JOB_TIMEOUT_DEFAULT_MS).toBe(30 * 60 * 1000);
    });

    it("has timeouts ordered from longest to shortest", () => {
      expect(JOB_TIMEOUT_CATEGORY_MS).toBeGreaterThan(JOB_TIMEOUT_APP_DETAILS_MS);
      expect(JOB_TIMEOUT_APP_DETAILS_MS).toBeGreaterThan(JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS);
      expect(JOB_TIMEOUT_KEYWORD_SUGGESTIONS_MS).toBeGreaterThan(JOB_TIMEOUT_COMPUTE_MS);
      expect(JOB_TIMEOUT_COMPUTE_MS).toBeGreaterThan(JOB_TIMEOUT_DAILY_DIGEST_MS);
    });
  });

  describe("batch sizes and inspection limits", () => {
    it("has correct batch and inspection values", () => {
      expect(DB_BATCH_CHUNK_SIZE).toBe(100);
      expect(QUEUE_INSPECT_WAITING_LIMIT).toBe(50);
      expect(QUEUE_INSPECT_OTHER_LIMIT).toBe(10);
    });
  });
});
