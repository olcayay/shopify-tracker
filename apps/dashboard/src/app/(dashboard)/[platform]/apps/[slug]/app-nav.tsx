"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";

export function AppNav({
  slug,
  isTracked,
}: {
  slug: string;
  isTracked: boolean;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${platform}/apps/${slug}`;
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      // On initial mount at base URL, redirect to saved tab
      if (pathname === base) {
        try {
          const saved = localStorage.getItem(`app-tab-${slug}`);
          if (saved && saved !== base && saved.startsWith(`${base}/`)) {
            router.replace(saved);
            return;
          }
        } catch {}
      }
    }
    // Save current tab
    try {
      localStorage.setItem(`app-tab-${slug}`, pathname);
    } catch {}
  }, [pathname, slug, base, router]);

  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/details`, label: "Details" },
    ...(isTracked
      ? [
          { href: `${base}/competitors`, label: "Competitors" },
          { href: `${base}/keywords`, label: "Keywords" },
          { href: `${base}/compare`, label: "Compare" },
          { href: `${base}/preview`, label: "Preview" },
        ]
      : []),
    { href: `${base}/rankings`, label: "Rankings" },
    { href: `${base}/reviews`, label: "Reviews" },
    { href: `${base}/changes`, label: "Changes" },
    ...(caps.hasSimilarApps ? [{ href: `${base}/similar`, label: "Similar" }] : []),
    ...(caps.hasFeaturedSections ? [{ href: `${base}/featured`, label: "Featured" }] : []),
    { href: `${base}/ads`, label: "Ads" },
  ];

  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex w-max items-center justify-start rounded-lg bg-muted p-[3px] h-9 text-muted-foreground">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all",
                "text-foreground/60 hover:text-foreground",
                isActive &&
                  "bg-background text-foreground shadow-sm border-input"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
