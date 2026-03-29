/**
 * Opportunity alert email — weekly market analysis with actionable opportunities.
 */
import {
  emailLayout,
  header,
  heroStat,
  dataTable,
  insightBlock,
  ctaButton,
  footer,
} from "./components/index.js";

export interface OpportunityData {
  accountName: string;
  platform: string;
  weekRange: string;
  opportunities: {
    type: "rising_keyword" | "competitor_gap" | "category_opening" | "review_opportunity";
    title: string;
    description: string;
    actionUrl?: string;
    priority: "high" | "medium" | "low";
  }[];
  marketTrends: {
    label: string;
    value: string;
    trend: "up" | "down" | "stable";
  }[];
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildOpportunityAlertHtml(data: OpportunityData, unsubscribeUrl?: string): string {
  const { opportunities, marketTrends } = data;
  const highPriority = opportunities.filter((o) => o.priority === "high");

  let sections = "";

  // Hero — opportunity count
  sections += heroStat(
    "Market Opportunities This Week",
    `${opportunities.length}`,
    highPriority.length > 0
      ? { from: `${highPriority.length} high priority`, to: "Act now", isPositive: true }
      : undefined
  );

  // Opportunities table
  if (opportunities.length > 0) {
    const priorityIcon = { high: "🔴", medium: "🟡", low: "🟢" };
    sections += dataTable(
      ["Priority", "Opportunity", "Action"],
      opportunities.map((o) => ({
        cells: [
          `${priorityIcon[o.priority]} ${o.priority}`,
          `<strong>${o.title}</strong><br><span style="font-size:12px;color:#6b7280">${o.description}</span>`,
          o.actionUrl ? `<a href="${o.actionUrl}" style="color:#111;text-decoration:underline">View →</a>` : "—",
        ],
      }))
    );
  }

  // Market trends
  if (marketTrends.length > 0) {
    const trendIcon = { up: "↑", down: "↓", stable: "→" };
    const trendColor = { up: "#16a34a", down: "#dc2626", stable: "#6b7280" };
    sections += `<div style="margin-top:16px;"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px;">Market Trends</div>`;
    sections += `<div style="display:flex;flex-wrap:wrap;gap:12px;">`;
    for (const t of marketTrends) {
      sections += `
<div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${t.label}</div>
  <div style="font-size:20px;font-weight:bold;color:#111;">${t.value}</div>
  <div style="font-size:13px;color:${trendColor[t.trend]};">${trendIcon[t.trend]} ${t.trend}</div>
</div>`;
    }
    sections += `</div></div>`;
  }

  // Top insight
  if (highPriority.length > 0) {
    sections += insightBlock(`Top opportunity: ${highPriority[0].title}. ${highPriority[0].description}`);
  }

  sections += ctaButton("View All Opportunities", `${DASHBOARD_URL}/${data.platform}/overview`);

  const content = `
    ${header("Weekly Opportunity Report", `${data.accountName} · ${data.weekRange}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Market opportunities: ${data.weekRange}`);
}

export function buildOpportunityAlertSubject(data: OpportunityData): string {
  const high = data.opportunities.filter((o) => o.priority === "high").length;
  if (high > 0) {
    return `🎯 ${high} high-priority market opportunit${high === 1 ? "y" : "ies"} this week`;
  }
  return `📊 ${data.opportunities.length} market opportunities — ${data.weekRange}`;
}
