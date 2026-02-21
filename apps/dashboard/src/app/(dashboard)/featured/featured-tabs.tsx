"use client";

import Link from "next/link";
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
import { Loader2 } from "lucide-react";

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
}: {
  group: SightingGroup;
  trackedSlugs: string[];
  competitorSlugs: string[];
}) {
  const shopifyUrl =
    group.surface === "category"
      ? `https://apps.shopify.com/categories/${group.surfaceDetail}`
      : "https://apps.shopify.com";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a
            href={shopifyUrl}
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
          linkPrefix="/apps/"
          trackedSlugs={trackedSlugs}
          competitorSlugs={competitorSlugs}
          initialVisible={12}
        />
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
                href={`/categories/${l1Group.slug}`}
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
