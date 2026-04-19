import { getApp, getAppChangesFeed } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import type { ChangeEntry } from "./unified-change-log";

/**
 * Fetch unified change entries for an app — self changes + competitor changes.
 * Uses a single /changes-feed endpoint that returns everything in 2 SQL queries
 * (self changes + batch competitor changes) instead of N+1 separate API calls.
 */
export async function fetchChangeEntries(
  slug: string,
  platform: PlatformId
): Promise<{ app: any; entries: ChangeEntry[] }> {
  // 2 parallel API calls: app info + all changes (self + competitors)
  const [app, feed] = await Promise.all([
    getApp(slug, platform),
    getAppChangesFeed(slug, platform).catch(() => ({ selfChanges: [], competitorChanges: {} })),
  ]);

  if (!app) {
    return { app: { slug, name: slug, isTrackedByAccount: false }, entries: [] };
  }

  const appName = app.name || slug;

  // Self changes
  const entries: ChangeEntry[] = (feed.selfChanges || [])
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

  // Competitor changes (already batched by the API)
  for (const [compSlug, changes] of Object.entries(feed.competitorChanges || {})) {
    for (const ch of changes as any[]) {
      if (!ch || !ch.field || !ch.detectedAt) continue;
      entries.push({
        appSlug: compSlug,
        appName: ch.appName || compSlug,
        isSelf: false,
        field: ch.field,
        oldValue: typeof ch.oldValue === "string" ? ch.oldValue : JSON.stringify(ch.oldValue),
        newValue: typeof ch.newValue === "string" ? ch.newValue : JSON.stringify(ch.newValue),
        detectedAt: ch.detectedAt,
      });
    }
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  return { app, entries };
}
