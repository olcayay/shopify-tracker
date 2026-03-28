export default async function DraftEditorPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Draft Editor</h2>
      <p className="text-sm text-muted-foreground">
        Side-by-side draft editor for {slug} — will be built in Phase 4.
      </p>
    </div>
  );
}
