/**
 * Cold email templates for prospect outreach.
 * PLA-348: Campaign system, PLA-350: First contact, PLA-352: Follow-up and competitive alert
 */
import {
  emailLayout,
  header,
  heroStat,
  ctaButton,
  footer,
  insightBlock,
} from "./components/index.js";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://appranks.io";

// --- PLA-350: Cold first contact ---
export interface ColdFirstContactData {
  recipientName: string;
  appName: string;
  appSlug: string;
  platform: string;
  insights: {
    ranking?: number;
    categoryName?: string;
    ratingTrend?: "up" | "down" | "stable";
    competitorCount?: number;
    reviewVelocity?: string;
  };
}

export function buildColdFirstContactHtml(data: ColdFirstContactData): string {
  const { recipientName, appName, platform, insights } = data;

  let insightText = "";
  if (insights.ranking) {
    insightText += `${appName} currently ranks #${insights.ranking} in ${insights.categoryName || "its category"}.`;
  }
  if (insights.competitorCount) {
    insightText += ` There are ${insights.competitorCount} competing apps in the same space.`;
  }
  if (insights.reviewVelocity) {
    insightText += ` Review velocity: ${insights.reviewVelocity}.`;
  }

  const content = `
    ${header("Market Intelligence for " + appName, "")}
    <div style="padding:0 24px 24px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;">Hi ${recipientName},</p>
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        I noticed ${appName} on the ${platform} marketplace and wanted to share some data insights that might be useful.
      </p>
      ${insightText ? insightBlock(insightText) : ""}
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        We track ranking changes, competitor activity, and review trends across 11 app marketplaces. Would a detailed report for ${appName} be helpful?
      </p>
      ${ctaButton("See Your App's Data", `${DASHBOARD_URL}/apps/${platform}/${data.appSlug}`)}
      <p style="font-size:14px;color:#6b7280;margin-top:16px;">
        Best regards,<br>The AppRanks Team
      </p>
    </div>
    ${footer()}
  `;

  return emailLayout(content, `Market insights for ${appName}`);
}

export function buildColdFirstContactSubject(data: ColdFirstContactData): string {
  if (data.insights.ranking && data.insights.ranking <= 10) {
    return `${data.appName} is #${data.insights.ranking} — here's what we see`;
  }
  return `Quick question about ${data.appName}'s marketplace strategy`;
}

// --- PLA-352: Cold follow-up nudge ---
export interface ColdFollowUpData {
  recipientName: string;
  appName: string;
  appSlug: string;
  platform: string;
  daysSinceContact: number;
  newInsight?: string;
}

export function buildColdFollowUpHtml(data: ColdFollowUpData): string {
  const { recipientName, appName, daysSinceContact, newInsight } = data;

  const content = `
    ${header("Following up on " + appName, "")}
    <div style="padding:0 24px 24px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;">Hi ${recipientName},</p>
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        Just following up on my note from ${daysSinceContact} days ago about ${appName}.
      </p>
      ${newInsight ? insightBlock(`New data: ${newInsight}`) : ""}
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        If marketplace analytics isn't a priority right now, no worries at all. Just wanted to make sure you saw the data.
      </p>
      ${ctaButton("View Report", `${DASHBOARD_URL}/apps/${data.platform}/${data.appSlug}`)}
    </div>
    ${footer()}
  `;

  return emailLayout(content, `Follow up: ${appName}`);
}

export function buildColdFollowUpSubject(data: ColdFollowUpData): string {
  if (data.newInsight) {
    return `New data on ${data.appName} — quick update`;
  }
  return `Re: ${data.appName}'s marketplace position`;
}

// --- PLA-352: Cold competitive alert ---
export interface ColdCompetitiveAlertData {
  recipientName: string;
  appName: string;
  appSlug: string;
  platform: string;
  competitorName: string;
  competitorChange: string;
}

export function buildColdCompetitiveAlertHtml(data: ColdCompetitiveAlertData): string {
  const { recipientName, appName, competitorName, competitorChange } = data;

  const content = `
    ${header("Competitor Alert: " + competitorName, "")}
    <div style="padding:0 24px 24px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;">Hi ${recipientName},</p>
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        We detected a significant change for ${competitorName}, which competes with ${appName}:
      </p>
      ${insightBlock(competitorChange)}
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        Want to see how ${appName} compares? We can show you detailed competitive intelligence.
      </p>
      ${ctaButton("Compare Apps", `${DASHBOARD_URL}/compare/${data.platform}/${data.appSlug}-vs-${competitorName.toLowerCase().replace(/\s+/g, "-")}`)}
    </div>
    ${footer()}
  `;

  return emailLayout(content, `Competitor update: ${competitorName}`);
}

export function buildColdCompetitiveAlertSubject(data: ColdCompetitiveAlertData): string {
  return `${data.competitorName} just made a move — affects ${data.appName}`;
}
