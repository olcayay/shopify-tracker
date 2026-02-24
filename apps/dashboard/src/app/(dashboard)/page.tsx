"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
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
import { Target, Eye, ChevronLeft, ChevronRight } from "lucide-react";

const SCRAPER_LABELS: Record<string, string> = {
  category: "Categories",
  app_details: "App Details",
  keyword_search: "Keywords",
  reviews: "Reviews",
};

const PAGE_SIZE = 10;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
  const { fetchWithAuth, user, account } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [appsPage, setAppsPage] = useState(0);
  const [keywordsPage, setKeywordsPage] = useState(0);
  const [competitorsPage, setCompetitorsPage] = useState(0);
  const [featuresPage, setFeaturesPage] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

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
    setApps(results[0] || []);
    setKeywords(results[1] || []);
    setCompetitors(results[2] || []);
    setFeatures(results[3] || []);
    setCategories(results[4] || []);
    if (user?.isSystemAdmin) {
      setSystemStats(results[5]);
      setRecentRuns(results[6] || []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const appsTotalPages = Math.ceil(apps.length / PAGE_SIZE);
  const keywordsTotalPages = Math.ceil(keywords.length / PAGE_SIZE);
  const competitorsTotalPages = Math.ceil(competitors.length / PAGE_SIZE);
  const featuresTotalPages = Math.ceil(features.length / PAGE_SIZE);
  const categoriesTotalPages = Math.ceil(categories.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Account Usage Cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/apps">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>My Apps</CardDescription>
              <CardTitle className="text-3xl">
                {account?.usage.trackedApps ?? apps.length}
                <span className="text-lg text-muted-foreground font-normal">
                  /{account?.limits.maxTrackedApps}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/keywords">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Tracked Keywords</CardDescription>
              <CardTitle className="text-3xl">
                {account?.usage.trackedKeywords ?? keywords.length}
                <span className="text-lg text-muted-foreground font-normal">
                  /{account?.limits.maxTrackedKeywords}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/competitors">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Competitor Apps</CardDescription>
              <CardTitle className="text-3xl">
                {account?.usage.competitorApps ?? competitors.length}
                <span className="text-lg text-muted-foreground font-normal">
                  /{account?.limits.maxCompetitorApps}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Users</CardDescription>
              <CardTitle className="text-3xl">
                {account?.usage.users ?? 1}
                <span className="text-lg text-muted-foreground font-normal">
                  /{account?.limits.maxUsers}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* My Apps List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">My Apps</CardTitle>
            <Link href="/apps" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No apps yet.{" "}
              <Link href="/apps" className="text-primary hover:underline">
                Add apps
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Competitors</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Ranked</TableHead>
                    <TableHead>Last Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps
                    .slice(appsPage * PAGE_SIZE, (appsPage + 1) * PAGE_SIZE)
                    .map((app: any) => (
                      <TableRow key={app.slug}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {app.iconUrl && (
                              <img src={app.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                            )}
                            <Link
                              href={`/apps/${app.slug}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {app.name}
                            </Link>
                            {app.isBuiltForShopify && <span title="Built for Shopify">💎</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {app.latestSnapshot?.averageRating ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          {app.latestSnapshot?.ratingCount != null ? (
                            <Link href={`/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                              {app.latestSnapshot.ratingCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell>
                          {app.competitorCount ? (
                            <Link href={`/apps/${app.slug}/competitors`} className="text-primary hover:underline">
                              {app.competitorCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell>
                          {app.keywordCount ? (
                            <Link href={`/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                              {app.keywordCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell>
                          {app.keywordCount > 0 ? (
                            <Link href={`/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                              {app.rankedKeywordCount}/{app.keywordCount}
                            </Link>
                          ) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {app.lastChangeAt ? (
                            <Link href={`/apps/${app.slug}/changes`} className="text-primary hover:underline">
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tracked Keywords</CardTitle>
            <Link href="/keywords" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked keywords yet.{" "}
              <Link href="/keywords" className="text-primary hover:underline">
                Add keywords
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Total Results</TableHead>
                    <TableHead>Tracked</TableHead>
                    <TableHead>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords
                    .slice(keywordsPage * PAGE_SIZE, (keywordsPage + 1) * PAGE_SIZE)
                    .map((kw: any) => (
                      <TableRow key={kw.id}>
                        <TableCell>
                          <Link
                            href={`/keywords/${kw.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {kw.keyword}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {kw.latestSnapshot?.totalResults?.toLocaleString() ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          {kw.trackedInResults > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {kw.trackedInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
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
      </Card>

      {/* Competitor Apps List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Competitor Apps</CardTitle>
            <Link href="/competitors" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {competitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competitor apps yet. Star an app to add it as a competitor.
            </p>
          ) : (
            <>
              <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors
                    .slice(competitorsPage * PAGE_SIZE, (competitorsPage + 1) * PAGE_SIZE)
                    .map((c: any) => (
                      <TableRow key={c.appSlug}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.iconUrl && (
                              <img src={c.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                            )}
                            <Link
                              href={`/apps/${c.appSlug}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {c.appName || c.appSlug}
                            </Link>
                            {c.isBuiltForShopify && <span title="Built for Shopify">💎</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.latestSnapshot?.averageRating ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          {c.latestSnapshot?.ratingCount ?? "\u2014"}
                        </TableCell>
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

      {/* Starred Features List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Starred Features</CardTitle>
            <Link href="/features" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No starred features yet.{" "}
              <Link href="/features" className="text-primary hover:underline">
                Star features
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead>Tracked</TableHead>
                    <TableHead>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features
                    .slice(featuresPage * PAGE_SIZE, (featuresPage + 1) * PAGE_SIZE)
                    .map((f: any) => (
                      <TableRow key={f.featureHandle}>
                        <TableCell>
                          <Link
                            href={`/features/${encodeURIComponent(f.featureHandle)}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {f.featureTitle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.appCount ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          {f.trackedInFeature > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {f.trackedInFeature}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
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
      </Card>

      {/* Starred Categories List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Starred Categories</CardTitle>
            <Link href="/categories" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No starred categories yet.{" "}
              <Link href="/categories" className="text-primary hover:underline">
                Star categories
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead>Tracked</TableHead>
                    <TableHead>Competitor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories
                    .slice(categoriesPage * PAGE_SIZE, (categoriesPage + 1) * PAGE_SIZE)
                    .map((c: any) => (
                      <TableRow key={c.categorySlug}>
                        <TableCell>
                          <Link
                            href={`/categories/${c.categorySlug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {c.categoryTitle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.appCount?.toLocaleString() ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          {c.trackedInResults > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                              <Target className="h-3 w-3 mr-1" />
                              {c.trackedInResults}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
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
                        {SCRAPER_LABELS[f.scraperType] || f.scraperType}
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
