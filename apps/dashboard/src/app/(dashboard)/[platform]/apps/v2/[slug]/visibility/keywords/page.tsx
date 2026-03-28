export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Keywords</h2>
      <p className="text-sm text-muted-foreground">
        Enhanced keywords page for {slug} — will be built in Phase 2.
      </p>
    </div>
  );
}
