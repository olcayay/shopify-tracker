import type { DigestData, RankingChange, TrackedAppDigest, CategoryRankingChange } from "./digest-builder.js";
import {
  emailLayout,
  header,
  heroStat,
  dataTable,
  insightBlock,
  competitorCard,
  footer,
  summaryBadge,
} from "./components/index.js";
import { colors } from "./design-tokens.js";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

function changeIcon(type: RankingChange["type"] | CategoryRankingChange["type"]): string {
  switch (type) {
    case "improved": return "&#9650;"; // ▲
    case "dropped": return "&#9660;"; // ▼
    case "new_entry": return "&#9733;"; // ★
    case "dropped_out": return "&#10005;"; // ✕
    default: return "";
  }
}

function changeColor(type: RankingChange["type"] | CategoryRankingChange["type"]): string {
  switch (type) {
    case "improved": return "#16a34a";
    case "dropped": return "#dc2626";
    case "new_entry": return "#2563eb";
    case "dropped_out": return "#9ca3af";
    default: return "#6b7280";
  }
}

function posStr(pos: number | null): string {
  return pos !== null ? `#${pos}` : "\u2014";
}

function changeStr(change: number | null, type: RankingChange["type"] | CategoryRankingChange["type"]): string {
  if (type === "new_entry") return "New";
  if (type === "dropped_out") return "Out";
  if (change === null || change === 0) return "\u2014";
  return change > 0 ? `+${change}` : `${change}`;
}

function ratingStr(rating: number | null): string {
  return rating !== null ? rating.toFixed(1) : "\u2014";
}

function deltaStr(delta: number | null, suffix = ""): string {
  if (delta === null || delta === 0) return "";
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? colors.green : colors.red;
  return ` <span style="color:${color};font-weight:600;">(${sign}${suffix === "%" ? delta.toFixed(1) : delta}${suffix})</span>`;
}

/**
 * Determine today's highlight — the single most important event across all tracked apps.
 */
function buildHighlight(data: DigestData): { label: string; value: string; change?: { from: string; to: string; isPositive: boolean } } | null {
  // Collect all keyword changes across tracked apps
  const allTrackedChanges = data.trackedApps.flatMap((a) => a.keywordChanges);
  if (allTrackedChanges.length === 0 && data.trackedApps.every((a) => a.categoryChanges.length === 0)) return null;

  // Priority 1: Category milestone (reached #1)
  for (const app of data.trackedApps) {
    const catMilestone = app.categoryChanges.find((c) => c.todayPosition === 1 && c.type === "improved");
    if (catMilestone) {
      return {
        label: `"${app.appName}" reached #1 in ${catMilestone.categoryName}`,
        value: "#1",
        change: { from: posStr(catMilestone.yesterdayPosition), to: "#1", isPositive: true },
      };
    }
  }

  // Priority 2: Top-3 keyword entry
  const top3Entry = allTrackedChanges.find((r) => r.type === "improved" && r.todayPosition !== null && r.todayPosition <= 3);
  if (top3Entry) {
    return {
      label: `${top3Entry.appName} for "${top3Entry.keyword}"`,
      value: `#${top3Entry.todayPosition}`,
      change: { from: posStr(top3Entry.yesterdayPosition), to: posStr(top3Entry.todayPosition), isPositive: true },
    };
  }

  // Priority 3: Biggest keyword improvement
  const bestWin = allTrackedChanges
    .filter((r) => r.type === "improved" && r.change !== null)
    .sort((a, b) => (b.change || 0) - (a.change || 0))[0];
  if (bestWin) {
    return {
      label: `${bestWin.appName} for "${bestWin.keyword}"`,
      value: `+${bestWin.change}`,
      change: { from: posStr(bestWin.yesterdayPosition), to: posStr(bestWin.todayPosition), isPositive: true },
    };
  }

  // Priority 4: Category improvement
  for (const app of data.trackedApps) {
    const catWin = app.categoryChanges.find((c) => c.type === "improved");
    if (catWin) {
      return {
        label: `"${app.appName}" in ${catWin.categoryName}`,
        value: posStr(catWin.todayPosition),
        change: { from: posStr(catWin.yesterdayPosition), to: posStr(catWin.todayPosition), isPositive: true },
      };
    }
  }

  return {
    label: "Keyword Rankings",
    value: `${allTrackedChanges.length}`,
  };
}

/**
 * Generate a rule-based insight from the digest data.
 */
