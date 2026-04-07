import { describe, it, expect } from "vitest";
import { isTransientDbError } from "../middleware/db-retry.js";

describe("isTransientDbError", () => {
  it("detects ECONNREFUSED", () => {
    const err = new Error("connect ECONNREFUSED 10.218.0.3:5432");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects ECONNRESET", () => {
    const err = new Error("read ECONNRESET");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects connection terminated unexpectedly", () => {
    const err = new Error("connection terminated unexpectedly");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects admin shutdown PG code", () => {
    const err = Object.assign(new Error("server closed"), { code: "57P01" });
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects cannot_connect_now PG code", () => {
    const err = Object.assign(new Error("cannot connect"), { code: "57P03" });
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects connection_failure PG code", () => {
    const err = Object.assign(new Error("connection failure"), { code: "08006" });
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects too many clients", () => {
    const err = new Error("too many clients already");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects connection timed out", () => {
    const err = new Error("connection timed out");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("detects terminating connection due to administrator command", () => {
    const err = new Error("terminating connection due to administrator command");
    expect(isTransientDbError(err)).toBe(true);
  });

  it("does NOT match regular application errors", () => {
    expect(isTransientDbError(new Error("Not found"))).toBe(false);
    expect(isTransientDbError(new Error("Validation failed"))).toBe(false);
    expect(isTransientDbError(new Error("Unauthorized"))).toBe(false);
  });

  it("does NOT match non-transient PG codes", () => {
    const err = Object.assign(new Error("syntax error"), { code: "42601" });
    expect(isTransientDbError(err)).toBe(false);
  });

  it("does NOT match unique violation", () => {
    const err = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(isTransientDbError(err)).toBe(false);
  });

  it("handles error with no message", () => {
    const err = new Error();
    expect(isTransientDbError(err)).toBe(false);
  });

  it("handles error with no code", () => {
    const err = new Error("some random error");
    expect(isTransientDbError(err)).toBe(false);
  });
});
