/**
 * Weekly summary email template.
 */
import type { WeeklyDigestData } from "./weekly-builder.js";
import {
  emailLayout,
  header,
  heroStat,
  dataTable,
  competitorCard,
  footer,
  summaryBadge,
  insightBlock,
} from "./components/index.js";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildWeeklyHtml(data: WeeklyDigestData, unsubscribeUrl?: string): string {
  const { accountName, weekRange, rankings, competitors, summary } = data;
  const platform = data.platform || "shopify";

  let sections = "";

  // Hero stat — net position change
  const netGain = rankings.reduce((sum, r) => sum + (r.netChange && r.netChange > 0 ? r.netChange : 0), 0);
  const netLoss = rankings.reduce((sum, r) => sum + (r.netChange && r.netChange < 0 ? Math.abs(r.netChange) : 0), 0);

  if (netGain > 0 || netLoss > 0) {
    const isPositive = netGain >= netLoss;
    sections += heroStat(
      "Net Keyword Movement",
      isPositive ? `+${netGain - netLoss}` : `-${netLoss - netGain}`,
      { from: `${summary.totalKeywords} tracked`, to: `${summary.improved} up, ${summary.dropped} down`, isPositive }
    );
  }

  // Summary badges
  sections += summaryBadge([
    { label: "improved", count: summary.improved, color: "green" },
    { label: "dropped", count: summary.dropped, color: "red" },
    { label: "tracked keywords", count: summary.totalKeywords, color: "blue" },
  ]);

  // Top movers (improved)
  const topWins = rankings.filter((r) => r.netChange != null && r.netChange > 0).slice(0, 10);
  if (topWins.length > 0) {
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#16a34a;margin-bottom:4px;">&#9650; Top Movers This Week</div>`;
    sections += dataTable(
      ["Keyword", "App", "Start", "End", "Change"],
      topWins.map((r) => ({
        cells: [
          `<a href="${DASHBOARD_URL}/${platform}/keywords/${r.keywordSlug}" style="color:#111;text-decoration:none">${r.keyword}</a>`,
          r.appName,
          r.startPosition != null ? `#${r.startPosition}` : "\u2014",
          r.endPosition != null ? `#${r.endPosition}` : "\u2014",
          `<span style="color:#16a34a;font-weight:600">+${r.netChange}</span>`,
        ],
      }))
    );
    sections += `</div>`;
  }

  // Biggest drops
  const topDrops = rankings.filter((r) => r.netChange != null && r.netChange < 0).slice(-10).reverse();
  if (topDrops.length > 0) {
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#dc2626;margin-bottom:4px;">&#9660; Biggest Drops</div>`;
    sections += dataTable(
      ["Keyword", "App", "Start", "End", "Change"],
      topDrops.map((r) => ({
        cells: [
          `<a href="${DASHBOARD_URL}/${platform}/keywords/${r.keywordSlug}" style="color:#111;text-decoration:none">${r.keyword}</a>`,
          r.appName,
          r.startPosition != null ? `#${r.startPosition}` : "\u2014",
          r.endPosition != null ? `#${r.endPosition}` : "\u2014",
          `<span style="color:#dc2626;font-weight:600">${r.netChange}</span>`,
        ],
      }))
    );
    sections += `</div>`;
  }

  // Competitor watch
  if (competitors.length > 0) {
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px;">Competitor Activity</div>`;
    for (const comp of competitors) {
      const changeParts: string[] = [];
      if (comp.ratingChange && comp.ratingChange !== 0) {
        changeParts.push(`Rating ${comp.ratingChange > 0 ? "+" : ""}${comp.ratingChange.toFixed(2)}`);
      }
      if (comp.reviewsChange && comp.reviewsChange !== 0) {
        changeParts.push(`${comp.reviewsChange > 0 ? "+" : ""}${comp.reviewsChange} reviews`);
      }
      sections += competitorCard({
        name: comp.appName,
        rating: comp.endRating ? parseFloat(comp.endRating) : null,
        change: changeParts.join(" · ") || undefined,
      });
    }
    sections += `</div>`;
  }

  // Weekly insight
  if (summary.improved > summary.dropped * 2) {
    sections += insightBlock(`Strong week with ${summary.improved} improvements vs ${summary.dropped} drops. Your apps are gaining visibility — consider increasing ad spend or content marketing to capitalize on this momentum.`);
  } else if (summary.dropped > summary.improved * 2 && summary.dropped >= 3) {
    sections += insightBlock(`${summary.dropped} keywords dropped this week. Review competitor activity and consider refreshing your app listing copy or responding to recent reviews.`);
  }

  const content = `
    ${header("Weekly Summary", `${accountName} · ${weekRange}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `${accountName}: Weekly ranking summary`);
}

export function buildWeeklySubject(data: WeeklyDigestData): string {
  const { summary, weekRange } = data;

  if (summary.improved > summary.dropped && summary.improved >= 3) {
    return `Great week! ${summary.improved} keywords improved — ${weekRange}`;
  }
  if (summary.dropped > summary.improved && summary.dropped >= 3) {
    return `Weekly alert: ${summary.dropped} keywords dropped — ${weekRange}`;
  }
  if (summary.improved > 0 || summary.dropped > 0) {
    return `Week in review: ${summary.improved} up, ${summary.dropped} down — ${weekRange}`;
  }
  return `Weekly Ranking Summary — ${weekRange}`;
}
