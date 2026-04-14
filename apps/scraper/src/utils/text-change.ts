/**
 * Shared helpers for deciding whether a scraped text field changed "meaningfully"
 * — i.e. whether it should be emitted as a row in `app_field_changes` or skipped
 * as a scrape-shape artifact.
 *
 * Single chokepoint so future noise guards (case, whitespace, etc.) stay in one
 * place and can't silently diverge between callsites.
 */

/**
 * Returns true when `oldVal` and `newVal` differ only in letter case
 * (e.g. "Jotform" vs "JotForm"). Used to suppress false-positive change
 * rows on fields like `name` and `seoTitle` where Canva/Salesforce source HTML
 * re-cases the same brand across renders.
 *
 * Treats null/undefined as non-matching (empty→content is a real change, see
 * the first-time-population guards in the caller).
 */
export function isCaseOnlyDiff(
  oldVal: string | null | undefined,
  newVal: string | null | undefined,
): boolean {
  if (!oldVal || !newVal) return false;
  if (oldVal === newVal) return false;
  return oldVal.toLowerCase() === newVal.toLowerCase();
}
