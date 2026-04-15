import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnhandledRejectionLogger } from "@/components/unhandled-rejection-logger";

function makeEvent(reason: unknown): PromiseRejectionEvent {
  const ev = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(ev, "reason", { value: reason, configurable: true });
  Object.defineProperty(ev, "promise", { value: Promise.resolve(), configurable: true });
  return ev;
}

describe("UnhandledRejectionLogger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("suppresses browser-extension errors (chrome-extension://) by preventing default", () => {
    render(<UnhandledRejectionLogger />);
    const err = new TypeError("Cannot read properties of undefined (reading 'payload')");
    err.stack =
      "TypeError: Cannot read properties of undefined (reading 'payload')\n" +
      "    at Tx (chrome-extension://abcdefghij/core.js:297:66041)";
    const ev = makeEvent(err);
    const preventSpy = vi.spyOn(ev, "preventDefault");
    window.dispatchEvent(ev);
    expect(preventSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("suppresses moz-extension and safari-web-extension origins", () => {
    render(<UnhandledRejectionLogger />);
    for (const prefix of ["moz-extension://", "safari-web-extension://", "safari-extension://"]) {
      const err = new Error("x");
      err.stack = `Error\n    at f (${prefix}uuid/core.js:1:1)`;
      const ev = makeEvent(err);
      const preventSpy = vi.spyOn(ev, "preventDefault");
      window.dispatchEvent(ev);
      expect(preventSpy).toHaveBeenCalled();
    }
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("logs app-origin rejections (not from an extension)", () => {
    render(<UnhandledRejectionLogger />);
    const err = new Error("app bug");
    err.stack = "Error: app bug\n    at f (https://appranks.io/_next/static/chunks/abc.js:1:1)";
    window.dispatchEvent(makeEvent(err));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("logs non-Error rejections (string / plain object) without crashing", () => {
    render(<UnhandledRejectionLogger />);
    window.dispatchEvent(makeEvent("oops"));
    window.dispatchEvent(makeEvent({ code: 42 }));
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  });
});
