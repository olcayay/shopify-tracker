/**
 * Audit rules — Languages section.
 * Checks: language count, English, Spanish, French, German, Portuguese.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";

/** Key languages based on Shopify merchant distribution (~80% coverage) */
const KEY_LANGUAGES: { name: string; patterns: string[] }[] = [
  { name: "English", patterns: ["english", "en", "en-us", "en-gb"] },
  { name: "Spanish", patterns: ["spanish", "es", "es-es", "español"] },
  { name: "French", patterns: ["french", "fr", "fr-fr", "français"] },
  { name: "German", patterns: ["german", "de", "de-de", "deutsch"] },
  { name: "Portuguese", patterns: ["portuguese", "pt", "pt-br", "português"] },
];

function hasLanguage(languages: string[], patterns: string[]): boolean {
  const lowerLangs = languages.map((l) => l.toLowerCase().trim());
  return patterns.some((p) => lowerLangs.some((l) => l === p || l.startsWith(p + "-") || l.startsWith(p + "_")));
}

export function computeLanguagesSection(snapshot: any, _app: any, _platform: string): AuditSection {
  const checks: AuditCheck[] = [];
  const languages: string[] = snapshot?.languages || [];

  // 1. Language count
  if (languages.length >= 5) {
    checks.push({
      id: "lang-count",
      label: "Language Count",
      status: "pass",
      detail: `${languages.length} languages supported`,
    });
  } else if (languages.length >= 2) {
    checks.push({
      id: "lang-count",
      label: "Language Count",
      status: "warning",
      detail: `${languages.length} languages — add more`,
      recommendation: "Support at least 5 languages to reach a wider international audience.",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "lang-count",
      label: "Language Count",
      status: "fail",
      detail: languages.length === 0 ? "No languages listed" : "Only 1 language",
      recommendation: "Add language support information. Multi-language apps reach significantly more merchants.",
      impact: "medium",
    });
  }

  // 2-6. Key languages
  for (const lang of KEY_LANGUAGES) {
    const isFirst = lang.name === "English";
    if (hasLanguage(languages, lang.patterns)) {
      checks.push({
        id: `lang-${lang.name.toLowerCase()}`,
        label: lang.name,
        status: "pass",
        detail: `${lang.name} supported`,
      });
    } else if (languages.length === 0) {
      // Don't add individual language fails if no languages at all — the count check covers it
      continue;
    } else {
      checks.push({
        id: `lang-${lang.name.toLowerCase()}`,
        label: lang.name,
        status: isFirst ? "fail" : "warning",
        detail: `${lang.name} not listed`,
        recommendation: isFirst
          ? "English is the most widely used language — ensure your app supports it."
          : `Adding ${lang.name} support would expand your reach to more merchants.`,
        impact: isFirst ? "high" : "low",
      });
    }
  }

  return {
    id: "languages",
    name: "Languages",
    icon: "Globe",
    score: computeSectionScore(checks),
    checks,
  };
}
