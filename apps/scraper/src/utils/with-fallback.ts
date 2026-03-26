import type { FallbackTracker } from "./fallback-tracker.js";

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
      console.warn(
        `[withFallback] ${context}: primary failed (${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}), trying fallback…`,
      );
      try {
        const result = await fallback();
        tracker?.recordFallback(context);
        return result;
      } catch (fallbackErr) {
        console.warn(
          `[withFallback] ${context}: fallback also failed (${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)})`,
        );
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
