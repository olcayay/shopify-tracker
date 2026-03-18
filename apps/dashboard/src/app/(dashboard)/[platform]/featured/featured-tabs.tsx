"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdHeatmap } from "@/components/ad-heatmap";
import { AppIcon } from "@/components/app-icon";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Star } from "lucide-react";
import { buildExternalCategoryUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";

interface SectionSummary {
  surface: string;
  surfaceDetail: string;
  sectionHandle: string;
  sectionTitle: string;
  appCount: number;
  daysActive: number;
  lastSeen: string;
}

interface CategoryOption {
  slug: string;
  title: string;
}

interface SightingGroup {
  surface: string;
  surfaceDetail: string;
  sectionHandle: string;
  sectionTitle: string;
  sightings: {
    slug: string;
    name: string;
    seenDate: string;
    timesSeenInDay: number;
    iconUrl?: string;
  }[];
}

interface CategoryL1Group {
  slug: string;
  title: string;
  groups: SightingGroup[];
}

interface FeaturedTabsProps {
  homeSightings: any[];
  trackedSlugs: string[];
  competitorSlugs: string[];
  sections: SectionSummary[];
  categoryOptions: CategoryOption[];
  categoryTitles: Record<string, string>;
  l1Slugs: string[];
}

const HOMEPAGE_VALUE = "__homepage__";
const STORAGE_KEY = "featured-selected";

function groupSightings(sightings: any[]): SightingGroup[] {
  const grouped = new Map<string, SightingGroup>();

  for (const s of sightings) {
    const key = `${s.surface}:${s.surfaceDetail}:${s.sectionHandle}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        surface: s.surface,
        surfaceDetail: s.surfaceDetail,
        sectionHandle: s.sectionHandle,
        sectionTitle: s.sectionTitle || s.sectionHandle,
        sightings: [],
      });
    }
    grouped.get(key)!.sightings.push({
      slug: s.appSlug,
      name: s.appName,
      seenDate: s.seenDate,
      timesSeenInDay: s.timesSeenInDay ?? 1,
      iconUrl: s.iconUrl,
    });
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.surfaceDetail !== b.surfaceDetail)
      return a.surfaceDetail.localeCompare(b.surfaceDetail);
    return a.sectionHandle.localeCompare(b.sectionHandle);
  });
}

function SectionCard({
  group,
  trackedSlugs,
  competitorSlugs,
  id,
}: {
  group: SightingGroup;
  trackedSlugs: string[];
  competitorSlugs: string[];
  id?: string;
}) {
  const { platform } = useParams();
  const externalUrl =
    group.surface === "category"
      ? buildExternalCategoryUrl(platform as PlatformId, group.surfaceDetail)
      : group.surfaceDetail && group.surfaceDetail !== "home"
        ? buildExternalCategoryUrl(platform as PlatformId, group.surfaceDetail)
        : PLATFORMS[platform as PlatformId].baseUrl;

  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {group.sectionTitle}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AdHeatmap
          sightings={group.sightings}
          linkPrefix={`/${platform}/apps/`}
          trackedSlugs={trackedSlugs}
          competitorSlugs={competitorSlugs}
          initialVisible={12}
        />
      </CardContent>
    </Card>
  );
}

function SectionNav({ groups }: { groups: SightingGroup[] }) {
  const { platform } = useParams();

  const scrollTo = (handle: string) => {
    const el = document.getElementById(`section-${handle}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {groups.map((g) => {
            const uniqueApps = new Set(g.sightings.map((s) => s.slug)).size;
            const externalUrl =
              g.surfaceDetail && g.surfaceDetail !== "home"
                ? buildExternalCategoryUrl(platform as PlatformId, g.surfaceDetail)
                : PLATFORMS[platform as PlatformId].baseUrl;
            return (
              <span key={g.sectionHandle} className="inline-flex items-center gap-1.5 text-sm">
                <button
                  onClick={() => scrollTo(g.sectionHandle)}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  {g.sectionTitle}
                </button>
                <span className="text-muted-foreground text-xs">({uniqueApps})</span>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface MyFeaturedApp {
  slug: string;
  name: string;
  iconUrl?: string;
  type: "tracked" | "competitor";
  sections: {
    sectionHandle: string;
    sectionTitle: string;
    lastSeen: string;
    dates: Set<string>;
  }[];
}

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function MiniHeatmap({ dates, dateRange }: { dates: Set<string>; dateRange: string[] }) {
  return (
    <div className="flex gap-[2px]">
      {dateRange.map((d) => (
        <div
          key={d}
          title={d}
          className={cn(
            "w-[10px] h-[10px] rounded-[2px]",
            dates.has(d) ? "bg-primary/70" : "bg-muted/50"
          )}
        />
      ))}
    </div>
  );
}

function MyFeaturedApps({
  sightings,
  trackedSlugs,
  competitorSlugs,
}: {
  sightings: any[];
  trackedSlugs: string[];
  competitorSlugs: string[];
}) {
  const { platform } = useParams();
  const trackedSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const competitorSet = useMemo(() => new Set(competitorSlugs), [competitorSlugs]);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const dateRange = useMemo(() => buildDateRange(30), []);

  const toggleExpanded = (slug: string) => {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const myApps = useMemo((): MyFeaturedApp[] => {
    const appMap = new Map<string, MyFeaturedApp>();

    for (const s of sightings) {
      const slug = s.appSlug;
      const isTracked = trackedSet.has(slug);
      const isCompetitor = competitorSet.has(slug);
      if (!isTracked && !isCompetitor) continue;

      if (!appMap.has(slug)) {
        appMap.set(slug, {
          slug,
          name: s.appName,
          iconUrl: s.iconUrl,
          type: isTracked ? "tracked" : "competitor",
          sections: [],
        });
      }

      const app = appMap.get(slug)!;
      const sectionKey = s.sectionHandle;
      let section = app.sections.find((sec) => sec.sectionHandle === sectionKey);
      if (!section) {
        section = {
          sectionHandle: s.sectionHandle,
          sectionTitle: s.sectionTitle || s.sectionHandle,
          lastSeen: s.seenDate,
          dates: new Set<string>(),
        };
        app.sections.push(section);
      }
      section.dates.add(s.seenDate);
      if (s.seenDate > section.lastSeen) section.lastSeen = s.seenDate;
    }

    return [...appMap.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "tracked" ? -1 : 1;
      return b.sections.length - a.sections.length;
    });
  }, [sightings, trackedSet, competitorSet]);

  if (myApps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          My Featured Apps and Competitors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {myApps.map((app) => {
            const isExpanded = expandedApps.has(app.slug);
            return (
              <div
                key={app.slug}
                className={cn(
                  "rounded-lg border",
                  app.type === "tracked"
                    ? "border-l-2 border-l-emerald-500 bg-emerald-500/5"
                    : "border-l-2 border-l-amber-500 bg-amber-500/5"
                )}
              >
                <button
                  onClick={() => toggleExpanded(app.slug)}
                  className="flex items-center gap-3 w-full p-3 text-left cursor-pointer hover:bg-accent/30 transition-colors rounded-lg"
                >
                  <AppIcon src={app.iconUrl} alt={app.name} className="h-8 w-8 rounded shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/${platform}/apps/${app.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-sm text-primary hover:underline truncate"
                      >
                        {app.name}
                      </Link>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          app.type === "tracked"
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50"
                        )}
                      >
                        {app.type === "tracked" ? "Tracked" : "Competitor"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {app.sections.length} {app.sections.length === 1 ? "section" : "sections"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {app.sections.map((sec) => (
                        <span
                          key={sec.sectionHandle}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {sec.sectionTitle}
                          <span className="text-[10px] opacity-70">
                            ({sec.dates.size}d)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 space-y-2">
                    {app.sections.map((sec) => (
                      <div key={sec.sectionHandle} className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const el = document.getElementById(`section-${sec.sectionHandle}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="text-xs font-medium text-primary hover:underline cursor-pointer w-[140px] shrink-0 truncate text-left"
                          title={sec.sectionTitle}
                        >
                          {sec.sectionTitle}
                        </button>
                        <MiniHeatmap dates={sec.dates} dateRange={dateRange} />
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {sec.dates.size}/30d
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="w-[140px] shrink-0" />
                      <div className="flex justify-between text-[10px] text-muted-foreground" style={{ width: `${30 * 12}px` }}>
                        <span>{dateRange[0]}</span>
                        <span>{dateRange[dateRange.length - 1]}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function FeaturedTabs({
  homeSightings,
  trackedSlugs,
  competitorSlugs,
  sections,
  categoryOptions,
  categoryTitles,
  l1Slugs,
}: FeaturedTabsProps) {
  const { platform } = useParams();
  const { fetchWithAuth } = useAuth();
  const validSlugs = useMemo(
    () => new Set([HOMEPAGE_VALUE, ...categoryOptions.map((c) => c.slug)]),
    [categoryOptions]
  );
  const [selected, setSelected] = useState(() => {
    if (typeof window === "undefined") return HOMEPAGE_VALUE;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && validSlugs.has(stored) ? stored : HOMEPAGE_VALUE;
  });
  const [categoryData, setCategoryData] = useState<{
    sightings: any[];
    trackedSlugs: string[];
    competitorSlugs: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const isHomepage = selected === HOMEPAGE_VALUE;

  const homeGroups = useMemo(
    () => groupSightings(homeSightings),
    [homeSightings]
  );

  const categoryGroups = useMemo(
    () => (categoryData ? groupSightings(categoryData.sightings) : []),
    [categoryData]
  );

  // Group category results by L1
  const categoryL1Groups = useMemo((): CategoryL1Group[] => {
    if (!categoryGroups.length || isHomepage) return [];

    const findL1Parent = (slug: string): string | null => {
      if (l1Slugs.includes(slug)) return slug;
      return l1Slugs.find((l1) => slug.startsWith(l1 + "-")) || null;
    };

    const l0Groups: SightingGroup[] = [];
    const l1Map = new Map<string, SightingGroup[]>();

    for (const group of categoryGroups) {
      if (group.surfaceDetail === selected) {
        l0Groups.push(group);
      } else {
        const parentL1 = findL1Parent(group.surfaceDetail);
        const key = parentL1 || group.surfaceDetail;
        const existing = l1Map.get(key) || [];
        existing.push(group);
        l1Map.set(key, existing);
      }
    }

    const result: CategoryL1Group[] = [];

    if (l0Groups.length > 0) {
      const l0Title = categoryTitles[selected] || selected;
      result.push({ slug: selected, title: l0Title, groups: l0Groups });
    }

    const sortedL1 = [...l1Map.entries()].sort(([a], [b]) => {
      const titleA = categoryTitles[a] || a;
      const titleB = categoryTitles[b] || b;
      return titleA.localeCompare(titleB);
    });

    for (const [slug, groups] of sortedL1) {
      const title = categoryTitles[slug] || slug;
      result.push({ slug, title, groups });
    }

    return result;
  }, [categoryGroups, selected, categoryTitles, l1Slugs, isHomepage]);

  // Stats for current view
  const stats = useMemo(() => {
    if (isHomepage) {
      const homeSections = sections.filter((s) => s.surface === "home");
      const uniqueApps = new Set(homeSightings.map((s: any) => s.appSlug)).size;
      return { sectionCount: homeSections.length, uniqueApps };
    }
    if (!categoryData) return null;
    const uniqueApps = new Set(
      categoryData.sightings.map((s: any) => s.appSlug)
    ).size;
    return { sectionCount: categoryGroups.length, uniqueApps };
  }, [isHomepage, sections, homeSightings, categoryData, categoryGroups]);

  const loadCategory = useCallback(
    async (slug: string) => {
      if (slug === loadedSlug) return;
      setLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/featured-apps?days=30&surface=category&surfaceDetailPrefix=${encodeURIComponent(slug)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCategoryData(data);
          setLoadedSlug(slug);
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth, loadedSlug]
  );

  // Load category data on mount if restored from localStorage
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    if (selected !== HOMEPAGE_VALUE) {
      loadCategory(selected);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (value: string) => {
    setSelected(value);
    localStorage.setItem(STORAGE_KEY, value);
    if (value !== HOMEPAGE_VALUE) {
      loadCategory(value);
    }
  };

  const currentTracked = isHomepage ? trackedSlugs : (categoryData?.trackedSlugs || []);
  const currentCompetitors = isHomepage ? competitorSlugs : (categoryData?.competitorSlugs || []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleChange(HOMEPAGE_VALUE)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            isHomepage
              ? "bg-primary text-primary-foreground"
              : "border border-input hover:bg-accent"
          )}
        >
          Homepage
        </button>
        {categoryOptions.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => handleChange(cat.slug)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              selected === cat.slug
                ? "bg-primary text-primary-foreground"
                : "border border-input hover:bg-accent"
            )}
          >
            {cat.title}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Section quick-nav for homepage groups */}
      {!loading && isHomepage && homeGroups.length > 1 && (
        <SectionNav groups={homeGroups} />
      )}

      {!loading && stats && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{stats.sectionCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Apps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{stats.uniqueApps}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My featured apps summary */}
      {!loading && isHomepage && (
        <MyFeaturedApps
          sightings={homeSightings}
          trackedSlugs={currentTracked}
          competitorSlugs={currentCompetitors}
        />
      )}
      {!loading && !isHomepage && categoryData && (
        <MyFeaturedApps
          sightings={categoryData.sightings}
          trackedSlugs={currentTracked}
          competitorSlugs={currentCompetitors}
        />
      )}

      {/* Homepage content */}
      {!loading && isHomepage && (
        <>
          {homeGroups.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No homepage featured data yet. Run the featured apps scraper to
              collect data.
            </p>
          )}
          {homeGroups.map((group) => (
            <SectionCard
              key={`${group.surface}:${group.surfaceDetail}:${group.sectionHandle}`}
              id={`section-${group.sectionHandle}`}
              group={group}
              trackedSlugs={currentTracked}
              competitorSlugs={currentCompetitors}
            />
          ))}
        </>
      )}

      {/* Category content — grouped by L1 */}
      {!loading && !isHomepage &&
        categoryL1Groups.map((l1Group, idx) => (
          <div key={l1Group.slug} className="space-y-4">
            <div className={idx > 0 ? "pt-4 border-t" : ""}>
              <Link
                href={`/${platform}/categories/${l1Group.slug}`}
                className="text-base font-semibold hover:underline"
              >
                {l1Group.title}
              </Link>
            </div>
            {l1Group.groups.map((group) => (
              <SectionCard
                key={`${group.surface}:${group.surfaceDetail}:${group.sectionHandle}`}
                group={group}
                trackedSlugs={currentTracked}
                competitorSlugs={currentCompetitors}
              />
            ))}
          </div>
        ))}

      {!loading && !isHomepage && categoryL1Groups.length === 0 && loadedSlug && (
        <p className="text-muted-foreground text-center py-8">
          No featured data for this category.
        </p>
      )}
    </div>
  );
}
