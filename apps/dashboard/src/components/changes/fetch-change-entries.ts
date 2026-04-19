import { getApp, getAppChanges, getAppCompetitors } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import type { ChangeEntry } from "./unified-change-log";

/**
 * Fetch unified change entries for an app — self changes + competitor changes (if tracked).
 * Returns sorted entries (newest first) and app data.
 *
 * Uses a single batch endpoint for competitor changes (includeChanges=true)
 * instead of N+1 separate API calls.
 */
export async function fetchChangeEntries(
  slug: string,
  platform: PlatformId
): Promise<{ app: any; entries: ChangeEntry[] }> {
  // Fetch app info, self changes, and competitors+changes all in parallel.
  // getAppCompetitors with includeChanges=true returns competitor data with
  // recentChanges embedded — single SQL query on the API side instead of 10+ separate calls.
  const [app, selfChanges, competitors] = await Promise.all([
    getApp(slug, platform),
    getAppChanges(slug, 50, platform).catch(() => []),
    getAppCompetitors(slug, platform, true).catch(() => []),
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

  // Extract competitor changes from the batch response (already included via includeChanges=true)
  if (app.isTrackedByAccount && competitors?.length > 0) {
    for (const comp of competitors.slice(0, 10)) {
      if (!comp?.appSlug) continue;
      const changes = comp.recentChanges ?? [];
      for (const ch of changes) {
        if (!ch || !ch.field || !ch.detectedAt) continue;
        entries.push({
          appSlug: comp.appSlug,
          appName: comp.appName || comp.appSlug,
          isSelf: false,
          field: ch.field,
          oldValue: typeof ch.oldValue === "string" ? ch.oldValue : JSON.stringify(ch.oldValue),
          newValue: typeof ch.newValue === "string" ? ch.newValue : JSON.stringify(ch.newValue),
          detectedAt: ch.detectedAt,
        });
      }
    }
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  return { app, entries };
}
