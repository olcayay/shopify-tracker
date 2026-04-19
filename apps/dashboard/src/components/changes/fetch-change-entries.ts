import { getApp, getAppChanges, getAppCompetitors } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import type { ChangeEntry } from "./unified-change-log";

/**
 * Fetch unified change entries for an app — self changes + competitor changes (if tracked).
 * Returns sorted entries (newest first) and app data.
 *
 * Optimized to minimize waterfall: app, self changes, and competitors are fetched in parallel.
 */
export async function fetchChangeEntries(
  slug: string,
  platform: PlatformId
): Promise<{ app: any; entries: ChangeEntry[] }> {
  // Fetch app info, self changes, and competitors list all in parallel
  const [app, selfChanges, competitors] = await Promise.all([
    getApp(slug, platform),
    getAppChanges(slug, 50, platform).catch(() => []),
    getAppCompetitors(slug, platform).catch(() => []),
  ]);

  // Guard: if getApp returned null/undefined, return empty entries
  if (!app) {
    return { app: { slug, name: slug, isTrackedByAccount: false }, entries: [] };
  }

  const appName = app.name || slug;

  const entries: ChangeEntry[] = (selfChanges || [])
    .filter((c: any) => c && c.field && c.detectedAt)
    .map((c: any) => ({
      appSlug: slug,
      appName,
      isSelf: true,
      field: c.field,
      oldValue: typeof c.oldValue === "string" ? c.oldValue : JSON.stringify(c.oldValue),
      newValue: typeof c.newValue === "string" ? c.newValue : JSON.stringify(c.newValue),
      detectedAt: c.detectedAt,
    }));

  // Fetch competitor changes in parallel (competitors already fetched above)
  if (app.isTrackedByAccount) {
    const topCompetitors = (competitors || []).slice(0, 10).filter((c: any) => c && c.appSlug);

    if (topCompetitors.length > 0) {
      const competitorChanges = await Promise.all(
        topCompetitors.map((c: any) =>
          getAppChanges(c.appSlug, 20, platform)
            .then((changes: any[]) =>
              (changes || [])
                .filter((ch: any) => ch && ch.field && ch.detectedAt)
                .map((ch: any) => ({
                  appSlug: c.appSlug,
                  appName: c.appName || c.appSlug,
                  isSelf: false,
                  field: ch.field,
                  oldValue: typeof ch.oldValue === "string" ? ch.oldValue : JSON.stringify(ch.oldValue),
                  newValue: typeof ch.newValue === "string" ? ch.newValue : JSON.stringify(ch.newValue),
                  detectedAt: ch.detectedAt,
                }))
            )
            .catch(() => [])
        )
      );
      entries.push(...competitorChanges.flat());
    }
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  return { app, entries };
}
