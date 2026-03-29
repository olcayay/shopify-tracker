import type { DigestData, RankingChange } from "./digest-builder.js";
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

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

function changeIcon(type: RankingChange["type"]): string {
  switch (type) {
    case "improved": return "&#9650;"; // ▲
    case "dropped": return "&#9660;"; // ▼
    case "new_entry": return "&#9733;"; // ★
    case "dropped_out": return "&#10005;"; // ✕
    default: return "";
  }
}

function changeColor(type: RankingChange["type"]): string {
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

function changeStr(change: number | null, type: RankingChange["type"]): string {
  if (type === "new_entry") return "New";
  if (type === "dropped_out") return "Out";
  if (change === null || change === 0) return "\u2014";
  return change > 0 ? `+${change}` : `${change}`;
}

/**
 * Determine today's highlight — the single most important event.
 */
function buildHighlight(data: DigestData): { label: string; value: string; change?: { from: string; to: string; isPositive: boolean } } | null {
  const { rankingChanges } = data;
  if (rankingChanges.length === 0) return null;

  // Priority: top3 entry > top3 exit > biggest improvement > biggest drop
  const top3Entry = rankingChanges.find((r) => r.type === "improved" && r.todayPosition !== null && r.todayPosition <= 3);
  if (top3Entry) {
    return {
      label: `${top3Entry.appName} for "${top3Entry.keyword}"`,
      value: `#${top3Entry.todayPosition}`,
      change: { from: posStr(top3Entry.yesterdayPosition), to: posStr(top3Entry.todayPosition), isPositive: true },
    };
  }

  const competitorOvertook = rankingChanges.find((r) => r.isCompetitor && r.type === "improved" && r.change !== null && r.change >= 3);
  if (competitorOvertook) {
    return {
      label: `${competitorOvertook.appName} gained on "${competitorOvertook.keyword}"`,
      value: `+${competitorOvertook.change}`,
      change: { from: posStr(competitorOvertook.yesterdayPosition), to: posStr(competitorOvertook.todayPosition), isPositive: false },
    };
  }

  const bestWin = rankingChanges
    .filter((r) => r.type === "improved" && r.isTracked && r.change !== null)
    .sort((a, b) => (b.change || 0) - (a.change || 0))[0];
  if (bestWin) {
    return {
      label: `${bestWin.appName} for "${bestWin.keyword}"`,
      value: `+${bestWin.change}`,
      change: { from: posStr(bestWin.yesterdayPosition), to: posStr(bestWin.todayPosition), isPositive: true },
    };
  }

  return {
    label: "Keyword Rankings",
    value: `${rankingChanges.length}`,
  };
}

/**
 * Generate a rule-based insight from the digest data.
 */
function generateInsight(data: DigestData): string | null {
  const { rankingChanges, competitorSummaries, summary } = data;

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

  const newEntries = rankingChanges.filter((r) => r.type === "new_entry" && r.isTracked);
  if (newEntries.length > 0) {
    return `Your app appeared in ${newEntries.length} new keyword ranking${newEntries.length > 1 ? "s" : ""}. These fresh positions are opportunities to optimize and climb higher.`;
  }

  return null;
}

export function buildDigestHtml(data: DigestData, unsubscribeUrl?: string): string {
  const { accountName, date, rankingChanges, competitorSummaries, summary } = data;
  const highlight = buildHighlight(data);
  const insight = generateInsight(data);

  // Split ranking changes into wins and attention-needed
  const wins = rankingChanges.filter((r) => r.type === "improved" || r.type === "new_entry");
  const attention = rankingChanges.filter((r) => r.type === "dropped" || r.type === "dropped_out");

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

  // 3. Biggest Wins
  if (wins.length > 0) {
    const winRows = wins.map((r) => ({
      cells: [
        `<a href="${DASHBOARD_URL}/${data.platform || "shopify"}/keywords/${r.keywordSlug}" style="color:#111;text-decoration:none">${r.keyword}</a>`,
        r.appName,
        posStr(r.todayPosition),
        `<span style="color:${changeColor(r.type)};font-weight:600">${changeIcon(r.type)} ${changeStr(r.change, r.type)}</span>`,
      ],
    }));
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#16a34a;margin-bottom:4px;">&#9650; Biggest Wins</div>`;
    sections += dataTable(["Keyword", "App", "Position", "Change"], winRows);
    sections += `</div>`;
  }

  // 4. Needs Attention
  if (attention.length > 0) {
    const attRows = attention.map((r) => ({
      cells: [
        `<a href="${DASHBOARD_URL}/${data.platform || "shopify"}/keywords/${r.keywordSlug}" style="color:#111;text-decoration:none">${r.keyword}</a>`,
        r.appName,
        posStr(r.todayPosition),
        `<span style="color:${changeColor(r.type)};font-weight:600">${changeIcon(r.type)} ${changeStr(r.change, r.type)}</span>`,
      ],
    }));
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#dc2626;margin-bottom:4px;">&#9660; Needs Attention</div>`;
    sections += dataTable(["Keyword", "App", "Position", "Change"], attRows);
    sections += `</div>`;
  }

  // 5. Competitor Watch
  if (competitorSummaries.length > 0) {
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px;">Competitor Watch</div>`;
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

  // 6. Insight
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
  const { rankingChanges, summary } = data;

  // Win day — highlight best improvement
  if (summary.improved > summary.dropped && summary.improved >= 2) {
    const best = rankingChanges
      .filter((r) => r.type === "improved" && r.isTracked)
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
    const worst = rankingChanges
      .filter((r) => r.type === "dropped" && r.isTracked)
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
  const total = rankingChanges.filter((r) => r.isTracked).length;
  if (total > 0) {
    return `Ranking Report: ${total} change${total !== 1 ? "s" : ""} detected — ${data.date}`;
  }

  return `Daily Ranking Report — ${data.date}`;
}
