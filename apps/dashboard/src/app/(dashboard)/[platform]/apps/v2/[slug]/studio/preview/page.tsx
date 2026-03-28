export default async function PreviewPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Live Preview</h2>
      <p className="text-sm text-muted-foreground">
        Live preview for {slug} — will be wired in Phase 4.
      </p>
    </div>
  );
}
