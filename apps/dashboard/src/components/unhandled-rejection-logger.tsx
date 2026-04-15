"use client";

import { useEffect } from "react";

const EXTENSION_URL_PATTERNS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
];

function isLikelyExtensionError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const stack = (reason as { stack?: unknown }).stack;
  if (typeof stack !== "string") return false;
  return EXTENSION_URL_PATTERNS.some((p) => stack.includes(p));
}

function describe(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export function UnhandledRejectionLogger() {
  useEffect(() => {
    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      if (isLikelyExtensionError(reason)) {
        ev.preventDefault();
        return;
      }
      const stack =
        reason && typeof reason === "object" && typeof (reason as { stack?: unknown }).stack === "string"
          ? ((reason as { stack: string }).stack)
          : "";
      // eslint-disable-next-line no-console
      console.error(
        "[unhandledrejection]",
        describe(reason),
        stack ? `\n${stack}` : "",
      );
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
