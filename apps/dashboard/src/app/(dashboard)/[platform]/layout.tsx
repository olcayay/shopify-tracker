import { notFound } from "next/navigation";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { PlatformProvider } from "@/contexts/platform-context";

export default async function PlatformLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  if (!(platform in PLATFORMS)) {
    notFound();
  }
  return <PlatformProvider platformId={platform as PlatformId}>{children}</PlatformProvider>;
}
