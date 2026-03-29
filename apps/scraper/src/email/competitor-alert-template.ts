/**
 * Competitor alert email template.
 * Triggered when significant competitor activity is detected.
 */
import {
  emailLayout,
  header,
  heroStat,
  competitorCard,
  ctaButton,
  footer,
  insightBlock,
} from "./components/index.js";

export interface CompetitorAlertData {
  accountName: string;
  trackedAppName: string;
  trackedAppSlug: string;
  platform: string;
  alertType: "overtook" | "pricing_change" | "review_surge" | "featured";
  competitorName: string;
  competitorSlug: string;
  keyword?: string;
  keywordSlug?: string;
  details: {
    competitorPosition?: number;
    yourPosition?: number;
    pricingChange?: string;
    reviewCount?: number;
    ratingChange?: number;
    featuredSurface?: string;
  };
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildCompetitorAlertHtml(data: CompetitorAlertData, unsubscribeUrl?: string): string {
  const { trackedAppName, competitorName, platform, alertType, details } = data;

  let heroLabel: string;
  let heroValue: string;
  let isPositive = false;

  switch (alertType) {
    case "overtook":
      heroLabel = `${competitorName} overtook ${trackedAppName}`;
      heroValue = `#${details.competitorPosition}`;
      break;
    case "pricing_change":
      heroLabel = `${competitorName} changed pricing`;
      heroValue = details.pricingChange || "Updated";
      break;
    case "review_surge":
      heroLabel = `${competitorName} review surge`;
      heroValue = `+${details.reviewCount}`;
      break;
    case "featured":
      heroLabel = `${competitorName} got featured`;
      heroValue = details.featuredSurface || "Featured";
      isPositive = false;
      break;
    default:
      heroLabel = `${competitorName} activity detected`;
      heroValue = "Alert";
  }

  let sections = heroStat(heroLabel, heroValue, alertType === "overtook" && details.yourPosition
    ? { from: `You: #${details.yourPosition}`, to: `Them: #${details.competitorPosition}`, isPositive: false }
    : undefined
  );

  // Competitor card
  sections += competitorCard({
    name: competitorName,
    rating: details.ratingChange != null ? 4.5 + details.ratingChange : undefined,
    change: alertType === "overtook" && data.keyword
      ? `Now #${details.competitorPosition} for "${data.keyword}" (you're at #${details.yourPosition})`
      : alertType === "pricing_change"
        ? details.pricingChange
        : alertType === "review_surge"
          ? `${details.reviewCount} new reviews detected`
          : alertType === "featured"
            ? `Spotted in ${details.featuredSurface}`
            : undefined,
  });

  // Insight
  const insights: Record<string, string> = {
    overtook: `${competitorName} has moved ahead. Check their listing for recent changes that may have improved their position.`,
    pricing_change: `Pricing changes can shift user decisions. Consider reviewing your own pricing strategy.`,
    review_surge: `A review surge often signals a marketing push or promotional campaign. Monitor their activity.`,
    featured: `Featured placements drive significant traffic. Focus on your app quality to earn featured spots.`,
  };
  sections += insightBlock(insights[alertType] || "Monitor this competitor closely.");

  // CTA
  sections += ctaButton(
    "View Competitor Details",
    `${DASHBOARD_URL}/${platform}/apps/${data.competitorSlug}`
  );

  const content = `
    ${header("Competitor Alert", `${data.accountName} · ${trackedAppName}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Competitor alert: ${competitorName}`);
}

export function buildCompetitorAlertSubject(data: CompetitorAlertData): string {
  const { competitorName, trackedAppName, alertType, keyword, details } = data;

  switch (alertType) {
    case "overtook":
      return `⚠️ ${competitorName} overtook ${trackedAppName} for "${keyword}"`;
    case "pricing_change":
      return `💰 ${competitorName} changed pricing`;
    case "review_surge":
      return `📊 ${competitorName}: ${details.reviewCount} new reviews detected`;
    case "featured":
      return `⭐ ${competitorName} got featured on ${details.featuredSurface || "marketplace"}`;
    default:
      return `Competitor alert: ${competitorName}`;
  }
}
