import { describe, it, expect } from "vitest";
import { AppNotFoundError } from "../app-not-found-error.js";

describe("AppNotFoundError", () => {
  it("creates error with slug and platform", () => {
    const err = new AppNotFoundError("test-app", "zoom");
    expect(err.name).toBe("AppNotFoundError");
    expect(err.slug).toBe("test-app");
    expect(err.platform).toBe("zoom");
    expect(err.message).toBe("App not found on zoom marketplace: test-app");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppNotFoundError).toBe(true);
  });

  it("includes detail in message when provided", () => {
    const err = new AppNotFoundError("test-app", "zoom", "exhausted filter API pagination");
    expect(err.message).toBe(
      "App not found on zoom marketplace: test-app (exhausted filter API pagination)"
    );
  });

  it("is distinguishable from generic Error via instanceof", () => {
    const appErr = new AppNotFoundError("slug", "zoom");
    const genericErr = new Error("some other error");

    expect(appErr instanceof AppNotFoundError).toBe(true);
    expect(genericErr instanceof AppNotFoundError).toBe(false);
  });
});
