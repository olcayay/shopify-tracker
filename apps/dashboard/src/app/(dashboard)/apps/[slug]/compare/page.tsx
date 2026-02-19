"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
  latestSnapshot: {
    appIntroduction: string;
    appDetails: string;
    features: string[];
    languages: string[];
    integrations: string[];
    pricingPlans: any[];
    categories: any[];
    seoTitle: string;
    seoMetaDescription: string;
    averageRating: string | null;
    ratingCount: number | null;
  } | null;
}

interface CategoryRanking {
  categorySlug: string;
  categoryTitle: string;
  position: number;
}

function CharBadge({ count, max }: { count: number; max?: number }) {
  let colorClass = "border-muted-foreground text-muted-foreground";
  if (max) {
    const pct = count / max;
    if (pct > 1) {
      colorClass = "border-red-600 text-red-600";
    } else if (pct >= 0.9) {
      colorClass = "border-green-600 text-green-600";
    } else if (pct >= 0.8) {
      colorClass = "border-lime-600 text-lime-600";
    } else if (pct >= 0.7) {
      colorClass = "border-yellow-600 text-yellow-600";
    } else if (pct >= 0.6) {
      colorClass = "border-orange-500 text-orange-500";
    } else {
      colorClass = "border-red-600 text-red-600";
    }
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-xs ml-2 shrink-0", colorClass)}
    >
      {count}{max ? `/${max}` : ""} chars
    </Badge>
  );
}

function AppIcon({
  app,
  selected,
  onClick,
  isMain,
  size = "md",
}: {
  app: { slug: string; name: string; iconUrl: string | null };
  selected: boolean;
  onClick?: () => void;
  isMain?: boolean;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={onClick}
        disabled={isMain}
        className={cn(
          "relative rounded-lg transition-all shrink-0",
          sizeClass,
          selected
            ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
            : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0",
          isMain && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background cursor-default"
        )}
      >
        {app.iconUrl ? (
          <img
            src={app.iconUrl}
            alt={app.name}
            className={cn("rounded-lg", sizeClass)}
          />
        ) : (
          <div
            className={cn(
              "rounded-lg bg-muted flex items-center justify-center text-xs font-bold",
              sizeClass
            )}
          >
            {app.name.charAt(0)}
          </div>
        )}
        {selected && !isMain && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </button>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </div>
  );
}

function LinkedAppIcon({
  app,
}: {
  app: { slug: string; name: string; iconUrl: string | null };
}) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group relative inline-flex flex-col items-center"
    >
      {app.iconUrl ? (
        <img
          src={app.iconUrl}
          alt={app.name}
          className="h-6 w-6 rounded"
        />
      ) : (
        <span className="text-xs font-bold">{app.name.charAt(0)}</span>
      )}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </Link>
  );
}

function CompareSection({
  title,
  sectionKey,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => onToggle(sectionKey)}
      >
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </div>
      </CardHeader>
      {!collapsed && <CardContent>{children}</CardContent>}
    </Card>
  );
}

