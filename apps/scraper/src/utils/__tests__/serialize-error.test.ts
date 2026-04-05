import { describe, it, expect } from "vitest";
import { serializeError, getErrorMessage, getErrorStack } from "../serialize-error.js";

describe("serializeError", () => {
  it("serializes a regular Error", () => {
    const err = new Error("something broke");
    expect(serializeError(err)).toBe("something broke");
  });

  it("serializes a string", () => {
    expect(serializeError("raw string")).toBe("raw string");
  });

  it("serializes null/undefined", () => {
    expect(serializeError(null)).toBe("null");
    expect(serializeError(undefined)).toBe("undefined");
  });

  it("serializes AggregateError with nested errors", () => {
    const nested = [
      new Error("DB connection refused"),
      new Error("Redis timeout"),
    ];
    const agg = new AggregateError(nested, "multiple failures");
    const result = serializeError(agg);

    expect(result).toContain("AggregateError: multiple failures");
    expect(result).toContain("[0] DB connection refused");
    expect(result).toContain("[1] Redis timeout");
  });

  it("serializes AggregateError with non-Error nested values", () => {
    const agg = new AggregateError(["string error", 42], "mixed");
    const result = serializeError(agg);

    expect(result).toContain("AggregateError: mixed");
    expect(result).toContain("[0] string error");
    expect(result).toContain("[1] 42");
  });
});

describe("getErrorMessage", () => {
  it("returns message for regular Error", () => {
    expect(getErrorMessage(new Error("test"))).toBe("test");
  });

  it("returns formatted message for AggregateError", () => {
    const agg = new AggregateError(
      [new Error("err1"), new Error("err2")],
      "aggregate"
    );
    const msg = getErrorMessage(agg);

    expect(msg).toContain("AggregateError: aggregate");
    expect(msg).toContain("err1");
    expect(msg).toContain("err2");
  });

  it("returns string for non-Error values", () => {
    expect(getErrorMessage("oops")).toBe("oops");
    expect(getErrorMessage(123)).toBe("123");
  });
});

describe("getErrorStack", () => {
  it("returns stack for regular Error", () => {
    const err = new Error("test");
    expect(getErrorStack(err)).toContain("Error: test");
    expect(getErrorStack(err)).toContain("serialize-error.test.ts");
  });

  it("returns undefined for non-Error values", () => {
    expect(getErrorStack("string")).toBeUndefined();
    expect(getErrorStack(42)).toBeUndefined();
  });

  it("includes nested stacks for AggregateError", () => {
    const nested = [new Error("inner1"), new Error("inner2")];
    const agg = new AggregateError(nested, "outer");
    const stack = getErrorStack(agg);

    expect(stack).toBeDefined();
    expect(stack).toContain("Nested error [0]");
    expect(stack).toContain("inner1");
    expect(stack).toContain("Nested error [1]");
    expect(stack).toContain("inner2");
  });
});
