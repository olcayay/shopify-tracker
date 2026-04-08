/**
 * Audit rules — Visual Assets section.
 * Checks: app icon, screenshot count, hero media (video), screenshot variety.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";

export function computeVisualsSection(snapshot: any, app: any, _platform: string): AuditSection {
  const checks: AuditCheck[] = [];

  // 1. App icon
  const iconUrl = app?.iconUrl || snapshot?.iconUrl || "";
  if (iconUrl) {
    checks.push({
      id: "visuals-icon",
      label: "App Icon",
      status: "pass",
      detail: "App icon is set",
    });
  } else {
    checks.push({
      id: "visuals-icon",
      label: "App Icon",
      status: "fail",
      detail: "No app icon",
      recommendation: "Upload an app icon. It's the first visual element users see in search results.",
      impact: "high",
    });
  }

  // 2. Screenshot count
  const screenshots: string[] = snapshot?.screenshots || [];
  if (screenshots.length >= 5) {
    checks.push({
      id: "visuals-screenshots",
      label: "Screenshot Count",
      status: "pass",
      detail: `${screenshots.length} screenshots`,
    });
  } else if (screenshots.length >= 3) {
    checks.push({
      id: "visuals-screenshots",
      label: "Screenshot Count",
      status: "warning",
      detail: `${screenshots.length} screenshots — add more`,
      recommendation: "Add at least 5 screenshots to fully showcase your app's interface and features.",
      impact: "medium",
    });
  } else {
    checks.push({
      id: "visuals-screenshots",
      label: "Screenshot Count",
      status: "fail",
      detail: screenshots.length === 0 ? "No screenshots" : `Only ${screenshots.length} screenshot(s)`,
      recommendation: "Add at least 5 high-quality screenshots showing your app's key features and UI.",
      impact: "high",
    });
  }

  // 3. Hero media (video)
  const hasVideo = screenshots.some(
    (s: string) =>
      s.includes("youtube") ||
      s.includes("vimeo") ||
      s.includes("video") ||
      s.endsWith(".mp4") ||
      s.endsWith(".webm"),
  );
  if (hasVideo) {
    checks.push({
      id: "visuals-video",
      label: "Hero Video",
      status: "pass",
      detail: "Video or media content found",
    });
  } else {
    checks.push({
      id: "visuals-video",
      label: "Hero Video",
      status: "warning",
      detail: "No video content found",
      recommendation: "Add a demo video to increase engagement — listings with videos get higher conversion rates.",
      impact: "medium",
    });
  }

  // 4. Screenshot variety (check for unique URLs)
  if (screenshots.length >= 2) {
    const unique = new Set(screenshots);
    if (unique.size === screenshots.length) {
      checks.push({
        id: "visuals-variety",
        label: "Screenshot Variety",
        status: "pass",
        detail: `${unique.size} unique screenshots`,
      });
    } else {
      checks.push({
        id: "visuals-variety",
        label: "Screenshot Variety",
        status: "warning",
        detail: `${screenshots.length - unique.size} duplicate(s) found`,
        recommendation: "Use unique screenshots for each slot — show different features and views.",
        impact: "low",
      });
    }
  }

  return {
    id: "visuals",
    name: "Visual Assets",
    icon: "Image",
    score: computeSectionScore(checks),
    checks,
  };
}