export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { fetchWithAuth } = useAuth();

  const [mainApp, setMainApp] = useState<AppData | null>(null);
  const [competitors, setCompetitors] = useState<
    { slug: string; name: string; iconUrl: string | null }[]
  >([]);
  const [competitorData, setCompetitorData] = useState<Map<string, AppData>>(
    new Map()
  );
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [rankingsData, setRankingsData] = useState<Map<string, CategoryRanking[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [activeDetailSlug, setActiveDetailSlug] = useState<string>("");

  // Collapsible sections — persisted globally
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => {
      try {
        const saved = localStorage.getItem("compare-collapsed");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
        return new Set();
      }
    }
  );

  // Track whether initial selection was loaded from localStorage
  const selectionInitialized = useRef(false);

  useEffect(() => {
    localStorage.setItem(
      "compare-collapsed",
      JSON.stringify([...collapsedSections])
    );
  }, [collapsedSections]);

  // Persist selected slugs per app
  useEffect(() => {
    if (selectionInitialized.current && competitors.length > 0) {
      localStorage.setItem(
        `compare-selected-${slug}`,
        JSON.stringify([...selectedSlugs])
      );
    }
  }, [selectedSlugs, slug, competitors.length]);

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);
    selectionInitialized.current = false;

    // Fetch main app + competitor list in parallel
    const [appRes, compRes] = await Promise.all([
      fetchWithAuth(`/api/apps/${encodeURIComponent(slug)}`),
      fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors`
      ),
    ]);

    let mainAppData: AppData | null = null;
    let compList: { slug: string; name: string; iconUrl: string | null }[] = [];

    if (appRes.ok) {
      mainAppData = await appRes.json();
      setMainApp(mainAppData);
      setActiveDetailSlug(mainAppData!.slug);
    }

    if (compRes.ok) {
      const comps = await compRes.json();
      compList = comps.map((c: any) => ({
        slug: c.appSlug,
        name: c.appName || c.appSlug,
        iconUrl: c.iconUrl,
      }));
      setCompetitors(compList);

      // Restore saved selection or default to all
      try {
        const saved = localStorage.getItem(`compare-selected-${slug}`);
        if (saved) {
          const savedArr: string[] = JSON.parse(saved);
          const validSlugs = new Set(
            savedArr.filter((s) => compList.some((c) => c.slug === s))
          );
          setSelectedSlugs(
            validSlugs.size > 0
              ? validSlugs
              : new Set(compList.map((c) => c.slug))
          );
        } else {
          setSelectedSlugs(new Set(compList.map((c) => c.slug)));
        }
      } catch {
        setSelectedSlugs(new Set(compList.map((c) => c.slug)));
      }
    }

    // Fetch full data for all competitors in parallel
    if (compList.length > 0) {
      const results = await Promise.all(
        compList.map(async (c) => {
          const res = await fetchWithAuth(
            `/api/apps/${encodeURIComponent(c.slug)}`
          );
          if (res.ok) {
            const data: AppData = await res.json();
            return [c.slug, data] as [string, AppData];
          }
          return null;
        })
      );

      const map = new Map<string, AppData>();
      for (const r of results) {
        if (r) map.set(r[0], r[1]);
      }
      setCompetitorData(map);
    }

    // Fetch category rankings for all apps in parallel
    const allSlugs = [slug, ...compList.map((c) => c.slug)];
    const rankingResults = await Promise.all(
      allSlugs.map(async (s) => {
        const res = await fetchWithAuth(
          `/api/apps/${encodeURIComponent(s)}/rankings?days=7`
        );
        if (res.ok) {
          const data = await res.json();
          // Get latest position per category (ordered asc by scrapedAt, so last wins)
          const latestPerCat = new Map<string, CategoryRanking>();
          for (const r of data.categoryRankings || []) {
            latestPerCat.set(r.categorySlug, {
              categorySlug: r.categorySlug,
              categoryTitle: r.categoryTitle,
              position: r.position,
            });
          }
          return [s, [...latestPerCat.values()]] as [string, CategoryRanking[]];
        }
        return [s, []] as [string, CategoryRanking[]];
      })
    );
    const rankMap = new Map<string, CategoryRanking[]>();
    for (const [s, rankings] of rankingResults) {
      rankMap.set(s, rankings);
    }
    setRankingsData(rankMap);

    selectionInitialized.current = true;
    setLoading(false);
  }

  function toggleCompetitor(compSlug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(compSlug)) {
        next.delete(compSlug);
      } else {
        next.add(compSlug);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSlugs.size === competitors.length) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(competitors.map((c) => c.slug)));
    }
  }

  // Build ordered list of selected apps (main first, then selected competitors)
  const selectedApps = useMemo(() => {
    const apps: AppData[] = [];
    if (mainApp) apps.push(mainApp);
    for (const c of competitors) {
      if (selectedSlugs.has(c.slug) && competitorData.has(c.slug)) {
        apps.push(competitorData.get(c.slug)!);
      }
    }
    return apps;
  }, [mainApp, competitors, selectedSlugs, competitorData]);

  const isCollapsed = (key: string) => collapsedSections.has(key);

  if (loading) {
    return (
      <p className="text-muted-foreground text-center py-8">Loading...</p>
    );
  }

  if (!mainApp) {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  if (competitors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            No competitors to compare. Add competitors first from the
            Competitors tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* App Selector Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 flex-wrap pb-4">
            <AppIcon
              app={{
                slug: mainApp.slug,
                name: mainApp.name,
                iconUrl: mainApp.iconUrl,
              }}
              selected
              isMain
            />
            <div className="w-px h-8 bg-border" />
            {competitors.map((c) => (
              <AppIcon
                key={c.slug}
                app={c}
                selected={selectedSlugs.has(c.slug)}
                onClick={() => toggleCompetitor(c.slug)}
              />
            ))}
            <button
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors"
            >
              {selectedSlugs.size === competitors.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>
        </CardContent>
      </Card>

      {selectedApps.length <= 1 && (
        <p className="text-muted-foreground text-center py-4 text-sm">
          Select at least one competitor to compare.
        </p>
      )}

      {selectedApps.length > 1 && (
        <>
          {/* App Name */}
          <VerticalListSection
            title="App Name"
            sectionKey="appName"
            collapsed={isCollapsed("appName")}
            onToggle={toggleSection}
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => (
              <div className="flex items-center">
                <span className="text-sm font-medium">{app.name}</span>
                <CharBadge count={app.name.length} max={30} />
              </div>
            )}
          </VerticalListSection>

          {/* App Card Subtitle */}
          <VerticalListSection
            title="App Card Subtitle"
            sectionKey="appCardSubtitle"
            collapsed={isCollapsed("appCardSubtitle")}
            onToggle={toggleSection}
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => (
              <div className="flex items-center">
                <span className="text-sm">
                  {app.appCardSubtitle || "—"}
                </span>
                {app.appCardSubtitle && (
                  <CharBadge count={app.appCardSubtitle.length} max={62} />
                )}
              </div>
            )}
          </VerticalListSection>

          {/* App Introduction */}
          <VerticalListSection
            title="App Introduction"
            sectionKey="appIntroduction"
            collapsed={isCollapsed("appIntroduction")}
            onToggle={toggleSection}
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => (
              <div>
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1">
                    {app.latestSnapshot?.appIntroduction || "—"}
                  </p>
                  {app.latestSnapshot?.appIntroduction && (
                    <CharBadge
                      count={app.latestSnapshot.appIntroduction.length}
                      max={100}
                    />
                  )}
                </div>
              </div>
            )}
          </VerticalListSection>

          {/* App Details — icon-tab mode */}
          <CompareSection
            title="App Details"
            sectionKey="appDetails"
            collapsed={isCollapsed("appDetails")}
            onToggle={toggleSection}
          >
            <div className="flex items-center gap-2 mb-4">
              {selectedApps.map((app) => (
                <AppIcon
                  key={app.slug}
                  app={{
                    slug: app.slug,
                    name: app.name,
                    iconUrl: app.iconUrl,
                  }}
                  selected={activeDetailSlug === app.slug}
                  onClick={() => setActiveDetailSlug(app.slug)}
                  size="sm"
                  isMain={false}
                />
              ))}
            </div>
            {(() => {
              const active = selectedApps.find(
                (a) => a.slug === activeDetailSlug
              );
              if (!active?.latestSnapshot?.appDetails) {
                return (
                  <p className="text-sm text-muted-foreground">
                    No app details available.
                  </p>
                );
              }
              return (
                <div>
                  <CharBadge
                    count={active.latestSnapshot.appDetails.length}
                    max={500}
                  />
                  <p className="text-sm mt-2 whitespace-pre-line">
                    {active.latestSnapshot.appDetails}
                  </p>
                </div>
              );
            })()}
          </CompareSection>

          {/* Features */}
          <CompareSection
            title="Features"
            sectionKey="features"
            collapsed={isCollapsed("features")}
            onToggle={toggleSection}
          >
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                      #
                    </th>
                    {selectedApps.map((app) => (
                      <th key={app.slug} className="py-2 px-2 pb-6 min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                        <div className="flex justify-center">
                          <LinkedAppIcon app={app} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
                    length: Math.max(
                      ...selectedApps.map(
                        (a) => a.latestSnapshot?.features?.length || 0
                      )
                    ),
                  }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground align-top w-[160px] min-w-[160px]">
                        {i + 1}
                      </td>
                      {selectedApps.map((app) => {
                        const feat = app.latestSnapshot?.features?.[i];
                        return (
                          <td
                            key={app.slug}
                            className="py-2 px-2 align-top"
                          >
                            {feat ? (
                              <div className="flex items-start gap-1">
                                <span className="flex-1">{feat}</span>
                                <CharBadge count={feat.length} max={80} />
                              </div>
                            ) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CompareSection>

          {/* Languages */}
          <BadgeComparisonSection
            title="Languages"
            sectionKey="languages"
            collapsed={isCollapsed("languages")}
            onToggle={toggleSection}
            apps={selectedApps}
            getItems={(app) => app.latestSnapshot?.languages || []}
          />

          {/* Integrations */}
          <BadgeComparisonSection
            title="Integrations"
            sectionKey="integrations"
            collapsed={isCollapsed("integrations")}
            onToggle={toggleSection}
            apps={selectedApps}
            getItems={(app) => app.latestSnapshot?.integrations || []}
          />

          {/* Category Ranking */}
          <CategoryRankingSection
            sectionKey="categoryRanking"
            collapsed={isCollapsed("categoryRanking")}
            onToggle={toggleSection}
            apps={selectedApps}
            rankingsData={rankingsData}
          />

          {/* Reviews and Ratings */}
          <ReviewsRatingsSection
            sectionKey="reviewsRatings"
            collapsed={isCollapsed("reviewsRatings")}
            onToggle={toggleSection}
            apps={selectedApps}
          />

          {/* Categories & Features */}
          <CategoriesComparison
            sectionKey="categoriesFeatures"
            collapsed={isCollapsed("categoriesFeatures")}
            onToggle={toggleSection}
            apps={selectedApps}
          />

          {/* Pricing Plans */}
          <PricingComparison
            sectionKey="pricingPlans"
            collapsed={isCollapsed("pricingPlans")}
            onToggle={toggleSection}
            apps={selectedApps}
          />

          {/* Web Search Content */}
          <VerticalListSection
            title="Web Search Content"
            sectionKey="webSearchContent"
            collapsed={isCollapsed("webSearchContent")}
            onToggle={toggleSection}
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => {
              const s = app.latestSnapshot;
              if (!s?.seoTitle && !s?.seoMetaDescription) {
                return <span className="text-sm text-muted-foreground">—</span>;
              }
              return (
                <div className="space-y-2">
                  {s?.seoTitle && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Title Tag
                      </span>
                      <CharBadge count={s.seoTitle.length} max={60} />
                      <p className="text-sm mt-0.5">{s.seoTitle}</p>
                    </div>
                  )}
                  {s?.seoMetaDescription && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Meta Description
                      </span>
                      <CharBadge count={s.seoMetaDescription.length} max={160} />
                      <p className="text-sm mt-0.5">{s.seoMetaDescription}</p>
                    </div>
                  )}
                </div>
              );
            }}
          </VerticalListSection>
        </>
      )}
    </div>
  );
}

// --- Reusable Section Components ---

function VerticalListSection({
  title,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  mainSlug,
  children,
}: {
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  mainSlug: string;
  children: (app: AppData) => React.ReactNode;
}) {
  return (
    <CompareSection
      title={title}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.slug}
            className={cn(
              "flex items-start gap-3 p-2 rounded-md",
              app.slug === mainSlug && "bg-muted/50"
            )}
          >
            <Link href={`/apps/${app.slug}`} title={app.name} className="shrink-0 mt-0.5">
              {app.iconUrl ? (
                <img
                  src={app.iconUrl}
                  alt={app.name}
                  className="h-6 w-6 rounded"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold">
                  {app.name.charAt(0)}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">{children(app)}</div>
          </div>
        ))}
      </div>
    </CompareSection>
  );
}

function BadgeComparisonSection({
  title,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  getItems,
}: {
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  getItems: (app: AppData) => string[];
}) {
  // Collect all unique items
  const allItems = useMemo(() => {
    const set = new Set<string>();
    for (const app of apps) {
      for (const item of getItems(app)) set.add(item);
    }
    return [...set].sort();
  }, [apps, getItems]);

  // Build presence map
  const presenceMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of allItems) {
      const appSlugs = new Set<string>();
      for (const app of apps) {
        if (getItems(app).includes(item)) appSlugs.add(app.slug);
      }
      map.set(item, appSlugs);
    }
    return map;
  }, [allItems, apps, getItems]);

  if (allItems.length === 0) return null;

  return (
    <CompareSection
      title={title}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                {title}
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((item) => (
              <tr key={item} className="border-b last:border-0">
                <td className="py-1.5 pr-4 w-[160px] min-w-[160px]">
                  <Badge variant="outline" className="text-xs">
                    {item}
                  </Badge>
                </td>
                {apps.map((app) => (
                  <td key={app.slug} className="py-1.5 px-2 text-center">
                    {presenceMap.get(item)?.has(app.slug) ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}

function PricingComparison({
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  // Split each app's plans into free + paid (sorted by price ascending)
  const appPlans = useMemo(() => {
    return apps.map((app) => {
      const plans = app.latestSnapshot?.pricingPlans || [];
      const free = plans.filter((p: any) => !p.price || Number(p.price) === 0);
      const paid = plans
        .filter((p: any) => p.price && Number(p.price) > 0)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price));
      return { free, paid };
    });
  }, [apps]);

  const hasAnyFree = appPlans.some((ap) => ap.free.length > 0);
  const maxPaid = Math.max(...appPlans.map((ap) => ap.paid.length), 0);
  const totalRows = (hasAnyFree ? 1 : 0) + maxPaid;

  if (totalRows === 0) return null;

  return (
    <CompareSection
      title="Pricing Plans"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                Tier
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasAnyFree && (
              <tr className="border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground font-medium">
                  Free
                </td>
                {appPlans.map((ap, idx) => (
                  <td key={apps[idx].slug} className="py-2 px-2">
                    {ap.free.length > 0 ? (
                      <PlanCard plan={ap.free[0]} />
                    ) : (
                      <div className="text-muted-foreground text-center">—</div>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {Array.from({ length: maxPaid }).map((_, rowIdx) => (
              <tr key={`paid-${rowIdx}`} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 text-muted-foreground font-medium">
                  {hasAnyFree ? `Paid ${rowIdx + 1}` : `Plan ${rowIdx + 1}`}
                </td>
                {appPlans.map((ap, idx) => (
                  <td key={apps[idx].slug} className="py-2 px-2">
                    {ap.paid[rowIdx] ? (
                      <PlanCard plan={ap.paid[rowIdx]} />
                    ) : (
                      <div className="text-muted-foreground text-center">—</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}

function PlanCard({ plan }: { plan: any }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold">{plan.name}</div>
      <div className="text-lg font-bold mt-1">
        {plan.price ? `$${plan.price}/${plan.period || "mo"}` : "Free"}
      </div>
      {plan.trial_text && (
        <p className="text-xs text-muted-foreground mt-1">
          {plan.trial_text}
        </p>
      )}
      {plan.features?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {plan.features.map((f: string, j: number) => (
            <li key={j} className="text-xs text-muted-foreground">
              • {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRankingSection({
  sectionKey,
  collapsed,
  onToggle,
  apps,
  rankingsData,
}: {
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  rankingsData: Map<string, CategoryRanking[]>;
}) {
  // Build per-app ranking lookup: appSlug → categorySlug → position
  const appRankingMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const app of apps) {
      const rankings = rankingsData.get(app.slug) || [];
      const catMap = new Map<string, number>();
      for (const r of rankings) {
        catMap.set(r.categorySlug, r.position);
      }
      map.set(app.slug, catMap);
    }
    return map;
  }, [apps, rankingsData]);

  // Get primary category per app (first category from snapshot)
  const appPrimaryCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of apps) {
      const cats = app.latestSnapshot?.categories || [];
      if (cats.length > 0) {
        map.set(app.slug, cats[0].title || "—");
      }
    }
    return map;
  }, [apps]);

  // Collect all unique categories across all apps' rankings
  const allCategories = useMemo(() => {
    const catMap = new Map<string, string>(); // slug → title
    for (const app of apps) {
      for (const r of rankingsData.get(app.slug) || []) {
        if (!catMap.has(r.categorySlug)) {
          catMap.set(r.categorySlug, r.categoryTitle);
        }
      }
    }
    return [...catMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [apps, rankingsData]);

  if (allCategories.length === 0) return null;

  return (
    <CompareSection
      title="Category Ranking"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]" />
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px]">
                App category
              </td>
              {apps.map((app) => (
                <td key={app.slug} className="py-2 px-2 text-center font-medium">
                  {appPrimaryCategory.get(app.slug) || "—"}
                </td>
              ))}
            </tr>
            {allCategories.map(([catSlug, catTitle]) => (
              <tr key={catSlug} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    href={`/categories/${catSlug}`}
                    className="text-primary hover:underline"
                  >
                    {catTitle}
                  </Link>
                </td>
                {apps.map((app) => {
                  const pos = appRankingMap.get(app.slug)?.get(catSlug);
                  return (
                    <td key={app.slug} className="py-2 px-2 text-center">
                      {pos != null ? (
                        <span className="font-bold">{pos}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));
        return (
          <div key={star} className="relative h-4 w-4">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-muted-foreground/30"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-yellow-500"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReviewsRatingsSection({
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  const hasAnyRatings = apps.some(
    (a) => a.latestSnapshot?.averageRating != null
  );
  if (!hasAnyRatings) return null;

  return (
    <CompareSection
      title="Reviews and Ratings"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px]" />
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px]">
                Average rating
              </td>
              {apps.map((app) => {
                const rating = app.latestSnapshot?.averageRating
                  ? Number(app.latestSnapshot.averageRating)
                  : null;
                return (
                  <td key={app.slug} className="py-2 px-2 text-center">
                    {rating != null ? (
                      <div className="flex flex-col items-center gap-1">
                        <StarRating rating={rating} />
                        <span className="font-bold">{rating}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="border-b last:border-0">
              <td className="py-2 pr-4 text-muted-foreground font-medium">
                Ratings number
              </td>
              {apps.map((app) => {
                const count = app.latestSnapshot?.ratingCount;
                return (
                  <td key={app.slug} className="py-2 px-2 text-center">
                    {count != null ? (
                      <span className="font-bold">
                        {count.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}

function CategoriesComparison({
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  // Collect all unique feature handles across all apps
  const allFeatures = useMemo(() => {
    const featureMap = new Map<
      string,
      { title: string; category: string; categorySlug: string | null; subcategory: string }
    >();
    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        const catSlug = cat.url?.match(/\/categories\/([^/?]+)/)?.[1] || null;
        for (const sub of cat.subcategories || []) {
          for (const f of sub.features || []) {
            if (!featureMap.has(f.feature_handle)) {
              featureMap.set(f.feature_handle, {
                title: f.title,
                category: cat.title,
                categorySlug: catSlug,
                subcategory: sub.title,
              });
            }
          }
        }
      }
    }
    return featureMap;
  }, [apps]);

  // Build presence map: feature_handle → set of app slugs
  const featurePresence = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        for (const sub of cat.subcategories || []) {
          for (const f of sub.features || []) {
            if (!map.has(f.feature_handle)) {
              map.set(f.feature_handle, new Set());
            }
            map.get(f.feature_handle)!.add(app.slug);
          }
        }
      }
    }
    return map;
  }, [apps]);

  // Group by category > subcategory
  const grouped = useMemo(() => {
    const result: {
      category: string;
      categorySlug: string | null;
      subcategories: {
        subcategory: string;
        features: { handle: string; title: string }[];
      }[];
    }[] = [];

    const catMap = new Map<
      string,
      { slug: string | null; subMap: Map<string, { handle: string; title: string }[]> }
    >();
    for (const [handle, info] of allFeatures) {
      if (!catMap.has(info.category)) {
        catMap.set(info.category, { slug: info.categorySlug, subMap: new Map() });
      }
      const { subMap } = catMap.get(info.category)!;
      if (!subMap.has(info.subcategory)) subMap.set(info.subcategory, []);
      subMap.get(info.subcategory)!.push({ handle, title: info.title });
    }

    for (const [category, { slug, subMap }] of catMap) {
      const subcategories = [];
      for (const [subcategory, features] of subMap) {
        subcategories.push({ subcategory, features });
      }
      result.push({ category, categorySlug: slug, subcategories });
    }
    return result;
  }, [allFeatures]);

  if (allFeatures.size === 0) return null;

  return (
    <CompareSection
      title="Features"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                Feature
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((cat) => (
              <>
                <tr key={`cat-${cat.category}`}>
                  <td
                    colSpan={apps.length + 1}
                    className="pt-4 pb-1 font-semibold text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {cat.categorySlug ? (
                      <Link href={`/categories/${cat.categorySlug}`} className="hover:text-foreground transition-colors">
                        {cat.category}
                      </Link>
                    ) : (
                      cat.category
                    )}
                  </td>
                </tr>
                {cat.subcategories.map((sub) => (
                  <>
                    <tr key={`sub-${cat.category}-${sub.subcategory}`}>
                      <td
                        colSpan={apps.length + 1}
                        className="pt-2 pb-1 pl-2 text-xs font-medium text-muted-foreground"
                      >
                        {sub.subcategory}
                      </td>
                    </tr>
                    {sub.features.map((f) => (
                      <tr
                        key={f.handle}
                        className="border-b last:border-0"
                      >
                        <td className="py-1 pl-4 pr-4">
                          <Link
                            href={`/features/${encodeURIComponent(f.handle)}`}
                            className="text-primary hover:underline"
                          >
                            {f.title}
                          </Link>
                        </td>
                        {apps.map((app) => (
                          <td
                            key={app.slug}
                            className="py-1 px-2 text-center"
                          >
                            {featurePresence.get(f.handle)?.has(app.slug) ? (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
