"use client";

import { useFeatureFlag } from "@/contexts/feature-flags-context";
import { usePlatform } from "@/contexts/platform-context";
import { redirect } from "next/navigation";

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasResearch = useFeatureFlag("market-research");
  const { platformId } = usePlatform();

  if (!hasResearch) {
    redirect(`/${platformId}`);
  }

  return <>{children}</>;
}
