export default async function V2DashboardPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="text-sm text-muted-foreground">
        Hub page for {slug} — snapshot cards will be built in Phase 1.
      </p>
    </div>
  );
}
