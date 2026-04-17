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

/**
 * Context fields from the current/previous snapshot for classifying a name change.
 */
export interface NameChangeContext {
  /** Previous snapshot's appCardSubtitle / tagline */
  oldSubtitle?: string | null;
  /** Previous snapshot's appIntroduction / short description */
  oldIntroduction?: string | null;
  /** Current snapshot's appCardSubtitle */
  newSubtitle?: string | null;
}

/**
 * Classify a potential `name` field change to detect cross-field contamination.
 *
 * Returns whether the change should be accepted (written to apps.name) and
 * which labels should be auto-assigned to the app_field_changes row.
 *
 * Rules:
 * 1. REJECT: new name equals (case-insensitive) the old subtitle/introduction
 *    → scraper picked up tagline/description instead of the real title.
 * 2. REJECT: new name equals the current subtitle
 *    → same contamination from current scrape data.
 * 3. SOFT-LABEL: new name is ≥50% shorter than old name (and old is ≥ 8 chars)
 *    → suspicious truncation, may be tagline.
 */
export function classifyNameChange(
  oldName: string,
  newName: string,
  context: NameChangeContext = {},
): { accept: boolean; labels: string[] } {
  const newLower = newName.trim().toLowerCase();

  // Rule 1: new name matches old subtitle or introduction → contamination
  if (context.oldSubtitle && newLower === context.oldSubtitle.trim().toLowerCase()) {
    return { accept: false, labels: ["title-subtitle-conflict"] };
  }
  if (context.oldIntroduction && newLower === context.oldIntroduction.trim().toLowerCase()) {
    return { accept: false, labels: ["title-subtitle-conflict"] };
  }

  // Rule 2: new name matches current subtitle → contamination
  if (context.newSubtitle && newLower === context.newSubtitle.trim().toLowerCase()) {
    return { accept: false, labels: ["title-subtitle-conflict"] };
  }

  // Rule 3: dramatic shortening → suspicious (soft label, still accept)
  if (oldName.length >= 8 && newName.length <= oldName.length * 0.5) {
    return { accept: true, labels: ["title-subtitle-conflict"] };
  }

  return { accept: true, labels: [] };
}
