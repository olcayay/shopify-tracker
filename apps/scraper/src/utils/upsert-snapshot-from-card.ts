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
    if (nextRating !== latestSnap.averageRating) {
      drift.push({ field: "averageRating", oldValue: latestSnap.averageRating, newValue: nextRating });
    }
    if (nextCount !== latestSnap.ratingCount) {
      drift.push({
        field: "ratingCount",
        oldValue: latestSnap.ratingCount == null ? null : String(latestSnap.ratingCount),
        newValue: nextCount == null ? null : String(nextCount),
      });
    }
    if (nextPricing !== (latestSnap.pricing ?? "")) {
      drift.push({ field: "pricing", oldValue: latestSnap.pricing ?? null, newValue: nextPricing });
    }
    if (nextIntro !== (latestSnap.appIntroduction ?? "")) {
      drift.push({ field: "appIntroduction", oldValue: latestSnap.appIntroduction ?? null, newValue: nextIntro });
    }
    if (nextDeveloperName !== prevDeveloperName) {
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

  await db.insert(appSnapshots).values({
    appId,
    scrapeRunId: runId,
    scrapedAt: now,
    averageRating: hasRating ? String(card.averageRating) : null,
    ratingCount: hasCount ? card.ratingCount : null,
    pricing: card.pricingHint || "",
    appIntroduction: card.shortDescription || "",
    appDetails: "",
    seoTitle: "",
    seoMetaDescription: "",
    features: [],
    developer: vendorName ? { name: vendorName, url: "" } : null,
    demoStoreUrl: null,
    languages: [],
    integrations: [],
    categories: [],
    pricingPlans: [],
    support: null,
  });

  const reason: UpsertSnapshotResult["reason"] = !latestSnap
    ? "seed"
    : driftFields.length > 0
      ? "change"
      : "stale";
  return { inserted: true, driftFields, reason };
}
