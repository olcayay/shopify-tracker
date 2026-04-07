/**
 * Review alert email template.
 * Triggered when new reviews (positive or negative) are detected.
 */
import {
  emailLayout,
  header,
  heroStat,
  reviewCard,
  ctaButton,
  footer,
  insightBlock,
  platformBadge,
  platformSubjectPrefix,
} from "./components/index.js";

export interface ReviewAlertData {
  accountName: string;
  appName: string;
  appSlug: string;
  platform: string;
  alertType: "new_positive" | "new_negative" | "velocity_spike";
  rating?: number;
  reviewerName?: string;
  reviewBody?: string;
  reviewCount?: number;
  currentRating?: number;
  currentReviewCount?: number;
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildReviewAlertHtml(data: ReviewAlertData, unsubscribeUrl?: string): string {
  const { appName, platform, alertType, rating, currentRating, currentReviewCount } = data;

  let heroLabel: string;
  let heroValue: string;
  let isPositive = true;

  switch (alertType) {
    case "new_positive":
      heroLabel = `New ${rating}★ review for ${appName}`;
      heroValue = `${rating}★`;
      break;
    case "new_negative":
      heroLabel = `New ${rating}★ review for ${appName}`;
      heroValue = `${rating}★`;
      isPositive = false;
      break;
    case "velocity_spike":
      heroLabel = `Review velocity spike for ${appName}`;
      heroValue = `+${data.reviewCount}`;
      break;
    default:
      heroLabel = `Review alert for ${appName}`;
      heroValue = "!";
  }

  let sections = heroStat(heroLabel, heroValue, currentRating != null ? {
    from: `Overall: ${currentRating.toFixed(1)}★`,
    to: `${currentReviewCount || 0} total reviews`,
    isPositive,
  } : undefined);

  // Review card (if we have review content)
  if (data.reviewBody || data.reviewerName) {
    sections += reviewCard(
      rating || 0,
      data.reviewerName || "Anonymous",
      data.reviewBody || "",
      new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    );
  }

  // Insight
  if (alertType === "new_negative") {
    sections += insightBlock("Negative reviews impact conversion rates. Consider responding promptly and addressing the concern publicly.");
  } else if (alertType === "velocity_spike") {
    sections += insightBlock(`${data.reviewCount} reviews in a short period is unusual. This could indicate a competitor campaign or organic viral growth.`);
  } else if (alertType === "new_positive" && rating === 5) {
    sections += insightBlock("5-star reviews are gold! Consider asking this user for a testimonial or case study.");
  }

  sections += ctaButton("View All Reviews", `${DASHBOARD_URL}/${platform}/apps/${data.appSlug}`);

  const content = `
    ${header("Review Alert", `${data.accountName} · ${platformBadge(platform)} ${appName}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Review alert: ${appName}`);
}

export function buildReviewAlertSubject(data: ReviewAlertData): string {
  const { appName, alertType, rating, reviewCount, platform } = data;
  const prefix = platformSubjectPrefix(platform);
  switch (alertType) {
    case "new_positive": return `${prefix} ⭐ New ${rating}★ review for ${appName}`;
    case "new_negative": return `${prefix} ⚠️ New ${rating}★ review for ${appName} — needs attention`;
    case "velocity_spike": return `${prefix} 📊 ${appName}: ${reviewCount} new reviews detected`;
    default: return `${prefix} Review alert: ${appName}`;
  }
}
