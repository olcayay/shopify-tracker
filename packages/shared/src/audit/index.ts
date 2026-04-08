/**
 * Main audit engine — orchestrates section rules and produces a scored report.
 */

import type {
  AuditReport,
  AuditSection,
  AuditRecommendation,
  AuditAppMeta,
  AuditCheck,
  SectionWeights,
} from "./types.js";
import { DEFAULT_SECTION_WEIGHTS } from "./types.js";

export type { SectionWeights } from "./types.js";
export {
  DEFAULT_SECTION_WEIGHTS,
  type AuditReport,
  type AuditSection,
  type AuditCheck,
  type AuditRecommendation,
  type AuditAppMeta,
  type AuditStatus,
  type AuditImpact,
} from "./types.js";

// Rule modules — will be imported as they are implemented
import { computeTitleSection } from "./rules/title.js";
import { computeContentSection } from "./rules/content.js";
import { computeVisualsSection } from "./rules/visuals.js";
import { computeCategoriesSection } from "./rules/categories.js";
import { computeTechnicalSection } from "./rules/technical.js";
import { computeLanguagesSection } from "./rules/languages.js";

/**
 * Compute section score from checks.
 * Pass=100, Warning=50, Fail=0, averaged across all checks.
 */
export function computeSectionScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0;
  const total = checks.reduce((sum, check) => {
    if (check.status === "pass") return sum + 100;
    if (check.status === "warning") return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / checks.length);
}

/**
 * Compute weighted overall score from sections.
 */
export function computeOverallScore(
  sections: AuditSection[],
  weights: SectionWeights = DEFAULT_SECTION_WEIGHTS,
): number {
  const weightMap: Record<string, number> = weights as unknown as Record<string, number>;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const section of sections) {
    const w = weightMap[section.id] ?? 0;
    weightedSum += section.score * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Collect recommendations from all sections' failed/warning checks.
 */
export function collectRecommendations(sections: AuditSection[]): AuditRecommendation[] {
  const recs: AuditRecommendation[] = [];

  for (const section of sections) {
    for (const check of section.checks) {
      if (check.status !== "pass" && check.recommendation) {
        recs.push({
          index: recs.length + 1,
          impact: check.impact ?? (check.status === "fail" ? "high" : "medium"),
          section: section.name,
          title: check.label,
          detail: check.recommendation,
        });
      }
    }
  }

  // Sort by impact: high > medium > low
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  // Re-index after sort
  recs.forEach((r, i) => (r.index = i + 1));

  return recs;
}

/**
 * Build app metadata for the audit report.
 */
function buildAppMeta(app: any, platform: string): AuditAppMeta {
  return {
    name: app?.name ?? "",
    slug: app?.slug ?? "",
    platform,
    iconUrl: app?.iconUrl ?? null,
    developer: app?.latestSnapshot?.developer?.name ?? app?.developer?.name ?? undefined,
    averageRating: app?.averageRating ?? null,
    ratingCount: app?.ratingCount ?? null,
    pricingHint: app?.pricingHint ?? null,
  };
}

/**
 * Main entry point: compute a full audit report for an app listing.
 */
export function computeAudit(
  snapshot: any,
  app: any,
  platform: string,
  weights: SectionWeights = DEFAULT_SECTION_WEIGHTS,
): AuditReport {
  const sections: AuditSection[] = [
    computeTitleSection(snapshot, app, platform),
    computeContentSection(snapshot, app, platform),
    computeVisualsSection(snapshot, app, platform),
    computeCategoriesSection(snapshot, app, platform),
    computeTechnicalSection(snapshot, app, platform),
    computeLanguagesSection(snapshot, app, platform),
  ];

  const overallScore = computeOverallScore(sections, weights);
  const recommendations = collectRecommendations(sections);

  return {
    overallScore,
    sections,
    recommendations,
    app: buildAppMeta(app, platform),
    generatedAt: new Date().toISOString(),
  };
}
