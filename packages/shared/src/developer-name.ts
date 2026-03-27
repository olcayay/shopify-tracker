/**
 * Developer name normalization utilities for cross-platform matching.
 *
 * Strips corporate suffixes, normalizes whitespace/special chars, and
 * produces URL-friendly slugs so that "Jotform Inc", "Jotform A.Ş.",
 * and "jotform" all resolve to the same global developer.
 */

const CORPORATE_SUFFIXES = [
  // English
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "group",
  "holdings",
  "enterprises",
  "partners",
  "plc",
  "lp",
  // German
  "gmbh",
  "ag",
  "kg",
  "ohg",
  "ug",
  "e.v",
  "ev",
  // French
  "sarl",
  "sas",
  "sa",
  "eurl",
  // Spanish / Portuguese
  "sl",
  "srl",
  "ltda",
  // Turkish
  "a.ş",
  "aş",
  "a.s",
  // Dutch
  "bv",
  "nv",
  // Italian
  "spa",
  // Scandinavian
  "ab",
  "as",
  "aps",
  // Indian
  "pvt",
  // Japanese
  "kk",
  // Generic
  "pty",
  "pte",
  "oy",
  "ou",
];

// Build a regex that matches any suffix at the end, optionally preceded by punctuation
const suffixPattern = new RegExp(
  `[\\s,.]+(${CORPORATE_SUFFIXES.map((s) => s.replace(/\./g, "\\.")).join("|")})\\.?\\s*$`,
  "i"
);

/**
 * Strip corporate suffixes from a developer name.
 * "Jotform A.Ş." → "Jotform"
 * "Acme Inc" → "Acme"
 */
export function stripCorporateSuffix(name: string): string {
  let result = name.trim();
  // Apply up to 2 times to handle "Foo Ltd Inc" edge cases
  for (let i = 0; i < 2; i++) {
    const stripped = result.replace(suffixPattern, "").trim();
    if (stripped === result || stripped.length === 0) break;
    result = stripped;
  }
  return result;
}

/**
 * Produce a URL-friendly slug from a developer name.
 * "Jotform A.Ş." → "jotform"
 * "Bold Commerce Inc" → "bold-commerce"
 * "PageFly Landing Page Builder" → "pagefly-landing-page-builder"
 */
export function developerNameToSlug(name: string): string {
  const stripped = stripCorporateSuffix(name);
  return (
    stripped
      .toLowerCase()
      // Replace non-alphanumeric (keeping hyphens) with hyphens
      .replace(/[^a-z0-9-]+/g, "-")
      // Collapse multiple hyphens
      .replace(/-+/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-|-$/g, "")
  );
}

/**
 * Normalize a developer name for display purposes.
 * Strips suffixes but preserves original casing and spacing.
 * "Jotform A.Ş." → "Jotform"
 * "Bold Commerce Inc" → "Bold Commerce"
 */
export function normalizeDeveloperName(name: string): string {
  return stripCorporateSuffix(name).trim();
}
