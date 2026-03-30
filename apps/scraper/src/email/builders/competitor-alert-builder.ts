/**
 * Competitor alert email data builder.
 * Aggregates data needed by the competitor-alert-template.
 */
import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { apps, accounts, appSnapshots } from "@appranks/db";
import type { CompetitorAlertData } from "../competitor-alert-template.js";

export interface CompetitorAlertInput {
  accountId: string;
  trackedAppId: number;
  competitorAppId: number;
  platform: string;
  alertType: CompetitorAlertData["alertType"];
  keyword?: string;
  keywordSlug?: string;
  details?: Partial<CompetitorAlertData["details"]>;
}

export async function buildCompetitorAlertData(
  db: Database,
  input: CompetitorAlertInput
): Promise<CompetitorAlertData> {
  // Fetch account name
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);

  // Fetch tracked app details
  const [trackedApp] = await db
    .select({ name: apps.name, slug: apps.slug })
    .from(apps)
    .where(eq(apps.id, input.trackedAppId))
    .limit(1);

  // Fetch competitor app details + latest snapshot
  const [competitorApp] = await db
    .select({ name: apps.name, slug: apps.slug, ratingCount: apps.ratingCount, averageRating: apps.averageRating, pricingHint: apps.pricingHint })
    .from(apps)
    .where(eq(apps.id, input.competitorAppId))
    .limit(1);

  // Build details from input or DB
  const details: CompetitorAlertData["details"] = {
    ...input.details,
  };

  if (competitorApp) {
    if (details.reviewCount == null && competitorApp.ratingCount != null) {
      details.reviewCount = competitorApp.ratingCount;
    }
  }

  return {
    accountName: account?.name || "Your Account",
    trackedAppName: trackedApp?.name || "Unknown App",
    trackedAppSlug: trackedApp?.slug || "",
    platform: input.platform,
    alertType: input.alertType,
    competitorName: competitorApp?.name || "Unknown Competitor",
    competitorSlug: competitorApp?.slug || "",
    keyword: input.keyword,
    keywordSlug: input.keywordSlug,
    details,
  };
}
