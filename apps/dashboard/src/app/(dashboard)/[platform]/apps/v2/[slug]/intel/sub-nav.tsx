"use client";

import { useParams } from "next/navigation";
import { SubNavPills } from "@/components/v2/sub-nav-pills";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";

export function IntelSubNav() {
  const { platform, slug } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const base = `/${platform}/apps/v2/${slug}/intel`;

  const items = [
    { label: "Overview", href: base },
    { label: "Competitors", href: `${base}/competitors` },
    ...(caps.hasSimilarApps ? [{ label: "Similar Apps", href: `${base}/similar` }] : []),
    ...(caps.hasReviews ? [{ label: "Reviews", href: `${base}/reviews` }] : []),
    { label: "Changes", href: `${base}/changes` },
  ];

  return <SubNavPills items={items} />;
}
