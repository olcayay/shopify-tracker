/**
 * Safe wrapper around parseFloat that returns null instead of NaN.
 * Use this for parsing scraped data where invalid strings should not
 * produce NaN values in the database.
 */
export function safeParseFloat(
  value: string | null | undefined,
  fallback?: number,
): number | null {
  if (value == null || value === "") return fallback ?? null;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return fallback ?? null;
  return parsed;
}

/**
 * Clamp a rating to the valid 0-5 range.
 * Returns null if the value is outside bounds or not a number.
 */
export function clampRating(value: number | null | undefined): number | null {
  if (value == null || isNaN(value)) return null;
  if (value < 0 || value > 5) return null;
  return value;
}

/**
 * Validate that a count (review count, rating count) is non-negative.
 * Returns null if invalid.
 */
export function clampCount(value: number | null | undefined): number | null {
  if (value == null || isNaN(value)) return null;
  if (value < 0) return null;
  return Math.floor(value);
}

/**
 * Validate that a ranking position is a positive integer.
 * Returns null if invalid.
 */
export function clampPosition(value: number | null | undefined): number | null {
  if (value == null || isNaN(value)) return null;
  if (value < 1) return null;
  return Math.floor(value);
}
