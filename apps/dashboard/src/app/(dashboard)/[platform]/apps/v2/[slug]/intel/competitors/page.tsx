export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Competitors</h2>
      <p className="text-sm text-muted-foreground">
        Competitor analysis for {slug} — will be built in Phase 3.
      </p>
    </div>
  );
}
