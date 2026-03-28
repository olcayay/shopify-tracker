export default async function VisibilityOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Visibility</h2>
      <p className="text-sm text-muted-foreground">
        Visibility overview for {slug} — score breakdown will be built in Phase 2.
      </p>
    </div>
  );
}
