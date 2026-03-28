export default async function FeaturedPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Featured</h2>
      <p className="text-sm text-muted-foreground">
        Featured placements for {slug} — will be wired in Phase 2.
      </p>
    </div>
  );
}
