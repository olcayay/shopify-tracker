/**
 * Audit rules — Categories & Discoverability section.
 * Checks: category count, category relevance, feature tags, integrations.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";

export function computeCategoriesSection(snapshot: any, _app: any, _platform: string): AuditSection {
  const checks: AuditCheck[] = [];

  // 1. Category count
  const categories: any[] = snapshot?.categories || [];
  if (categories.length >= 2) {
    checks.push({
      id: "cat-count",
      label: "Category Count",
      status: "pass",
      detail: `${categories.length} categories`,
    });
  } else if (categories.length === 1) {
    checks.push({
      id: "cat-count",
      label: "Category Count",
      status: "warning",
      detail: "Only 1 category",
      recommendation: "Add your app to at least 2 categories to appear in more browse results.",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "cat-count",
      label: "Category Count",
      status: "fail",
      detail: "No categories",
      recommendation: "Assign your app to relevant categories — this is essential for marketplace discoverability.",
      impact: "high",
    });
  }

  // 2. Category relevance (names populated)
  if (categories.length > 0) {
    const named = categories.filter(
      (c: any) => c?.name || c?.title || (typeof c === "string" && c.length > 0),
    );
    if (named.length === categories.length) {
      checks.push({
        id: "cat-relevance",
        label: "Category Names",
        status: "pass",
        detail: "All categories have names",
      });
    } else {
      checks.push({
        id: "cat-relevance",
        label: "Category Names",
        status: "warning",
        detail: `${categories.length - named.length} category(s) missing names`,
        recommendation: "Ensure all categories have proper names set.",
        impact: "low",
      });
    }
  }

  // 3. Feature tags
  const platformData = snapshot?.platformData || {};
  const featureTags: string[] = platformData.features || platformData.tags || platformData.featureTags || [];
  if (featureTags.length >= 5) {
    checks.push({
      id: "cat-features",
      label: "Feature Tags",
      status: "pass",
      detail: `${featureTags.length} feature tags`,
    });
  } else if (featureTags.length > 0) {
    checks.push({
      id: "cat-features",
      label: "Feature Tags",
      status: "warning",
      detail: `${featureTags.length} feature tags — add more`,
      recommendation: "Add at least 5 feature tags to improve filtering and discoverability.",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "cat-features",
      label: "Feature Tags",
      status: "fail",
      detail: "No feature tags",
      recommendation: "Add feature tags that describe your app's capabilities for better search matching.",
      impact: "medium",
    });
  }

  // 4. Integrations
  const integrations: string[] = snapshot?.integrations || [];
  if (integrations.length > 0) {
    checks.push({
      id: "cat-integrations",
      label: "Integrations",
      status: "pass",
      detail: `${integrations.length} integrations listed`,
    });
  } else {
    checks.push({
      id: "cat-integrations",
      label: "Integrations",
      status: "warning",
      detail: "No integrations listed",
      recommendation: "List integrations with other tools/platforms to show compatibility.",
      impact: "low",
    });
  }

  return {
    id: "categories",
    name: "Categories & Discoverability",
    icon: "Tags",
    score: computeSectionScore(checks),
    checks,
  };
}
