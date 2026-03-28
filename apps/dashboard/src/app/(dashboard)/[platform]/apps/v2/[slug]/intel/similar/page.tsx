export default async function SimilarAppsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Similar Apps</h2>
      <p className="text-sm text-muted-foreground">
        Similar apps for {slug} — will be wired in Phase 3.
      </p>
    </div>
  );
}
