/**
 * Re-engagement email template.
 * Sent to inactive users to bring them back.
 */
import {
  emailLayout,
  header,
  heroStat,
  ctaButton,
  footer,
  insightBlock,
} from "./components/index.js";

export interface ReEngagementData {
  userName: string;
  accountName: string;
  daysSinceLogin: number;
  trackedApps: number;
  trackedKeywords: number;
  missedChanges?: number;
  topChange?: {
    appName: string;
    keyword: string;
    change: number;
  };
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildReEngagementHtml(data: ReEngagementData, unsubscribeUrl?: string): string {
  const { userName, daysSinceLogin, trackedApps, trackedKeywords, missedChanges, topChange } = data;

  let sections = "";

  // Hero: what they're missing
  if (missedChanges && missedChanges > 0) {
    sections += heroStat(
      "Ranking changes since your last visit",
      `${missedChanges}`,
      { from: `${daysSinceLogin} days ago`, to: "Today", isPositive: false }
    );
  } else {
    sections += heroStat(
      `It's been ${daysSinceLogin} days`,
      `${daysSinceLogin}`,
    );
  }

  // Highlight a notable change
  if (topChange) {
    sections += insightBlock(
      `While you were away: ${topChange.appName} moved ${topChange.change > 0 ? "up" : "down"} ${Math.abs(topChange.change)} positions for "${topChange.keyword}". Check your dashboard for the full picture.`
    );
  }

  // Stats reminder
  sections += `
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
  <div style="font-size:14px;color:#6b7280;margin-bottom:8px;">You're tracking</div>
  <div style="font-size:24px;font-weight:bold;color:#111;">
    ${trackedApps} apps &middot; ${trackedKeywords} keywords
  </div>
</div>`;

  sections += ctaButton("Check Your Dashboard", DASHBOARD_URL);

  const content = `
    ${header("We miss you! 👋", data.accountName)}
    <div style="padding:0 24px 24px;">
      <p style="font-size:16px;color:#374151;">Hi ${userName},</p>
      <p style="font-size:16px;color:#374151;line-height:1.6;">
        Your app marketplace data is still being collected and updated daily. Here's what you might have missed:
      </p>
      ${sections}
    </div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `We miss you, ${userName}!`);
}

export function buildReEngagementSubject(data: ReEngagementData): string {
  if (data.missedChanges && data.missedChanges > 0) {
    return `${data.missedChanges} ranking changes while you were away`;
  }
  return `Your apps are waiting — ${data.trackedApps} apps tracked, ${data.daysSinceLogin} days since last login`;
}
