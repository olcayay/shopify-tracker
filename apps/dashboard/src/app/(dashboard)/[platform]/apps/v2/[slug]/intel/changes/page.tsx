import { getApp, getAppChanges, getAppCompetitors } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { UnifiedChangeLog, type ChangeEntry } from "@/components/v2/unified-change-log";

export default async function V2ChangesPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let app: any;
  let selfChanges: any[];
  try {
    [app, selfChanges] = await Promise.all([
      getApp(slug, platform as PlatformId),
      getAppChanges(slug, 50, platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load changes.</p>;
  }

  // Build self entries
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
    const competitors = await getAppCompetitors(slug, platform as PlatformId).catch(() => []);
    const topCompetitors = competitors.slice(0, 10);

    if (topCompetitors.length > 0) {
      const competitorChanges = await Promise.all(
        topCompetitors.map((c: any) =>
          getAppChanges(c.slug, 20, platform as PlatformId)
            .then((changes: any[]) =>
              changes.map((ch: any) => ({
                appSlug: c.slug,
                appName: c.name,
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Change Log</h2>
      <UnifiedChangeLog entries={entries} />
    </div>
  );
}
