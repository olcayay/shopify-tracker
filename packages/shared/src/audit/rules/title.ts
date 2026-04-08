/**
 * Audit rules — Title Optimization section.
 * Checks: title length, keyword count, brand name position, separator usage.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";
import { getMetadataLimits } from "../../metadata-limits.js";
import { COMMON_STOP_WORDS } from "../../keyword-extraction.js";

/** Extract meaningful keywords from title (exclude stop words) */
function extractTitleKeywords(title: string): string[] {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !COMMON_STOP_WORDS.has(w));
}

/** Check if title starts with a brand/proper noun pattern */
function hasBrandFirst(title: string): boolean {
  if (!title || title.length === 0) return false;
  // Brand-first if first word is capitalized and not a common word
  const firstWord = title.trim().split(/[\s\-|:–—]/)[0];
  if (!firstWord) return false;
  const isCapitalized = firstWord[0] === firstWord[0].toUpperCase() && firstWord[0] !== firstWord[0].toLowerCase();
  const isStopWord = COMMON_STOP_WORDS.has(firstWord.toLowerCase());
  return isCapitalized && !isStopWord;
}

/** Check for separator characters (dash, pipe, colon, em/en dash) */
function hasSeparator(title: string): boolean {
  return /[\-|:–—]/.test(title);
}

export function computeTitleSection(snapshot: any, app: any, platform: string): AuditSection {
  const limits = getMetadataLimits(platform);
  const title = app?.name || snapshot?.name || "";
  const checks: AuditCheck[] = [];

  // 1. Title length
  const titleLen = title.length;
  const maxLen = limits.appName;
  if (titleLen === 0) {
    checks.push({
      id: "title-length",
      label: "Title Length",
      status: "fail",
      detail: "Title is missing",
      recommendation: "Add an app title. It should use most of the available character limit.",
      impact: "high",
    });
  } else if (maxLen > 0 && titleLen < maxLen * 0.5) {
    checks.push({
      id: "title-length",
      label: "Title Length",
      status: "warning",
      detail: `${titleLen}/${maxLen} chars — under 50% of limit`,
      recommendation: `Your title uses only ${titleLen} of ${maxLen} available characters. Add relevant keywords to improve discoverability.`,
      impact: "medium",
    });
  } else if (maxLen > 0 && titleLen > maxLen) {
    checks.push({
      id: "title-length",
      label: "Title Length",
      status: "warning",
      detail: `${titleLen}/${maxLen} chars — over limit`,
      recommendation: `Your title exceeds the ${maxLen} character limit. It may be truncated in search results.`,
      impact: "medium",
    });
  } else {
    checks.push({
      id: "title-length",
      label: "Title Length",
      status: "pass",
      detail: maxLen > 0 ? `${titleLen}/${maxLen} chars` : `${titleLen} chars`,
    });
  }

  // 2. Keyword count
  const keywords = extractTitleKeywords(title);
  if (keywords.length >= 3) {
    checks.push({
      id: "title-keywords",
      label: "Title Keywords",
      status: "pass",
      detail: `${keywords.length} keywords found`,
    });
  } else if (keywords.length === 2) {
    checks.push({
      id: "title-keywords",
      label: "Title Keywords",
      status: "warning",
      detail: `${keywords.length} keywords — could add more`,
      recommendation: "Add at least one more relevant keyword to your title for better search visibility.",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "title-keywords",
      label: "Title Keywords",
      status: "fail",
      detail: keywords.length === 0 ? "No keywords found" : "Only 1 keyword found",
      recommendation: "Include at least 3 descriptive keywords in your title (e.g., what the app does, core feature).",
      impact: "high",
    });
  }

  // 3. Brand name position
  if (titleLen === 0) {
    checks.push({
      id: "title-brand",
      label: "Brand Name Position",
      status: "fail",
      detail: "No title to analyze",
      recommendation: "Start your title with your brand or app name for recognition.",
      impact: "low",
    });
  } else if (hasBrandFirst(title)) {
    checks.push({
      id: "title-brand",
      label: "Brand Name Position",
      status: "pass",
      detail: "Title starts with a brand name",
    });
  } else {
    checks.push({
      id: "title-brand",
      label: "Brand Name Position",
      status: "warning",
      detail: "Title doesn't start with a clear brand name",
      recommendation: "Consider starting your title with your brand name for better recognition.",
      impact: "low",
    });
  }

  // 4. Separator usage
  if (titleLen === 0) {
    checks.push({
      id: "title-separator",
      label: "Separator Usage",
      status: "fail",
      detail: "No title to analyze",
    });
  } else if (hasSeparator(title)) {
    checks.push({
      id: "title-separator",
      label: "Separator Usage",
      status: "pass",
      detail: "Uses separator to structure title",
    });
  } else if (keywords.length >= 2) {
    // Only warn if there are multiple keywords that could benefit from a separator
    checks.push({
      id: "title-separator",
      label: "Separator Usage",
      status: "warning",
      detail: "No separator found",
      recommendation: "Consider using a dash or pipe (|) to separate brand name from keywords.",
      impact: "low",
    });
  } else {
    checks.push({
      id: "title-separator",
      label: "Separator Usage",
      status: "pass",
      detail: "Short title — separator not needed",
    });
  }

  return {
    id: "title",
    name: "Title Optimization",
    icon: "Type",
    score: computeSectionScore(checks),
    checks,
  };
}
