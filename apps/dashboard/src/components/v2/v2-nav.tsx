"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { ChevronDown } from "lucide-react";

interface NavSection {
  key: string;
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

export function V2Nav({
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
  const base = `/${platform}/apps/v2/${slug}`;
  const didMount = useRef(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      if (pathname === base) {
        try {
          const saved = localStorage.getItem(`v2-nav-${slug}`);
          if (saved && saved !== base && saved.startsWith(`${base}/`)) {
            router.replace(saved);
            return;
          }
        } catch {}
      }
    }
    try {
      localStorage.setItem(`v2-nav-${slug}`, pathname);
    } catch {}
  }, [pathname, slug, base, router]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibilitySubItems = [
    { label: "Overview", href: `${base}/visibility` },
    { label: "Keywords", href: `${base}/visibility/keywords` },
    { label: "Rankings", href: `${base}/visibility/rankings` },
    ...(caps.hasFeaturedSections ? [{ label: "Featured", href: `${base}/visibility/featured` }] : []),
    ...(caps.hasAdTracking ? [{ label: "Ads", href: `${base}/visibility/ads` }] : []),
  ];

  const intelSubItems = [
    { label: "Overview", href: `${base}/intel` },
    { label: "Competitors", href: `${base}/intel/competitors` },
    ...(caps.hasSimilarApps ? [{ label: "Similar Apps", href: `${base}/intel/similar` }] : []),
    ...(caps.hasReviews ? [{ label: "Reviews", href: `${base}/intel/reviews` }] : []),
    { label: "Changes", href: `${base}/intel/changes` },
  ];

  const sections: NavSection[] = [
    { key: "dashboard", label: "Dashboard", href: base },
    { key: "visibility", label: "Visibility", href: `${base}/visibility`, subItems: visibilitySubItems },
    { key: "intel", label: "Market Intel", href: `${base}/intel`, subItems: intelSubItems },
    ...(isTracked
      ? [{ key: "studio", label: "Listing Studio", href: `${base}/studio`, subItems: [
          { label: "Overview", href: `${base}/studio` },
          { label: "Draft Editor", href: `${base}/studio/draft` },
          { label: "Live Preview", href: `${base}/studio/preview` },
        ]}]
      : []),
  ];

  function isActive(section: NavSection): boolean {
    if (section.key === "dashboard") return pathname === base;
    return pathname.startsWith(section.href);
  }

  return (
    <div ref={dropdownRef} className="border-b overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav className="flex items-center gap-1 min-w-max" role="navigation" aria-label="App detail sections">
        {sections.map((section) => {
          const active = isActive(section);
          const hasDropdown = section.subItems && section.subItems.length > 0;
          const isOpen = openDropdown === section.key;

          return (
            <div key={section.key} className="relative">
              <div className="flex items-center">
                <Link
                  href={section.href}
                  onClick={() => setOpenDropdown(null)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors rounded-t-md",
                    active
                      ? "text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
                {hasDropdown && (
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : section.key)}
                    className={cn(
                      "p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors",
                      isOpen && "text-foreground",
                    )}
                    aria-label={`${section.label} sub-pages`}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {hasDropdown && isOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
                  {section.subItems!.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenDropdown(null)}
                      className={cn(
                        "block rounded-sm px-3 py-1.5 text-sm transition-colors",
                        pathname === item.href
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
