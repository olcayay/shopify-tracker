import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPushSupported,
  getPermissionStatus,
} from "../../lib/push-notifications";

describe("isPushSupported", () => {
  it("returns false when window is undefined (SSR)", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — testing SSR
    delete globalThis.window;
    expect(isPushSupported()).toBe(false);
    globalThis.window = origWindow;
  });

  it("returns false when serviceWorker is not available", () => {
    const origSW = navigator.serviceWorker;
    // @ts-expect-error — testing browser support
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
    expect(isPushSupported()).toBe(false);
    Object.defineProperty(navigator, "serviceWorker", { value: origSW, configurable: true });
  });
});

describe("getPermissionStatus", () => {
  it("returns 'unsupported' when push is not supported", () => {
    const origSW = navigator.serviceWorker;
    // @ts-expect-error — testing
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
    expect(getPermissionStatus()).toBe("unsupported");
    Object.defineProperty(navigator, "serviceWorker", { value: origSW, configurable: true });
  });
});
