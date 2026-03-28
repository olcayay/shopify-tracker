"use client";

import { useParams } from "next/navigation";
import { SubNavPills } from "@/components/v2/sub-nav-pills";

export function StudioSubNav() {
  const { platform, slug } = useParams();
  const base = `/${platform}/apps/v2/${slug}/studio`;

  const items = [
    { label: "Overview", href: base },
    { label: "Draft Editor", href: `${base}/draft` },
    { label: "Live Preview", href: `${base}/preview` },
  ];

  return <SubNavPills items={items} />;
}
