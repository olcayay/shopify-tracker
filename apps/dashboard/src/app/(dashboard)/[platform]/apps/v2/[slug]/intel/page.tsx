export default async function IntelOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Market Intel</h2>
      <p className="text-sm text-muted-foreground">
        Market intelligence overview for {slug} — competitors page will be built in Phase 3.
      </p>
    </div>
  );
}
