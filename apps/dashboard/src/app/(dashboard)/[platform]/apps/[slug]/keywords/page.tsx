import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { redirect } from "next/navigation";
import { KeywordsSection } from "../keywords-section";

export default async function KeywordsPage({
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
    redirect(`/${platform}/apps/${slug}`);
  }

  return <KeywordsSection appSlug={slug} />;
}
