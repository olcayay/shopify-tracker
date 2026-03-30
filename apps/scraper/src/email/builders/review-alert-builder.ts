/**
 * Review alert email data builder.
 * Aggregates data needed by the review-alert-template.
 */
import { eq } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { apps, accounts } from "@appranks/db";
import type { ReviewAlertData } from "../review-alert-template.js";

export interface ReviewAlertInput {
  accountId: string;
  appId: number;
  platform: string;
  alertType: ReviewAlertData["alertType"];
  rating?: number;
  reviewerName?: string;
  reviewBody?: string;
  reviewCount?: number;
}

export async function buildReviewAlertData(
  db: Database,
  input: ReviewAlertInput
): Promise<ReviewAlertData> {
  // Fetch account name
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);

  // Fetch app details with current rating
  const [app] = await db
    .select({
      name: apps.name,
      slug: apps.slug,
      averageRating: apps.averageRating,
      ratingCount: apps.ratingCount,
    })
    .from(apps)
    .where(eq(apps.id, input.appId))
    .limit(1);

  return {
    accountName: account?.name || "Your Account",
    appName: app?.name || "Unknown App",
    appSlug: app?.slug || "",
    platform: input.platform,
    alertType: input.alertType,
    rating: input.rating,
    reviewerName: input.reviewerName,
    reviewBody: input.reviewBody
      ? input.reviewBody.length > 200
        ? input.reviewBody.slice(0, 200) + "..."
        : input.reviewBody
      : undefined,
    reviewCount: input.reviewCount,
    currentRating: app?.averageRating ? parseFloat(String(app.averageRating)) : undefined,
    currentReviewCount: app?.ratingCount ?? undefined,
  };
}
