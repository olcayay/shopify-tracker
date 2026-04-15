import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "../../utils/with-timeout.js";

describe("withTimeout", () => {
  it("resolves with the promise value when it settles before the deadline", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 100);
    expect(result).toBe("ok");
  });

  it("rejects with TimeoutError when the promise does not settle in time", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 100));
    await expect(withTimeout(slow, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("uses the custom error factory", async () => {
    class CustomError extends Error {
      constructor() {
        super("custom");
        this.name = "CustomError";
      }
    }
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 100));
    await expect(
      withTimeout(slow, 20, () => new CustomError())
    ).rejects.toBeInstanceOf(CustomError);
  });

  it("propagates the underlying rejection when it settles before the deadline", async () => {
    const fail = Promise.reject(new Error("boom"));
    await expect(withTimeout(fail, 100)).rejects.toThrow("boom");
  });

  it("clears the timer on resolution so no pending work is left", async () => {
    // If the timer were not cleared we'd log unhandled rejection after the test
    // finishes; vitest catches unhandled rejections and fails the suite.
    const quick = new Promise((resolve) => setTimeout(() => resolve("quick"), 5));
    const result = await withTimeout(quick, 500);
    expect(result).toBe("quick");
    // Give any stray timer a chance to fire — should not happen
    await new Promise((resolve) => setTimeout(resolve, 550));
  });
});
