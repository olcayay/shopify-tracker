"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlag } from "@/contexts/feature-flags-context";
import { useFormatDate } from "@/lib/format-date";
import { AppSearchBar } from "@/components/app-search-bar";
import { QuickStartCards } from "@/components/quick-start-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Target, Eye, ChevronLeft, ChevronRight, Clock, ArrowLeft, AppWindow, Search, Key, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton, TableSkeleton } from "@/components/skeletons";
import { AppBadgeIcon } from "@/components/app-badges";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";
import { formatNumber, timeAgo } from "@/lib/format-utils";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { PLATFORM_COLORS, SCRAPER_TYPE_LABELS } from "@/lib/platform-display";


const PAGE_SIZE = 10;

// Shared column widths for cross-table vertical alignment
const COL_WIDTH = {
  numeric: 'w-[100px]',   // Total Results, Apps, Rating, Reviews
  badge: 'w-[100px]',     // Tracked, Competitor, Ranked
  text: 'w-[140px]',      // Last Change, Categories, Keywords, Competitors
} as const;

function freshnessColor(
  dateStr: string
): "default" | "secondary" | "destructive" {
  const hours =
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return "default";
  if (hours < 72) return "secondary";
  return "destructive";
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t">
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { platform } = useParams();
  const { fetchWithAuth, user, account, refreshUser, isLoading: authLoading } = useAuth();
  const hasResearch = useFeatureFlag("market-research");
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [appCategories, setAppCategories] = useState<Record<string, { title: string; slug: string; position: number | null }[]>>({});
  const [systemStats, setSystemStats] = useState<any>(null);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";
  const caps = PLATFORMS[platform as PlatformId] || PLATFORMS.shopify;
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isPlatformEnabled = enabledPlatforms.includes(platform as PlatformId);

  const trackedSlugs = useMemo(() => new Set(apps.map((a: any) => a.slug)), [apps]);
  const competitorSlugs = useMemo(() => new Set(competitors.map((c: any) => c.appSlug)), [competitors]);

  // Pagination state
  const [appsPage, setAppsPage] = useState(0);
  const [keywordsPage, setKeywordsPage] = useState(0);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [competitorsPage, setCompetitorsPage] = useState(0);
  const [featuresPage, setFeaturesPage] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(0);

  useEffect(() => {
    if (isPlatformEnabled) loadData();
  }, [isPlatformEnabled]);

  // Show skeleton while auth is loading to prevent "Coming Soon" flash
  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // Coming-soon page for non-enabled platforms
  if (!isPlatformEnabled) {
    const platformId = platform as PlatformId;
    const accentColor = PLATFORM_COLORS[platformId] || "#888";
    return (
      <div className="space-y-6">
        <Card className="rounded-xl border-t-4" style={{ borderTopColor: accentColor }}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Coming Soon</CardTitle>
            <CardDescription className="text-base">
              {caps.name} tracking is not yet available on your account. Stay tuned — we are working on it.
            </CardDescription>
          </CardHeader>
        </Card>

        <Link
          href="/overview"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Platforms
        </Link>
      </div>
    );
  }

  async function loadData() {
    setLoading(true);
    const promises: Promise<any>[] = [
      fetchWithAuth("/api/apps").then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth("/api/keywords").then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth("/api/account/competitors").then((r) =>
        r.ok ? r.json() : []
      ),
      fetchWithAuth("/api/account/starred-features").then((r) =>
        r.ok ? r.json() : []
      ),
      fetchWithAuth("/api/account/starred-categories").then((r) =>
        r.ok ? r.json() : []
      ),
    ];

    if (user?.isSystemAdmin) {
      promises.push(
        fetchWithAuth("/api/system-admin/stats").then((r) =>
          r.ok ? r.json() : null
        ),
        fetchWithAuth("/api/system-admin/scraper/runs?limit=10").then((r) =>
          r.ok ? r.json() : []
        )
      );
    }

    const results = await Promise.all(promises);
    const loadedApps = results[0] || [];
    setApps(loadedApps);
    setKeywords(results[1] || []);
    setCompetitors(results[2] || []);
    setFeatures(results[3] || []);
    setCategories(results[4] || []);
    if (user?.isSystemAdmin) {
      setSystemStats(results[5]);
      setRecentRuns(results[6] || []);
    }
    setLoading(false);

    // Fetch categories in background (non-blocking — page already rendered)
    const appSlugs = loadedApps.map((a: any) => a.slug).filter(Boolean);
    if (appSlugs.length > 0) {
      fetchWithAuth("/api/apps/categories", {
        method: "POST",
        body: JSON.stringify({ slugs: appSlugs }),
      }).then(async (catRes) => {
        if (catRes.ok) setAppCategories(await catRes.json());
      }).catch(() => {});
    }
  }

  async function trackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-apps?platform=${platform}`, {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Scraping started — details will appear shortly."
        : "";
      setMessage(`"${name}" added to My Apps.${scrapeMsg}`);
      // Optimistic update: add app to tracked list without full reload
      setApps((prev: any[]) => {
        if (prev.some((a) => a.slug === slug || a.appSlug === slug)) return prev;
        return [...prev, { slug, appSlug: slug, name, platform, isTracked: true }];
      });
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track app");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} cols={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const appsTotalPages = Math.ceil(apps.length / PAGE_SIZE);
  const filteredKeywords = keywordSearch
    ? keywords.filter((kw: any) => kw.keyword.toLowerCase().includes(keywordSearch.toLowerCase()))
    : keywords;
  const keywordsTotalPages = Math.ceil(filteredKeywords.length / PAGE_SIZE);
  const competitorsTotalPages = Math.ceil(competitors.length / PAGE_SIZE);
  const featuresTotalPages = Math.ceil(features.length / PAGE_SIZE);
  const categoriesTotalPages = Math.ceil(categories.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Quick-start cards for new users with zero data */}
      <QuickStartCards
        trackedApps={apps.length}
        trackedKeywords={keywords.length}
        competitors={competitors.length}
      />

      {/* Account Usage Cards - clickable */}
      <AccountUsageCards stats={[
        { key: "apps", ...USAGE_STAT_PRESETS.apps, value: apps.length, limit: account?.limits.maxTrackedApps ?? 0, href: `/${platform}/apps`, show: true },
        { key: "keywords", ...USAGE_STAT_PRESETS.keywords, value: keywords.length, limit: account?.limits.maxTrackedKeywords ?? 0, href: `/${platform}/keywords`, show: caps.hasKeywordSearch },
        { key: "competitors", ...USAGE_STAT_PRESETS.competitors, value: competitors.length, limit: account?.limits.maxCompetitorApps ?? 0, href: `/${platform}/competitors`, show: true },
        { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits?.maxResearchProjects ?? 0, href: `/${platform}/research`, show: hasResearch },
        { key: "users", ...USAGE_STAT_PRESETS.users, value: account?.usage.users ?? 1, limit: account?.limits.maxUsers ?? 0, href: "/settings", show: true },
      ]} />

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* My Apps List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base">My Apps ({apps.length}/{account?.limits.maxTrackedApps})</CardTitle>
            <div className="flex items-center gap-3 sm:ml-auto">
              <AppSearchBar
                mode="follow"
                trackedSlugs={trackedSlugs}
                competitorSlugs={competitorSlugs}
                onFollow={trackApp}
                placeholder="Search apps..."
                className="w-full sm:w-64"
              />
              <Link href={`/${platform}/apps`} className="text-sm text-primary hover:underline shrink-0">
                View all
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <div className="py-6 text-center space-y-4">
              <AppWindow className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div>
                <p className="font-medium mb-1">
                  Start Tracking on {PLATFORMS[platform as PlatformId]?.name || platform}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for your app by name to start tracking rankings, keywords, and competitors.
                </p>
              </div>
              <Link href={`/${platform}/apps`}>
                <Button>Add Your First App</Button>
              </Link>
              <div>
                <Link href="/overview" className="text-xs text-muted-foreground hover:text-foreground">
                  Explore other platforms →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    {caps.hasReviews && <TableHead className={`${COL_WIDTH.numeric} text-right`}>Rating</TableHead>}
                    {caps.hasReviews && <TableHead className={`${COL_WIDTH.numeric} text-right`}>Reviews</TableHead>}
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Competitors</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Keywords</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Ranked</TableHead>
                    <TableHead className={`${COL_WIDTH.text} text-center`}>Categories</TableHead>
                    <TableHead className={`${COL_WIDTH.text}`}>Last Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps
                    .slice(appsPage * PAGE_SIZE, (appsPage + 1) * PAGE_SIZE)
                    .map((app: any) => (
                      <TableRow key={app.slug}>
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2">
                            {app.iconUrl && (
                              <img src={app.iconUrl} alt="" aria-hidden="true" className="h-5 w-5 rounded shrink-0" />
                            )}
                            <Link
                              href={`/${platform}/apps/${app.slug}`}
                              className="text-primary hover:underline font-medium truncate"
                            >
                              {app.name}
                            </Link>
                            <AppBadgeIcon platform={platform as PlatformId} isBuiltForShopify={app.isBuiltForShopify} badges={app.badges} />
                          </div>
                        </TableCell>
                        {caps.hasReviews && (
                          <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums`}>
                            {app.latestSnapshot?.averageRating ?? "\u2014"}
                          </TableCell>
                        )}
                        {caps.hasReviews && (
                          <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums`}>
                            {app.latestSnapshot?.ratingCount != null ? (
                              <Link href={`/${platform}/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                                {app.latestSnapshot.ratingCount}
                              </Link>
                            ) : "\u2014"}
                          </TableCell>
                        )}
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {app.competitorCount ? (
                            <Link href={`/${platform}/apps/${app.slug}/competitors`} className="text-primary hover:underline">
                              {app.competitorCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {app.keywordCount ? (
                            <Link href={`/${platform}/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                              {app.keywordCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {app.keywordCount > 0 ? (
                            <Link href={`/${platform}/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                              {app.rankedKeywordCount}/{app.keywordCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.text} text-center text-sm`}>
                          {appCategories[app.slug]?.length ? (
                            <div className="flex flex-col gap-0.5">
                              {appCategories[app.slug].map((cat) => (
                                <div key={cat.slug} className="flex items-center gap-1">
                                  {cat.position != null && (
                                    <span className="font-medium text-muted-foreground">#{cat.position}</span>
                                  )}
                                  <Link href={`/${platform}/categories/${cat.slug}`} className="text-primary hover:underline">
                                    {cat.title}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.text} text-sm`}>
                          {app.lastChangeAt ? (
                            <Link href={`/${platform}/apps/${app.slug}/changes`} className="text-primary hover:underline">
                              {formatDateOnly(app.lastChangeAt)}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <Pagination page={appsPage} totalPages={appsTotalPages} onPageChange={setAppsPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Tracked Keywords List */}
      {caps.hasKeywordSearch && <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base">
              Tracked Keywords ({keywordSearch ? `${filteredKeywords.length}/` : ""}{keywords.length}/{account?.limits.maxTrackedKeywords})
            </CardTitle>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={keywordSearch}
                  onChange={(e) => { setKeywordSearch(e.target.value); setKeywordsPage(0); }}
                  className="pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background w-48"
                />
              </div>
              <Link href={`/${platform}/keywords`} className="text-sm text-primary hover:underline whitespace-nowrap">
                View all
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 ? (
            <EmptyState
              icon={Key}
              title="No tracked keywords yet"
              description="Track keywords to monitor your app's search rankings."
              action={{ label: "Add Keywords", href: `/${platform}/keywords` }}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className={`${COL_WIDTH.numeric} text-right`}>Total Results</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Tracked</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeywords
                    .slice(keywordsPage * PAGE_SIZE, (keywordsPage + 1) * PAGE_SIZE)
                    .map((kw: any) => (
                      <TableRow key={kw.id}>
                        <TableCell>
                          <Link
                            href={`/${platform}/keywords/${kw.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {kw.keyword}
                          </Link>
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums`}>
                          {kw.latestSnapshot?.totalResults != null ? formatNumber(kw.latestSnapshot.totalResults) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {kw.trackedInResults > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {kw.trackedInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {kw.competitorInResults > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                              <Eye className="h-3 w-3 mr-1" />
                              {kw.competitorInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <Pagination page={keywordsPage} totalPages={keywordsTotalPages} onPageChange={setKeywordsPage} />
            </>
          )}
        </CardContent>
      </Card>}

      {/* Competitor Apps List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base">Competitor Apps ({competitors.length}/{account?.limits.maxCompetitorApps})</CardTitle>
            <div className="flex items-center gap-3 sm:ml-auto">
              <AppSearchBar
                mode="browse-only"
                trackedSlugs={trackedSlugs}
                competitorSlugs={competitorSlugs}
                placeholder="Search apps..."
                className="w-full sm:w-64"
              />
              <Link href={`/${platform}/competitors`} className="text-sm text-primary hover:underline shrink-0">
                View all
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {competitors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No competitor apps yet"
              description="Mark an app as a competitor to compare rankings and features."
              action={{ label: "Browse Apps", href: `/${platform}/apps` }}
            />
          ) : (
            <>
              <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    {caps.hasReviews && <TableHead className={`${COL_WIDTH.numeric} text-right`}>Rating</TableHead>}
                    {caps.hasReviews && <TableHead className={`${COL_WIDTH.numeric} text-right`}>Reviews</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors
                    .slice(competitorsPage * PAGE_SIZE, (competitorsPage + 1) * PAGE_SIZE)
                    .map((c: any) => (
                      <TableRow key={c.appSlug}>
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2">
                            {c.iconUrl && (
                              <img src={c.iconUrl} alt="" aria-hidden="true" className="h-5 w-5 rounded shrink-0" />
                            )}
                            <Link
                              href={`/${platform}/apps/${c.appSlug}`}
                              className="text-primary hover:underline font-medium truncate"
                            >
                              {c.appName || c.appSlug}
                            </Link>
                            <AppBadgeIcon platform={platform as PlatformId} isBuiltForShopify={c.isBuiltForShopify} badges={c.badges} />
                          </div>
                        </TableCell>
                        {caps.hasReviews && (
                          <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums`}>
                            {c.latestSnapshot?.averageRating ?? "\u2014"}
                          </TableCell>
                        )}
                        {caps.hasReviews && (
                          <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums`}>
                            {c.latestSnapshot?.ratingCount ?? "\u2014"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
              <Pagination page={competitorsPage} totalPages={competitorsTotalPages} onPageChange={setCompetitorsPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Bookmarked Features List */}
      {caps.hasFeatureTaxonomy && <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bookmarked Features ({features.length})</CardTitle>
            <Link href={`/${platform}/features`} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bookmarked features yet.{" "}
              <Link href={`/${platform}/features`} className="text-primary hover:underline">
                Bookmark features
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className={`${COL_WIDTH.numeric} text-right`}>Apps</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Tracked</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features
                    .slice(featuresPage * PAGE_SIZE, (featuresPage + 1) * PAGE_SIZE)
                    .map((f: any) => (
                      <TableRow key={f.featureHandle}>
                        <TableCell>
                          <Link
                            href={`/${platform}/features/${encodeURIComponent(f.featureHandle)}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {f.featureTitle}
                          </Link>
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums text-sm text-muted-foreground`}>
                          {f.appCount ?? "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {f.trackedInFeature > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {f.trackedInFeature}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {f.competitorInFeature > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                              <Eye className="h-3 w-3 mr-1" />
                              {f.competitorInFeature}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <Pagination page={featuresPage} totalPages={featuresTotalPages} onPageChange={setFeaturesPage} />
            </>
          )}
        </CardContent>
      </Card>}

      {/* Starred Categories List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">My Categories ({categories.length})</CardTitle>
            <Link href={`/${platform}/categories`} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories to show.{" "}
              <Link href={`/${platform}/categories`} className="text-primary hover:underline">
                Manage categories
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className={`${COL_WIDTH.numeric} text-right`}>Apps</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Tracked</TableHead>
                    <TableHead className={`${COL_WIDTH.badge} text-center`}>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories
                    .slice(categoriesPage * PAGE_SIZE, (categoriesPage + 1) * PAGE_SIZE)
                    .map((c: any) => (
                      <TableRow key={c.categorySlug}>
                        <TableCell>
                          <Link
                            href={`/${platform}/categories/${c.categorySlug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {c.categoryTitle}
                          </Link>
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.numeric} text-right tabular-nums text-sm text-muted-foreground`}>
                          {c.appCount != null ? formatNumber(c.appCount) : "\u2014"}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {c.trackedInResults > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {c.trackedInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className={`${COL_WIDTH.badge} text-center`}>
                          {c.competitorInResults > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                              <Eye className="h-3 w-3 mr-1" />
                              {c.competitorInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <Pagination page={categoriesPage} totalPages={categoriesTotalPages} onPageChange={setCategoriesPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* System Admin: Global Stats */}
      {systemStats && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>System Stats</CardTitle>
              <CardDescription>Global platform statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold">{systemStats.accounts}</p>
                  <p className="text-sm text-muted-foreground">Accounts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{systemStats.users}</p>
                  <p className="text-sm text-muted-foreground">Users</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{systemStats.totalApps}</p>
                  <p className="text-sm text-muted-foreground">Total Apps</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{systemStats.trackedApps}</p>
                  <p className="text-sm text-muted-foreground">Tracked (global)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {systemStats.freshness?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Data Freshness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {systemStats.freshness.map((f: any) => (
                    <div key={f.scraperType} className="space-y-1">
                      <p className="text-sm font-medium">
                        {SCRAPER_TYPE_LABELS[f.scraperType] || f.scraperType}
                      </p>
                      {f.lastCompletedAt ? (
                        <>
                          <Badge variant={freshnessColor(f.lastCompletedAt)}>
                            {timeAgo(f.lastCompletedAt)}
                          </Badge>
                          {f.lastDurationMs && (
                            <p className="text-xs text-muted-foreground">
                              took {Math.round(f.lastDurationMs / 1000)}s
                            </p>
                          )}
                        </>
                      ) : (
                        <Badge variant="destructive">never</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentRuns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Scraper Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentRuns.map((run: any) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between border-b pb-2 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "default"
                              : run.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {run.status}
                        </Badge>
                        <span className="font-mono text-sm">
                          {run.scraperType}
                        </span>
                        {run.metadata?.duration_ms && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(run.metadata.duration_ms / 1000)}s)
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {run.startedAt ? timeAgo(run.startedAt) : "\u2014"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
