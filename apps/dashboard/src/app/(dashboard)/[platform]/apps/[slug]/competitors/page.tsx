import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { redirect } from "next/navigation";
import { CompetitorsSection } from "../competitors-section";

export default async function CompetitorsPage({
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
    redirect(`/${platform}/apps/v1/${slug}`);
  }

  return <CompetitorsSection appSlug={slug} />;
}
