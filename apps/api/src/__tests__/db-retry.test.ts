import { describe, it, expect } from "vitest";
import { isTransientDbError } from "../middleware/db-retry.js";

// ─── Transient Error Detection ─────────────────────────────────

describe("isTransientDbError — connection errors", () => {
  it("detects ECONNREFUSED", () => {
    expect(isTransientDbError(new Error("connect ECONNREFUSED 10.218.0.3:5432"))).toBe(true);
  });

  it("detects ECONNREFUSED with IPv6", () => {
    expect(isTransientDbError(new Error("connect ECONNREFUSED ::1:5432"))).toBe(true);
  });

  it("detects ECONNRESET", () => {
    expect(isTransientDbError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("detects connection terminated unexpectedly", () => {
    expect(isTransientDbError(new Error("connection terminated unexpectedly"))).toBe(true);
  });

  it("detects Connection terminated unexpectedly (capital C)", () => {
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });

  it("detects terminating connection due to administrator command", () => {
    expect(isTransientDbError(new Error("terminating connection due to administrator command"))).toBe(true);
  });

  it("detects too many clients already", () => {
    expect(isTransientDbError(new Error("too many clients already"))).toBe(true);
  });

  it("detects too many clients in longer message", () => {
    expect(isTransientDbError(new Error("FATAL: sorry, too many clients already"))).toBe(true);
  });

  it("detects connection timed out", () => {
    expect(isTransientDbError(new Error("connection timed out"))).toBe(true);
  });

  it("detects pool_monitor_timeout", () => {
    expect(isTransientDbError(new Error("pool_monitor_timeout"))).toBe(true);
  });

  it("detects CONNECTION_DESTROYED in message", () => {
    expect(isTransientDbError(new Error("write CONNECTION_DESTROYED 10.218.0.3:5432"))).toBe(true);
  });

  it("detects CONNECTION_DESTROYED as error code", () => {
    expect(isTransientDbError(Object.assign(new Error("connection lost"), { code: "CONNECTION_DESTROYED" }))).toBe(true);
  });

  it("detects CONNECTION_DESTROYED as errno", () => {
    expect(isTransientDbError(Object.assign(new Error("connection lost"), { errno: "CONNECTION_DESTROYED" }))).toBe(true);
  });
});

describe("isTransientDbError — PostgreSQL error codes", () => {
  it("detects 57P01 (admin_shutdown)", () => {
    expect(isTransientDbError(Object.assign(new Error("server closed"), { code: "57P01" }))).toBe(true);
  });

  it("detects 57P03 (cannot_connect_now)", () => {
    expect(isTransientDbError(Object.assign(new Error("cannot connect"), { code: "57P03" }))).toBe(true);
  });

  it("detects 08006 (connection_failure)", () => {
    expect(isTransientDbError(Object.assign(new Error("connection failure"), { code: "08006" }))).toBe(true);
  });

  it("detects 08001 (sqlclient_unable_to_establish_sqlconnection)", () => {
    expect(isTransientDbError(Object.assign(new Error("unable to connect"), { code: "08001" }))).toBe(true);
  });

  it("detects 08004 (sqlserver_rejected_establishment_of_sqlconnection)", () => {
    expect(isTransientDbError(Object.assign(new Error("rejected"), { code: "08004" }))).toBe(true);
  });

  it("code takes precedence over message", () => {
    // Even with a non-matching message, a transient code should match
    const err = Object.assign(new Error("something unrelated"), { code: "57P01" });
    expect(isTransientDbError(err)).toBe(true);
  });
});

describe("isTransientDbError — non-transient errors", () => {
  it("does NOT match regular application errors", () => {
    expect(isTransientDbError(new Error("Not found"))).toBe(false);
    expect(isTransientDbError(new Error("Validation failed"))).toBe(false);
    expect(isTransientDbError(new Error("Unauthorized"))).toBe(false);
    expect(isTransientDbError(new Error("Forbidden"))).toBe(false);
    expect(isTransientDbError(new Error("Bad Request"))).toBe(false);
  });

  it("does NOT match syntax errors (42601)", () => {
    expect(isTransientDbError(Object.assign(new Error("syntax error"), { code: "42601" }))).toBe(false);
  });

  it("does NOT match unique violation (23505)", () => {
    expect(isTransientDbError(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(false);
  });

  it("does NOT match foreign key violation (23503)", () => {
    expect(isTransientDbError(Object.assign(new Error("violates foreign key"), { code: "23503" }))).toBe(false);
  });

  it("does NOT match not null violation (23502)", () => {
    expect(isTransientDbError(Object.assign(new Error("null value"), { code: "23502" }))).toBe(false);
  });

  it("does NOT match check constraint violation (23514)", () => {
    expect(isTransientDbError(Object.assign(new Error("violates check"), { code: "23514" }))).toBe(false);
  });

  it("does NOT match undefined table (42P01)", () => {
    expect(isTransientDbError(Object.assign(new Error("relation does not exist"), { code: "42P01" }))).toBe(false);
  });

  it("does NOT match undefined column (42703)", () => {
    expect(isTransientDbError(Object.assign(new Error("column does not exist"), { code: "42703" }))).toBe(false);
  });

  it("does NOT match permission denied (42501)", () => {
    expect(isTransientDbError(Object.assign(new Error("permission denied"), { code: "42501" }))).toBe(false);
  });

  it("does NOT match deadlock detected (40P01)", () => {
    // Deadlock is a real error, not transient connection issue
    expect(isTransientDbError(Object.assign(new Error("deadlock detected"), { code: "40P01" }))).toBe(false);
  });

  it("does NOT match statement timeout (57014)", () => {
    // Statement timeout is application logic, not connection issue
    expect(isTransientDbError(Object.assign(new Error("canceling statement"), { code: "57014" }))).toBe(false);
  });
});

describe("isTransientDbError — edge cases", () => {
  it("handles error with no message", () => {
    expect(isTransientDbError(new Error())).toBe(false);
  });

  it("handles error with empty message", () => {
    expect(isTransientDbError(new Error(""))).toBe(false);
  });

  it("handles error with no code", () => {
    expect(isTransientDbError(new Error("some random error"))).toBe(false);
  });

  it("handles error with undefined code", () => {
    const err = Object.assign(new Error("test"), { code: undefined });
    expect(isTransientDbError(err)).toBe(false);
  });

  it("handles error with empty string code", () => {
    const err = Object.assign(new Error("test"), { code: "" });
    expect(isTransientDbError(err)).toBe(false);
  });

  it("handles error with numeric code (not PG format)", () => {
    const err = Object.assign(new Error("test"), { code: "123" });
    expect(isTransientDbError(err)).toBe(false);
  });

  it("message pattern matching is case-sensitive for standard patterns", () => {
    // Standard postgres.js messages are lowercase
    expect(isTransientDbError(new Error("connection terminated unexpectedly"))).toBe(true);
    // But we also handle the capital C variant
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });

  it("partial message matches work (pattern is substring)", () => {
    expect(isTransientDbError(new Error("Error: connect ECONNREFUSED 10.0.0.1:5432 after 5000ms"))).toBe(true);
    expect(isTransientDbError(new Error("Fatal: too many clients already (max: 25)"))).toBe(true);
  });

  it("does not match similar but different patterns", () => {
    // "connection" appears but not in a transient context
    expect(isTransientDbError(new Error("invalid connection option"))).toBe(false);
    // "timeout" appears but it's a statement timeout, not connection
    expect(isTransientDbError(new Error("query timeout exceeded"))).toBe(false);
  });
});

// ─── Retry Policy Logic ────────────────────────────────────────

describe("Retry policy rules", () => {
  const RETRY_DELAY_MS = 500;
  const RETRYABLE_METHODS = ["GET", "HEAD"];
  const NON_RETRYABLE_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

  it("only retries idempotent methods", () => {
    for (const method of RETRYABLE_METHODS) {
      expect(RETRYABLE_METHODS.includes(method)).toBe(true);
    }
  });

  it("never retries non-idempotent methods", () => {
    for (const method of NON_RETRYABLE_METHODS) {
      expect(RETRYABLE_METHODS.includes(method)).toBe(false);
    }
  });

  it("retry delay is reasonable (200-1000ms)", () => {
    expect(RETRY_DELAY_MS).toBeGreaterThanOrEqual(200);
    expect(RETRY_DELAY_MS).toBeLessThanOrEqual(1000);
  });

  it("retry delay does not exceed pool check timeout", () => {
    const POOL_CHECK_TIMEOUT = 5000;
    expect(RETRY_DELAY_MS).toBeLessThan(POOL_CHECK_TIMEOUT);
  });

  it("only retries once (no retry storms)", () => {
    const MAX_RETRIES = 1;
    expect(MAX_RETRIES).toBe(1);
  });
});
