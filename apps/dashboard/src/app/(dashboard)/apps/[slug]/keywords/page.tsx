import { getApp } from "@/lib/api";
import { redirect } from "next/navigation";
import { KeywordsSection } from "../keywords-section";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let app: any;
  try {
    app = await getApp(slug);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  if (!app.isTrackedByAccount) {
    redirect(`/apps/${slug}`);
  }

  return <KeywordsSection appSlug={slug} />;
}
