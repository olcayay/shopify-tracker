/**
 * Win celebration email template.
 * Triggered when significant milestones are reached.
 */
import {
  emailLayout,
  header,
  heroStat,
  milestoneCard,
  ctaButton,
  footer,
  platformBadge,
  platformSubjectPrefix,
} from "./components/index.js";

/** Derive milestoneType from eventType when milestoneType is not set */
function deriveMilestoneType(eventType: string | undefined): WinCelebrationData["milestoneType"] | undefined {
  switch (eventType) {
    case "ranking_top1": return "top1";
    case "ranking_top3_entry": return "top3";
    case "review_milestone": return "review_milestone";
    case "rating_milestone": return "rating_milestone";
    case "install_milestone": return "install_milestone";
    default: return undefined;
  }
}

export interface WinCelebrationData {
  accountName: string;
  appName: string;
  appSlug: string;
  platform: string;
  milestoneType: "top1" | "top3" | "review_milestone" | "rating_milestone" | "install_milestone";
  keyword?: string;
  keywordSlug?: string;
  categoryName?: string;
  position?: number;
  reviewCount?: number;
  rating?: number;
  installCount?: number;
  previousBest?: number;
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildWinCelebrationHtml(data: WinCelebrationData & Record<string, any>, unsubscribeUrl?: string): string {
  const appName = data.appName || "Your App";
  const platform = data.platform || "";
  // Derive milestoneType from eventType if not set directly
  const milestoneType = data.milestoneType || deriveMilestoneType(data.eventType) || "top1";
  const accountName = data.accountName || appName;

  let heroLabel: string;
  let heroValue: string;

  switch (milestoneType) {
    case "top1":
      heroLabel = `${appName} reached #1 for "${data.keyword || "a keyword"}"!`;
      heroValue = "🏆 #1";
      break;
    case "top3":
      heroLabel = `${appName} entered Top 3 for "${data.keyword || "a keyword"}"!`;
      heroValue = `🥇 #${data.position || "?"}`;
      break;
    case "review_milestone":
      heroLabel = `${appName} hit ${data.reviewCount || "a new"} reviews!`;
      heroValue = `⭐ ${data.reviewCount || "🎉"}`;
      break;
    case "rating_milestone":
      heroLabel = `${appName} reached ${data.rating || "a new"}★ rating!`;
      heroValue = `${data.rating || "⭐"}★`;
      break;
    case "install_milestone":
      heroLabel = `${appName} reached ${data.installCount?.toLocaleString() || "a milestone in"} installs!`;
      heroValue = `🚀 ${data.installCount?.toLocaleString() || "🎉"}`;
      break;
    default:
      heroLabel = `${appName} achieved a new milestone!`;
      heroValue = "🎉";
      break;
  }

  let sections = heroStat(heroLabel, heroValue, data.previousBest != null ? {
    from: `Previous best: #${data.previousBest}`,
    to: `New best: #${data.position || 1}`,
    isPositive: true,
  } : undefined);

  // Milestone card
  const milestoneDesc: Record<string, string> = {
    top1: "Your app is the #1 result — the best possible position. Maintain quality to hold this spot.",
    top3: "Top 3 apps get the majority of clicks. Focus on reviews and listing quality to stay there.",
    review_milestone: "More reviews = more social proof = more conversions. Keep the momentum going!",
    rating_milestone: "A high rating is one of the strongest conversion signals in app marketplaces.",
    install_milestone: "Congratulations on this install milestone! More installs means more organic visibility.",
  };

  sections += milestoneCard(
    milestoneType === "top1" ? "First Place Achievement" :
    milestoneType === "top3" ? "Top 3 Achievement" :
    milestoneType === "review_milestone" ? "Review Milestone" :
    milestoneType === "rating_milestone" ? "Rating Milestone" :
    "Install Milestone",
    milestoneDesc[milestoneType]
  );

  sections += ctaButton("View Details", `${DASHBOARD_URL}/${platform}/apps/${data.appSlug}`);

  const content = `
    ${header("Congratulations! 🎉", `${accountName} · ${platformBadge(platform)} ${appName}`)}
    <div style="padding:0 24px 24px;">${sections}</div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Congratulations! ${appName}`);
}

export function buildWinCelebrationSubject(data: WinCelebrationData & Record<string, any>): string {
  const appName = data.appName || "Your App";
  const platform = data.platform || "";
  const milestoneType = data.milestoneType || deriveMilestoneType(data.eventType) || "top1";
  const { keyword, reviewCount, rating, installCount, position } = data;
  const prefix = platformSubjectPrefix(platform);
  switch (milestoneType) {
    case "top1": return `${prefix} 🏆 ${appName} is #1 for "${keyword || "a keyword"}"!`;
    case "top3": return `${prefix} 🥇 ${appName} entered Top 3 for "${keyword || "a keyword"}" (#${position || "?"})`;
    case "review_milestone": return `${prefix} ⭐ ${appName} reached ${reviewCount || "a milestone in"} reviews!`;
    case "rating_milestone": return `${prefix} ⭐ ${appName} hit ${rating || "a new"}★ rating!`;
    case "install_milestone": return `${prefix} 🚀 ${appName} reached ${installCount?.toLocaleString() || "a milestone in"} installs!`;
    default: return `${prefix} 🎉 ${appName} achieved a new milestone!`;
  }
}