function generateInsight(data: DigestData): string | null {
  const { competitorSummaries, summary } = data;

  if (summary.improved > summary.dropped * 2 && summary.improved >= 3) {
    return `Strong momentum today with ${summary.improved} keyword improvements. Consider expanding your keyword coverage while things are trending up.`;
  }

  if (summary.dropped > summary.improved * 2 && summary.dropped >= 3) {
    return `${summary.dropped} keywords dropped today. Check if competitors launched new features or promotions that may be pulling traffic.`;
  }

  const competitorGains = competitorSummaries.filter((c) => c.reviewsChange !== null && c.reviewsChange > 5);
  if (competitorGains.length > 0) {
    return `${competitorGains[0].appName} gained ${competitorGains[0].reviewsChange} reviews today. Monitor their review velocity — it may signal a marketing push.`;
  }

  const allTrackedChanges = data.trackedApps.flatMap((a) => a.keywordChanges);
  const newEntries = allTrackedChanges.filter((r) => r.type === "new_entry");
  if (newEntries.length > 0) {
    return `Your app appeared in ${newEntries.length} new keyword ranking${newEntries.length > 1 ? "s" : ""}. These fresh positions are opportunities to optimize and climb higher.`;
  }

  return null;
}

/**
 * Build the overview card for a tracked app (rating, reviews, keywords tracked).
 */
function buildOverviewCard(app: TrackedAppDigest): string {
  const items: string[] = [];

  if (app.ratingToday !== null) {
    items.push(`&#9733; ${ratingStr(app.ratingToday)}${deltaStr(app.ratingChange)}`);
  }
  if (app.reviewCountToday !== null) {
    items.push(`${app.reviewCountToday.toLocaleString()} reviews${deltaStr(app.reviewCountChange)}`);
  }
  const kwCount = app.keywordChanges.length;
  if (kwCount > 0) {
    items.push(`${kwCount} keyword change${kwCount !== 1 ? "s" : ""}`);
  }

  if (items.length === 0) return "";

  const itemsHtml = items
    .map((item) => `<td style="padding:8px 16px;font-size:14px;color:${colors.dark};text-align:center;">${item}</td>`)
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.light};border-radius:8px;margin:8px 0;">
<tr>${itemsHtml}</tr>
</table>`;
}

/**
 * Build the category rankings section for a tracked app.
 */
function buildCategorySection(app: TrackedAppDigest, platform: string): string {
  if (app.categoryChanges.length === 0) return "";

  const rows = app.categoryChanges.map((c) => ({
    cells: [
      c.categoryName,
      posStr(c.todayPosition),
      `<span style="color:${changeColor(c.type)};font-weight:600">${changeIcon(c.type)} ${changeStr(c.change, c.type)}</span>`,
    ],
  }));

  return `
<div style="margin-top:12px;">
  <div style="font-size:14px;font-weight:600;color:${colors.darkMuted};margin-bottom:4px;">&#127991; Category Rankings</div>
  ${dataTable(["Category", "Position", "Change"], rows)}
</div>`;
}

/**
 * Build the keyword rankings section for a tracked app.
 */
function buildKeywordSection(app: TrackedAppDigest, platform: string): string {
  if (app.keywordChanges.length === 0) return "";

  const rows = app.keywordChanges.map((r) => ({
    cells: [
      `<a href="${DASHBOARD_URL}/${platform}/keywords/${r.keywordSlug}" style="color:#111;text-decoration:none">${r.keyword}</a>`,
      posStr(r.todayPosition),
      `<span style="color:${changeColor(r.type)};font-weight:600">${changeIcon(r.type)} ${changeStr(r.change, r.type)}</span>`,
    ],
  }));

  return `
<div style="margin-top:12px;">
  <div style="font-size:14px;font-weight:600;color:${colors.darkMuted};margin-bottom:4px;">&#128273; Keyword Rankings</div>
  ${dataTable(["Keyword", "Position", "Change"], rows)}
</div>`;
}

/**
 * Build a full per-app section.
 */
function buildAppSection(app: TrackedAppDigest, platform: string): string {
  const overviewCard = buildOverviewCard(app);
  const categorySection = buildCategorySection(app, platform);
  const keywordSection = buildKeywordSection(app, platform);

  const hasContent = overviewCard || categorySection || keywordSection;
  if (!hasContent) return "";

  return `
<div style="margin-top:20px;border:1px solid ${colors.border};border-radius:8px;overflow:hidden;">
  <div style="background:${colors.light};padding:12px 16px;border-bottom:1px solid ${colors.border};">
    <div style="font-size:16px;font-weight:700;color:${colors.dark};">
      <a href="${DASHBOARD_URL}/${platform}/apps/${app.appSlug}" style="color:${colors.dark};text-decoration:none;">${app.appName}</a>
      <span style="display:inline-block;font-size:11px;font-weight:500;color:${colors.darkMuted};background:${colors.white};border:1px solid ${colors.border};border-radius:4px;padding:1px 6px;margin-left:8px;vertical-align:middle;">${app.platform}</span>
    </div>
  </div>
  <div style="padding:12px 16px;">
    ${overviewCard}
    ${categorySection}
    ${keywordSection}
  </div>
