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
import { platformLabel } from "./components/platform-badge.js";
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

  // Priority 5: Review milestone
  const milestones = [50, 100, 200, 500, 1000, 2000, 5000];
  for (const app of data.trackedApps) {
    if (app.reviewCountToday !== null && app.reviewCountChange !== null && app.reviewCountChange > 0) {
      const crossed = milestones.find(
        (m) => app.reviewCountToday! >= m && (app.reviewCountToday! - app.reviewCountChange!) < m
      );
      if (crossed) {
        return {
          label: `"${app.appName}" hit ${crossed} reviews`,
          value: `${ratingStr(app.ratingToday)}★`,
        };
      }
    }
  }

  return {
    label: "Keyword Rankings",
    value: `${allTrackedChanges.length}`,
  };
}

/**
 * Generate a rule-based insight from the digest data.
 * References app-specific data: categories, rating, review velocity, competitor comparison.
 */
function generateInsight(data: DigestData): string | null {
  const { competitorSummaries, summary, trackedApps } = data;

  // Category milestone insight
  for (const app of trackedApps) {
    const topCat = app.categoryChanges.find((c) => c.todayPosition !== null && c.todayPosition <= 3 && c.type === "improved");
    if (topCat) {
      return `"${app.appName}" climbed to ${posStr(topCat.todayPosition)} in ${topCat.categoryName}. Category rankings drive organic discovery — keep optimizing your listing for this category.`;
    }
  }

  // Strong keyword momentum
  if (summary.improved > summary.dropped * 2 && summary.improved >= 3) {
    const topApp = trackedApps.find((a) => a.keywordChanges.filter((k) => k.type === "improved").length > 0);
    const appRef = topApp ? ` for "${topApp.appName}"` : "";
    return `Strong momentum today${appRef} with ${summary.improved} keyword improvements. Consider expanding your keyword coverage while things are trending up.`;
  }

  // Keywords dropping — compare with competitor movement
  if (summary.dropped > summary.improved * 2 && summary.dropped >= 3) {
    const competitorImproved = competitorSummaries.filter((c) =>
      c.keywordPositions.some((kp) => kp.change !== null && kp.change > 0)
    );
    if (competitorImproved.length > 0) {
      return `${summary.dropped} keywords dropped today while ${competitorImproved[0].appName} gained positions. Check if they launched new features or updated their listing.`;
    }
    return `${summary.dropped} keywords dropped today. Check if competitors launched new features or promotions that may be pulling traffic.`;
  }

  // Review velocity insight
  for (const app of trackedApps) {
    if (app.reviewCountChange !== null && app.reviewCountChange >= 5) {
      return `"${app.appName}" gained ${app.reviewCountChange} reviews today. Strong review velocity helps improve marketplace rankings and conversion rates.`;
    }
  }

  // Competitor review surge
  const competitorGains = competitorSummaries.filter((c) => c.reviewsChange !== null && c.reviewsChange > 5);
  if (competitorGains.length > 0) {
    return `${competitorGains[0].appName} gained ${competitorGains[0].reviewsChange} reviews today. Monitor their review velocity — it may signal a marketing push.`;
  }

  // Rating change insight
  for (const app of trackedApps) {
    if (app.ratingChange !== null && app.ratingChange > 0) {
      return `"${app.appName}" rating improved to ${ratingStr(app.ratingToday)} (+${app.ratingChange.toFixed(1)}). Higher ratings improve conversion and can boost category rankings.`;
    }
    if (app.ratingChange !== null && app.ratingChange < -0.1) {
      return `"${app.appName}" rating dropped to ${ratingStr(app.ratingToday)} (${app.ratingChange.toFixed(1)}). Consider checking recent reviews for actionable feedback.`;
    }
  }

  // New keyword entries
  const allTrackedChanges = trackedApps.flatMap((a) => a.keywordChanges);
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

  const platformName = data.platform ? platformLabel(data.platform) : null;
  const headerTitle = platformName
    ? `${platformName} Daily Ranking Report`
    : "Daily Ranking Report";
  const preheader = platformName
    ? `${accountName} · ${platformName} · ${date}`
    : `${accountName}: Ranking changes for ${date}`;

  const content = `
    ${header(headerTitle, `${accountName} · ${date}`)}
    <div style="padding:0 24px 24px;">
      ${sections}
    </div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, preheader);
}

/**
 * Pick the tracked app with the most impactful change for the subject line.
 * When multiple tracked apps exist, references the one with the biggest change.
 */
function pickSubjectApp(data: DigestData): TrackedAppDigest | null {
  const { trackedApps } = data;
  if (trackedApps.length === 0) return null;
  if (trackedApps.length === 1) return trackedApps[0];

  // Score each app: biggest abs(keyword change) + category milestone bonus
  let best: TrackedAppDigest | null = null;
  let bestScore = -1;
  for (const app of trackedApps) {
    let score = 0;
    for (const kw of app.keywordChanges) {
      score = Math.max(score, Math.abs(kw.change ?? 0));
    }
    for (const cat of app.categoryChanges) {
      if (cat.todayPosition === 1 && cat.type === "improved") score += 100;
      else score = Math.max(score, Math.abs(cat.change ?? 0));
    }
    if (app.reviewCountChange !== null && app.reviewCountChange > 0) {
      score += app.reviewCountChange;
    }
    if (score > bestScore) {
      bestScore = score;
      best = app;
    }
  }
  return best;
}

/**
 * Generate dynamic subject line referencing the tracked app by name.
 *
 * Priority:
 * 1. Category milestone: "{App}" reached #1 in {Category}!
 * 2. Big keyword jump: "{App}" jumped +N for "{keyword}" — now #X
 * 3. Review milestone: "{App}" hit N reviews (X.X★)
 * 4. Mixed summary: "{App}": N keywords ▲, rating +X — date
 * 5. Quiet day: "{App}" rankings stable — date
 */
export function buildDigestSubject(data: DigestData): string {
  const { summary, trackedApps } = data;
  const app = pickSubjectApp(data);
  const appName = app?.appName || data.accountName;
  const prefix = data.platform ? `[${platformLabel(data.platform)}] ` : "";

  // 1. Category milestone
  if (app) {
    const catMilestone = app.categoryChanges.find((c) => c.todayPosition === 1 && c.type === "improved");
    if (catMilestone) {
      return `${prefix}"${appName}" reached #1 in ${catMilestone.categoryName}!`;
    }
  }

  // 2. Big keyword jump (change >= 3 or top-5 entry)
  if (app) {
    const allKwChanges = app.keywordChanges
      .filter((r) => r.type === "improved" && r.change !== null)
      .sort((a, b) => (b.change || 0) - (a.change || 0));
    const best = allKwChanges[0];
    if (best && best.change !== null && best.change >= 3) {
      return `${prefix}"${appName}" jumped +${best.change} for "${best.keyword}" — now ${posStr(best.todayPosition)}`;
    }
    if (best && best.todayPosition !== null && best.todayPosition <= 5) {
      return `${prefix}Great day! ${appName} climbed to #${best.todayPosition} for "${best.keyword}" (+${best.change})`;
    }
  }

  // 3. Review milestone (round numbers)
  if (app && app.reviewCountToday !== null && app.reviewCountChange !== null && app.reviewCountChange > 0) {
    const milestones = [50, 100, 200, 500, 1000, 2000, 5000];
    const crossed = milestones.find(
      (m) => app.reviewCountToday! >= m && (app.reviewCountToday! - app.reviewCountChange!) < m
    );
    if (crossed) {
      return `${prefix}"${appName}" hit ${crossed} reviews (${ratingStr(app.ratingToday)}★)`;
    }
  }

  // 4. Mixed summary with app name
  if (summary.improved > 0 || summary.dropped > 0) {
    const parts: string[] = [];
    if (summary.improved > 0) parts.push(`${summary.improved} keywords ▲`);
    if (summary.dropped > 0) parts.push(`${summary.dropped} ▼`);
    if (app?.ratingChange && app.ratingChange !== 0) {
      parts.push(`rating ${app.ratingChange > 0 ? "+" : ""}${app.ratingChange.toFixed(1)}`);
    }
    return `${prefix}"${appName}": ${parts.join(", ")} — ${data.date}`;
  }

  // 5. Quiet day — check for category or rating-only changes
  if (app) {
    const hasCatChanges = app.categoryChanges.length > 0;
    const hasRatingChange = app.ratingChange !== null && app.ratingChange !== 0;
    if (hasCatChanges || hasRatingChange) {
      const detail = hasCatChanges
        ? `${app.categoryChanges.length} category change${app.categoryChanges.length !== 1 ? "s" : ""}`
        : `rating ${app.ratingChange! > 0 ? "+" : ""}${app.ratingChange!.toFixed(1)}`;
      return `${prefix}"${appName}": ${detail} — ${data.date}`;
    }
  }

  // Fallback
  const total = trackedApps.reduce((n, a) => n + a.keywordChanges.length, 0);
  if (total > 0) {
    return `${prefix}"${appName}": ${total} ranking change${total !== 1 ? "s" : ""} — ${data.date}`;
  }

  return `${prefix}"${appName}" rankings stable — ${data.date}`;
}
