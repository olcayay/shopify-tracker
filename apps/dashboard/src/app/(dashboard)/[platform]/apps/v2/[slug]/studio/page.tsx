export default async function StudioOverviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Listing Studio</h2>
      <p className="text-sm text-muted-foreground">
        Listing studio for {slug} — current listing page will be built in Phase 4.
      </p>
    </div>
  );
}
