"use client";

/**
 * Shared "My Developers" / "Competitor Developers" section for /developers
 * and /[platform]/developers. Handles:
 *   - collapsible container with localStorage persistence (PLA-1101)
 *   - counts in header ("N developers · M apps") (PLA-1101)
 *   - variant-specific accent tint (amber for tracked, rose for competitor) (PLA-1101)
 *   - loading shimmer while the top fetches resolve (PLA-1101)
 *   - sortable App Count column (PLA-1100)
 *
 * Consolidated from prior duplicated sections in the two developer pages.
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "@/components/ui/link";
import { ArrowUpDown, Bookmark, ChevronDown, ChevronRight, Users, Swords } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/app-icon";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";

export interface DeveloperTopSectionApp {
  slug: string;
  name: string;
  platform: string;
  iconUrl: string | null;
}

export interface DeveloperTopSectionItem {
  id: number;
  slug: string;
  name: string;
  platforms: string[];
  platformCount: number;
  totalApps: number;
  isStarred: boolean;
  apps: DeveloperTopSectionApp[];
}

export type DeveloperTopSectionVariant = "tracked" | "competitor";

const VARIANT_CONFIG: Record<
  DeveloperTopSectionVariant,
  {
    title: string;
    subtitle: string;
    icon: typeof Users;
    appColLabel: string;
    // Tailwind classes — tint header/icon without touching table body
    tintBg: string;
    tintIconBg: string;
    tintIconText: string;
    tintBorder: string;
  }
> = {
  tracked: {
    title: "My Developers",
    subtitle: "Developers of your tracked apps",
    icon: Users,
    appColLabel: "My Tracked Apps",
    tintBg: "bg-amber-500/5",
    tintIconBg: "bg-amber-500/10",
    tintIconText: "text-amber-600 dark:text-amber-400",
    tintBorder: "border-l-4 border-amber-500/50",
  },
  competitor: {
    title: "Competitor Developers",
    subtitle: "Developers behind your competitors' apps",
    icon: Swords,
    appColLabel: "Competitor Apps",
    tintBg: "bg-rose-500/5",
    tintIconBg: "bg-rose-500/10",
    tintIconText: "text-rose-600 dark:text-rose-400",
    tintBorder: "border-l-4 border-rose-500/50",
  },
};

function useLocalStorageBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(initial);
  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "true" || raw === "false") setValue(raw === "true");
    } catch {
      /* ignore — SSR / private mode */
    }
  }, [key]);
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next ? "true" : "false");
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [value, set] as const;
}

export function DeveloperTopSection({
  variant,
  items,
  loading,
  emptyTitle,
  emptyDescription,
  emptyCtaLabel,
  emptyCtaHref,
  developerHref,
  storageKeyPrefix,
  enabledPlatforms,
  platformFilter,
}: {
  variant: DeveloperTopSectionVariant;
  items: DeveloperTopSectionItem[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyCtaLabel: string;
  emptyCtaHref: string;
  developerHref: (slug: string) => string;
  storageKeyPrefix: string;
  /** For the platform-agnostic page: which platforms to render badges for. */
  enabledPlatforms?: string[];
  /** For the [platform]/developers page: filter apps to this platform only. */
  platformFilter?: string;
}) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;
  const storageKey = `${storageKeyPrefix}:${variant}:expanded`;
  const [expanded, setExpanded] = useLocalStorageBoolean(storageKey, true);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const devCount = items.length;
  const appCount = useMemo(
    () => items.reduce((sum, d) => sum + d.apps.length, 0),
    [items]
  );

  const sortedItems = useMemo(() => {
    const signed = order === "desc" ? -1 : 1;
    return [...items].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      const cmp = (a.totalApps || 0) - (b.totalApps || 0);
      if (cmp !== 0) return signed * cmp;
      return a.name.localeCompare(b.name);
    });
  }, [items, order]);

  const headerCountLabel =
    devCount === 0 && !loading
      ? null
      : `${devCount} developer${devCount === 1 ? "" : "s"} · ${appCount} app${appCount === 1 ? "" : "s"}`;

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${cfg.tintBorder}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-4 py-3 border-b text-left transition-colors hover:brightness-105 ${cfg.tintBg}`}
        aria-expanded={expanded}
        aria-controls={`${storageKey}-body`}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className={`h-6 w-6 rounded flex items-center justify-center ${cfg.tintIconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.tintIconText}`} />
        </div>
        <h2 className="font-semibold text-sm">{cfg.title}</h2>
        <span className="text-xs text-muted-foreground hidden sm:inline">{cfg.subtitle}</span>
        {headerCountLabel && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {headerCountLabel}
          </span>
        )}
      </button>

      {expanded && (
        <div id={`${storageKey}-body`}>
          {loading ? (
            <div
              data-testid="table-skeleton"
              className="p-4 space-y-2"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <DeveloperSectionEmpty
              icon={Icon}
              title={emptyTitle}
              description={emptyDescription}
              ctaLabel={emptyCtaLabel}
              ctaHref={emptyCtaHref}
            />
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>{cfg.appColLabel}</TableHead>
                  {enabledPlatforms !== undefined && (
                    <TableHead className="w-56">Platforms</TableHead>
                  )}
                  <TableHead className="w-36 text-right">
                    <button
                      onClick={() =>
                        setOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                      }
                      className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                    >
                      App Count <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((dev) => {
                  const visibleApps = platformFilter
                    ? dev.apps.filter((a) => a.platform === platformFilter)
                    : dev.apps;
                  const visiblePlatforms = enabledPlatforms
                    ? dev.platforms.filter((p) => enabledPlatforms.includes(p))
                    : dev.platforms;
                  return (
                    <TableRow key={dev.id}>
                      <TableCell className="w-10">
                        {dev.isStarred && (
                          <Bookmark className="h-4 w-4 fill-amber-500 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={developerHref(dev.slug)} className="font-medium hover:underline">
                          {dev.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {visibleApps.map((app) => (
                            <Link
                              key={`${app.platform}-${app.slug}`}
                              href={`/${app.platform}/apps/${app.slug}`}
                             
                              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                              title={app.name}
                            >
                              <AppIcon src={app.iconUrl} className="w-4 h-4 rounded shrink-0" size={16} />
                              <span className="truncate max-w-[120px]">{app.name}</span>
                            </Link>
                          ))}
                        </div>
                      </TableCell>
                      {enabledPlatforms !== undefined && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {visiblePlatforms.map((p) => (
                              <PlatformBadgeCell key={p} platform={p} />
                            ))}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {dev.totalApps || 0}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function DeveloperSectionEmpty({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      <Link href={ctaHref}>
        <Button variant="outline" size="sm">
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}
