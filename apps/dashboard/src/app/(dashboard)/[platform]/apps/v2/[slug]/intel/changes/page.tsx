import type { PlatformId } from "@appranks/shared";
import { UnifiedChangeLog } from "@/components/changes/unified-change-log";
import { fetchChangeEntries } from "@/components/changes/fetch-change-entries";

export default async function V2ChangesPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let entries;
  try {
    ({ entries } = await fetchChangeEntries(slug, platform as PlatformId));
  } catch {
    return <p className="text-muted-foreground">Failed to load changes.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Change Log</h2>
      <UnifiedChangeLog entries={entries} platform={platform} />
    </div>
  );
}
