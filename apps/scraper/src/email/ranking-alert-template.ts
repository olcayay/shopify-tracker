/**
 * Ranking alert email template.
 * Triggered when significant ranking changes are detected.
 */
import {
  emailLayout,
  header,
  heroStat,
  dataTable,
  ctaButton,
  footer,
  insightBlock,
  platformBadge,
  platformSubjectPrefix,
} from "./components/index.js";

export interface RankingAlertData {
  accountName: string;
  appName: string;
  appSlug: string;
  platform: string;
  alertType: "top3_entry" | "top3_exit" | "significant_change" | "new_entry" | "dropped_out";
  keyword: string;
  keywordSlug: string;
  categoryName?: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number | null;
  otherChanges?: { keyword: string; position: number | null; change: number | null }[];
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildRankingAlertHtml(data: RankingAlertData, unsubscribeUrl?: string): string {
  const { appName, platform, previousPosition, currentPosition, change, alertType, categoryName } = data;

  // Use categoryName for category_change events when keyword is undefined
  const displayKeyword = data.keyword || categoryName || "unknown";

  const isPositive = alertType === "top3_entry" || alertType === "new_entry" || (change != null && change > 0);
  const posFrom = previousPosition != null ? `#${previousPosition}` : "—";
  const posTo = currentPosition != null ? `#${currentPosition}` : "—";

  // Hero
  let heroLabel: string;
  let heroValue: string;

  switch (alertType) {
    case "top3_entry":
      heroLabel = `${appName} entered Top 3 for "${displayKeyword}"`;
      heroValue = `#${currentPosition}`;
      break;
    case "top3_exit":
      heroLabel = `${appName} dropped out of Top 3 for "${displayKeyword}"`;
      heroValue = `#${currentPosition}`;
      break;
    case "new_entry":
      heroLabel = `${appName} appeared in rankings for "${displayKeyword}"`;
      heroValue = `#${currentPosition}`;
      break;
    case "dropped_out":
      heroLabel = `${appName} dropped out of rankings for "${displayKeyword}"`;
      heroValue = "Out";
      break;
    default:
      heroLabel = `${appName} for "${displayKeyword}"`;
      heroValue = change != null ? (change > 0 ? `+${change}` : `${change}`) : posTo;
  }

  let sections = heroStat(heroLabel, heroValue, {
    from: posFrom,
    to: posTo,
    isPositive,
  });

  // Other recent changes for this app
  if (data.otherChanges && data.otherChanges.length > 0) {
    sections += dataTable(
      ["Keyword", "Position", "Change"],
      data.otherChanges.map((c) => ({
        cells: [
          c.keyword,
          c.position != null ? `#${c.position}` : "—",
          c.change != null ? (c.change > 0 ? `<span style="color:#16a34a">+${c.change}</span>` : `<span style="color:#dc2626">${c.change}</span>`) : "—",
        ],
      }))
    );
  }

  // Insight
  if (alertType === "top3_entry") {
    sections += insightBlock("Great position! Focus on maintaining it by collecting more reviews and optimizing your listing.");
  } else if (alertType === "dropped_out") {
    sections += insightBlock("Check if a competitor made recent changes. Consider updating your listing or responding to reviews.");
  }

  // CTA — use category URL for category changes, keyword URL otherwise
  const ctaUrl = !data.keyword && categoryName
    ? `${DASHBOARD_URL}/${platform}/categories/${data.keywordSlug || categoryName}`
    : `${DASHBOARD_URL}/${platform}/keywords/${data.keywordSlug || displayKeyword}`;
  sections += ctaButton("View Full Rankings", ctaUrl);

  const content = `
    ${header("Ranking Alert", `${data.accountName} · ${platformBadge(platform)} ${appName}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Ranking alert: ${appName}`);
}

export function buildRankingAlertSubject(data: RankingAlertData): string {
  const { appName, keyword, alertType, currentPosition, change, categoryName, otherChanges, platform } = data;
  const prefix = platformSubjectPrefix(platform);

  // If there are multiple changes, use aggregated subject
  const totalChanges = 1 + (otherChanges?.length ?? 0);
  if (totalChanges > 1) {
    return `${prefix} ${appName}: ${totalChanges} ranking changes detected`;
  }

  // Use categoryName for category_change events when keyword is undefined
  const displayKeyword = keyword || categoryName || "unknown";

  switch (alertType) {
    case "top3_entry":
      return `${prefix} 🏆 ${appName} reached #${currentPosition} for "${displayKeyword}"`;
    case "top3_exit":
      return `${prefix} ⚠️ ${appName} dropped out of Top 3 for "${displayKeyword}"`;
    case "new_entry":
      return `${prefix} 🆕 ${appName} appeared at #${currentPosition} for "${displayKeyword}"`;
    case "dropped_out":
      return `${prefix} 📉 ${appName} dropped out of rankings for "${displayKeyword}"`;
    default:
      return `${prefix} ${appName}: ${change != null && change > 0 ? "+" : ""}${change} positions for "${displayKeyword}"`;
  }
}
