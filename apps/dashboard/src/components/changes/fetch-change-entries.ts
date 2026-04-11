import { getApp, getAppChanges, getAppCompetitors } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import type { ChangeEntry } from "./unified-change-log";

/**
 * Fetch unified change entries for an app — self changes + competitor changes (if tracked).
 * Returns sorted entries (newest first) and app data.
 */
export async function fetchChangeEntries(
  slug: string,
  platform: PlatformId
): Promise<{ app: any; entries: ChangeEntry[] }> {
  const [app, selfChanges] = await Promise.all([
    getApp(slug, platform),
    getAppChanges(slug, 50, platform).catch(() => []),
  ]);

  const entries: ChangeEntry[] = selfChanges.map((c: any) => ({
    appSlug: slug,
    appName: app.name,
    isSelf: true,
    field: c.field,
    oldValue: typeof c.oldValue === "string" ? c.oldValue : JSON.stringify(c.oldValue),
    newValue: typeof c.newValue === "string" ? c.newValue : JSON.stringify(c.newValue),
    detectedAt: c.detectedAt,
  }));

  // Fetch competitor changes if tracked
  if (app.isTrackedByAccount) {
    const competitors = await getAppCompetitors(slug, platform).catch(() => []);
    const topCompetitors = competitors.slice(0, 10);

    if (topCompetitors.length > 0) {
      const competitorChanges = await Promise.all(
        topCompetitors.map((c: any) =>
          getAppChanges(c.appSlug, 20, platform)
            .then((changes: any[]) =>
              changes.map((ch: any) => ({
                appSlug: c.appSlug,
                appName: c.appName,
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
