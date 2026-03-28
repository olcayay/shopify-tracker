import type { FallbackTracker } from "./fallback-tracker.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("with-fallback");

/**
 * Try `primary`, and if it throws, log a warning and try `fallback`.
 * If both fail, the **primary** error is re-thrown (most useful for debugging).
 *
 * Set `FORCE_FALLBACK=true` to skip the primary and exercise the fallback path.
 *
 * If a `tracker` is provided, it records every successful fallback invocation
 * so the caller can later persist which contexts used fallback scraping.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string,
  tracker?: FallbackTracker,
): Promise<T> {
  const forceFallback = process.env.FORCE_FALLBACK === "true";

  if (!forceFallback) {
    try {
      return await primary();
    } catch (primaryErr) {
      log.warn(`${context}: primary failed, trying fallback`, {
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
      try {
        const result = await fallback();
        tracker?.recordFallback(context);
        return result;
      } catch (fallbackErr) {
        log.warn(`${context}: fallback also failed`, {
          error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        });
        throw primaryErr;
      }
    }
  }

  // Force-fallback mode: skip primary entirely
  try {
    const result = await fallback();
    tracker?.recordFallback(context);
    return result;
  } catch (fallbackErr) {
    throw new Error(
      `[withFallback] ${context}: fallback failed in force-fallback mode: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
    );
  }
}
