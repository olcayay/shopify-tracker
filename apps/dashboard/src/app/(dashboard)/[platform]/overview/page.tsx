import { redirect } from "next/navigation";

/** Redirect old /[platform]/overview URLs to /[platform] */
export default async function OverviewRedirect({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  redirect(`/${platform}`);
}
