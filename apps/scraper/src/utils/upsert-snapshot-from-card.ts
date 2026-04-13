/**
 * Insert an appSnapshots row from a category-card payload when appropriate.
 * Shared by CategoryScraper (PLA-1049) and AppDetailsScraper.scrapeAllViaCategoryApi
 * (PLA-1048). Mirrors the behaviour documented on CategoryScraper — see the
 * `refreshSnapshotFromCategoryCard` flag on `PlatformConstants`.
 */
import { eq, desc } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { appSnapshots, appFieldChanges } from "@appranks/db";
import type { NormalizedCategoryApp } from "../platforms/platform-module.js";

export interface UpsertSnapshotOptions {
  refresh: boolean;
  maxAgeMs: number;
  now: Date;
  runId: string;
  vendorName?: string;
}

export interface UpsertSnapshotResult {
  inserted: boolean;
  driftFields: string[];
  reason: "seed" | "change" | "stale" | "skip-existing" | "skip-fresh";
}

export async function upsertSnapshotFromCategoryCard(
  db: Database,
  appId: number,
  card: NormalizedCategoryApp,
  opts: UpsertSnapshotOptions,
): Promise<UpsertSnapshotResult> {
  const { refresh, maxAgeMs, now, runId, vendorName } = opts;
  const hasRating = typeof card.averageRating === "number" && card.averageRating > 0;
  const hasCount = typeof card.ratingCount === "number" && card.ratingCount > 0;

  const [latestSnap] = await db
    .select({
      id: appSnapshots.id,
      scrapedAt: appSnapshots.scrapedAt,
      averageRating: appSnapshots.averageRating,
      ratingCount: appSnapshots.ratingCount,
      pricing: appSnapshots.pricing,
      appIntroduction: appSnapshots.appIntroduction,
      developer: appSnapshots.developer,
      // Detail-only fields — never set by the card pass, but read here so the
      // card-pass insert can preserve them instead of blanking them out.
      // See PLA-1072: card insert was dropping appDetails/seoTitle/
      // seoMetaDescription/features/pricingPlans to "" / [], which then
      // poisoned the next detail-pass diff (its `if (!newVal) continue` guard
      // turned the recovery into a silent no-op).
      appDetails: appSnapshots.appDetails,
      seoTitle: appSnapshots.seoTitle,
      seoMetaDescription: appSnapshots.seoMetaDescription,
      features: appSnapshots.features,
      pricingPlans: appSnapshots.pricingPlans,
      demoStoreUrl: appSnapshots.demoStoreUrl,
      languages: appSnapshots.languages,
      integrations: appSnapshots.integrations,
      categories: appSnapshots.categories,
      support: appSnapshots.support,
    })
    .from(appSnapshots)
    .where(eq(appSnapshots.appId, appId))
    .orderBy(desc(appSnapshots.scrapedAt))
    .limit(1);

  let driftFields: string[] = [];

  if (!refresh) {
    if (latestSnap) return { inserted: false, driftFields, reason: "skip-existing" };
  } else if (latestSnap) {
    const ageMs = now.getTime() - new Date(latestSnap.scrapedAt).getTime();
    const nextRating = hasRating ? String(card.averageRating) : null;
    const nextCount = hasCount ? card.ratingCount : null;
    const nextPricing = card.pricingHint || "";
    const nextIntro = card.shortDescription || "";
    const nextDeveloperName = vendorName || null;
    const prevDeveloperName =
      latestSnap.developer && typeof latestSnap.developer === "object"
        ? ((latestSnap.developer as { name?: string }).name ?? null)
        : null;

    const drift: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
    // averageRating: Postgres stores decimal(3,2) so prev is e.g. "4.80" and
    // String(4.8) is "4.8". Compare numerically to two decimals.
    const prevRatingNum = latestSnap.averageRating == null ? null : Math.round(Number(latestSnap.averageRating) * 100);
    const nextRatingNum = nextRating == null ? null : Math.round(Number(nextRating) * 100);
    if (prevRatingNum !== nextRatingNum) {
      drift.push({ field: "averageRating", oldValue: latestSnap.averageRating, newValue: nextRating });
    }
    if (nextCount !== latestSnap.ratingCount) {
      drift.push({
        field: "ratingCount",
        oldValue: latestSnap.ratingCount == null ? null : String(latestSnap.ratingCount),
        newValue: nextCount == null ? null : String(nextCount),
      });
    }
    // pricing: the category API occasionally omits `pricing` on a card that
    // had it before. Treat "missing in the new card" as no-op instead of
    // blowing away the stored value. Case-insensitive compare for the rest.
    const prevPricing = (latestSnap.pricing ?? "").trim();
    const nextPricingTrim = nextPricing.trim();
    const pricingChanged = nextPricingTrim !== ""
      && prevPricing.toLowerCase() !== nextPricingTrim.toLowerCase();
    if (pricingChanged) {
      drift.push({ field: "pricing", oldValue: latestSnap.pricing ?? null, newValue: nextPricingTrim });
    }
    // appIntroduction: card.shortDescription is sometimes empty on a refresh
    // even after the detail pass populated it. Treat empty as no-op (mirrors
    // the pricing guard above) — see PLA-1072.
    if (nextIntro !== "" && nextIntro !== (latestSnap.appIntroduction ?? "")) {
      drift.push({ field: "appIntroduction", oldValue: latestSnap.appIntroduction ?? null, newValue: nextIntro });
    }
    // developer: same story — vendorName may be undefined on a card-pass
    // refresh after the detail pass set it. Don't blank it out.
    if (nextDeveloperName && nextDeveloperName !== prevDeveloperName) {
      drift.push({ field: "developer", oldValue: prevDeveloperName, newValue: nextDeveloperName });
    }

    const stale = ageMs > maxAgeMs;
    if (drift.length === 0 && !stale) {
      return { inserted: false, driftFields, reason: "skip-fresh" };
    }

    driftFields = drift.map((d) => d.field);

    if (drift.length > 0) {
      await db.insert(appFieldChanges).values(
        drift.map((c) => ({
          appId,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          scrapeRunId: runId,
        })),
      );
    }
  }

  // Preserve previous pricing when the card is silent on it (the category API
  // drops `pricing` inconsistently for some apps; don't overwrite with empty).
  const pricingForInsert = (card.pricingHint && card.pricingHint.trim())
    ? card.pricingHint
    : (latestSnap?.pricing ?? "");

  // Preserve detail-only fields from the previous snapshot — the card pass
  // does not produce them, so blanking them would force the next detail pass
  // to recover, but its `if (!newVal) continue` guard would mask the
  // recovery. See PLA-1072.
  const introForInsert = (card.shortDescription && card.shortDescription.length > 0)
    ? card.shortDescription
    : (latestSnap?.appIntroduction ?? "");
  const developerForInsert = vendorName
    ? { name: vendorName, url: "" }
    : (latestSnap?.developer ?? null);

  await db.insert(appSnapshots).values({
    appId,
    scrapeRunId: runId,
    scrapedAt: now,
    averageRating: hasRating ? String(card.averageRating) : null,
    ratingCount: hasCount ? card.ratingCount : null,
    pricing: pricingForInsert,
    appIntroduction: introForInsert,
    appDetails: latestSnap?.appDetails ?? "",
    seoTitle: latestSnap?.seoTitle ?? "",
    seoMetaDescription: latestSnap?.seoMetaDescription ?? "",
    features: latestSnap?.features ?? [],
    developer: developerForInsert,
    demoStoreUrl: latestSnap?.demoStoreUrl ?? null,
    languages: latestSnap?.languages ?? [],
    integrations: latestSnap?.integrations ?? [],
    categories: latestSnap?.categories ?? [],
    pricingPlans: latestSnap?.pricingPlans ?? [],
    support: latestSnap?.support ?? null,
  });

  const reason: UpsertSnapshotResult["reason"] = !latestSnap
    ? "seed"
    : driftFields.length > 0
      ? "change"
      : "stale";
  return { inserted: true, driftFields, reason };
}