</div>`;
}

export function buildDigestHtml(data: DigestData, unsubscribeUrl?: string): string {
  const { accountName, date, trackedApps, competitorSummaries, summary } = data;
  const highlight = buildHighlight(data);
  const insight = generateInsight(data);
  const platform = data.platform || "shopify";

  // Summary badges
  const badgeItems = [
    { label: "improved", count: summary.improved, color: "green" as const },
    { label: "dropped", count: summary.dropped, color: "red" as const },
    { label: "new", count: summary.newEntries, color: "blue" as const },
    { label: "dropped out", count: summary.droppedOut, color: "amber" as const },
  ];

  // Build sections
  let sections = "";

  // 1. Today's Highlight
  if (highlight) {
    sections += heroStat(highlight.label, highlight.value, highlight.change);
  }

  // 2. Summary badges
  if (badgeItems.some((b) => b.count > 0)) {
    sections += summaryBadge(badgeItems);
  }

  // 3. Per-app sections
  for (const app of trackedApps) {
    sections += buildAppSection(app, platform);
  }

  // 4. Competitor Watch
  if (competitorSummaries.length > 0) {
    sections += `<div style="margin-top:20px;"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px;">Competitor Watch</div>`;
    for (const comp of competitorSummaries) {
      const changeParts: string[] = [];
      if (comp.ratingChange && comp.ratingChange !== 0) {
        changeParts.push(`Rating ${comp.ratingChange > 0 ? "+" : ""}${comp.ratingChange.toFixed(1)}`);
      }
      if (comp.reviewsChange && comp.reviewsChange !== 0) {
        changeParts.push(`${comp.reviewsChange > 0 ? "+" : ""}${comp.reviewsChange} reviews`);
      }
      const kwRanked = comp.keywordPositions.filter((kp) => kp.position !== null).length;

      sections += competitorCard({
        name: comp.appName,
        rating: comp.todayRating ? parseFloat(comp.todayRating) : null,
        ratingCount: comp.todayReviews,
        keywordPositions: kwRanked || undefined,
        change: changeParts.length > 0 ? changeParts.join(" · ") : undefined,
      });
    }
    sections += `</div>`;
  }

  // 5. Insight
  if (insight) {
    sections += insightBlock(insight);
  }

  const content = `
    ${header("Daily Ranking Report", `${accountName} · ${date}`)}
    <div style="padding:0 24px 24px;">
      ${sections}
    </div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `${accountName}: Ranking changes for ${date}`);
}

/**
 * Generate dynamic subject line based on content sentiment.
 */
export function buildDigestSubject(data: DigestData): string {
  const { summary, trackedApps } = data;
  const allTrackedChanges = trackedApps.flatMap((a) => a.keywordChanges);

  // Win day — highlight best improvement
  if (summary.improved > summary.dropped && summary.improved >= 2) {
    const best = allTrackedChanges
      .filter((r) => r.type === "improved" && r.change !== null)
      .sort((a, b) => (b.change || 0) - (a.change || 0))[0];
    if (best && best.todayPosition !== null && best.todayPosition <= 5) {
      return `Great day! ${best.appName} climbed to #${best.todayPosition} for "${best.keyword}" (+${best.change})`;
    }
    if (best) {
      return `${best.appName}: ${summary.improved} keywords up — "${best.keyword}" +${best.change} positions`;
    }
  }

  // Alert day — highlight biggest drop
  if (summary.dropped > summary.improved && summary.dropped >= 2) {
    const worst = allTrackedChanges
      .filter((r) => r.type === "dropped" && r.change !== null)
      .sort((a, b) => (a.change || 0) - (b.change || 0))[0];
    if (worst) {
      return `Heads up: ${worst.appName} dropped for "${worst.keyword}" (${worst.change} positions)`;
    }
  }

  // Mixed day
  if (summary.improved > 0 && summary.dropped > 0) {
    return `${data.accountName}: ${summary.improved} keywords up, ${summary.dropped} down — ${data.date}`;
  }

  // Steady / no changes
  const total = allTrackedChanges.length;
  if (total > 0) {
    return `Ranking Report: ${total} change${total !== 1 ? "s" : ""} detected — ${data.date}`;
  }

  return `Daily Ranking Report — ${data.date}`;
}
