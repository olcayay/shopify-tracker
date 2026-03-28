import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { KeywordsSection } from "../../../../[slug]/keywords-section";
import { Lock } from "lucide-react";

export default async function V2KeywordsPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let app: any;
  try {
    app = await getApp(slug, platform as PlatformId);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  if (!app.isTrackedByAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-medium">Track this app to unlock keywords</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Keyword tracking lets you monitor search rankings, discover opportunities, and optimize your listing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KeywordsSection appSlug={slug} />
    </div>
  );
}
