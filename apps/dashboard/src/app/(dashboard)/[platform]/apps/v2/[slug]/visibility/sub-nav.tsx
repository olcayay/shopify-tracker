"use client";

import { useParams } from "next/navigation";
import { SubNavPills } from "@/components/v2/sub-nav-pills";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { shouldShowAdsClient } from "@/lib/ads-feature";
import { useFeatureFlags } from "@/contexts/feature-flags-context";

export function VisibilitySubNav() {
  const { platform, slug } = useParams();
  const { hasFeature } = useFeatureFlags();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const base = `/${platform}/apps/v2/${slug}/visibility`;

  const items = [
    { label: "Overview", href: base },
    { label: "Keywords", href: `${base}/keywords` },
    { label: "Rankings", href: `${base}/rankings` },
    ...(caps.hasFeaturedSections ? [{ label: "Featured", href: `${base}/featured` }] : []),
    ...(shouldShowAdsClient(caps, hasFeature) ? [{ label: "Ads", href: `${base}/ads` }] : []),
  ];

  return <SubNavPills items={items} />;
}
