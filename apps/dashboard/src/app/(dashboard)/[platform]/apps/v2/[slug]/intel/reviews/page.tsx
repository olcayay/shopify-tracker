export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Reviews</h2>
      <p className="text-sm text-muted-foreground">
        Reviews for {slug} — will be wired in Phase 3.
      </p>
    </div>
  );
}
