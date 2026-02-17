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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SCRAPER_LABELS: Record<string, string> = {
  category: "Categories",
  app_details: "App Details",
  keyword_search: "Keywords",
  reviews: "Reviews",
};

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

export default function OverviewPage() {
  const { fetchWithAuth, user, account } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      fetchWithAuth("/api/account/tracked-features").then((r) =>
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
    if (user?.isSystemAdmin) {
      setSystemStats(results[4]);
      setRecentRuns(results[5] || []);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Account Usage Cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link href="/apps">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Tracked Apps</CardDescription>
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

        <Link href="/features">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Tracked Features</CardDescription>
              <CardTitle className="text-3xl">
                {account?.usage.trackedFeatures ?? features.length}
                <span className="text-lg text-muted-foreground font-normal">
                  /{account?.limits.maxTrackedFeatures}
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

      {/* Tracked Apps List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tracked Apps</CardTitle>
            <Link href="/apps" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked apps yet.{" "}
              <Link href="/apps" className="text-primary hover:underline">
                Add apps
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.slice(0, 10).map((app: any) => (
                  <TableRow key={app.slug}>
                    <TableCell>
                      <Link
                        href={`/apps/${app.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {app.name}
                      </Link>
                      {app.isBuiltForShopify && <span title="Built for Shopify" className="ml-1">💎</span>}
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.averageRating ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.ratingCount ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Total Results</TableHead>
                  <TableHead>Apps Found</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.slice(0, 10).map((kw: any) => (
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
                      {kw.latestSnapshot?.appCount ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.slice(0, 10).map((c: any) => (
                  <TableRow key={c.appSlug}>
                    <TableCell>
                      <Link
                        href={`/apps/${c.appSlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {c.appName || c.appSlug}
                      </Link>
                      {c.isBuiltForShopify && <span title="Built for Shopify" className="ml-1">💎</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateOnly(c.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tracked Features List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tracked Features</CardTitle>
            <Link href="/features" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked features yet.{" "}
              <Link href="/features" className="text-primary hover:underline">
                Add features
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.slice(0, 10).map((f: any) => (
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
                      {formatDateOnly(f.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
