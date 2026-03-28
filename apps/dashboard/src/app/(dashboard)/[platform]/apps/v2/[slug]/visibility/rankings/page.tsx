export default async function RankingsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Rankings</h2>
      <p className="text-sm text-muted-foreground">
        Rankings page for {slug} — will be wired in Phase 2.
      </p>
    </div>
  );
}
