import { getUserProfile, getSystemStats, getScraperRuns } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default async function OverviewPage() {
  let profile: any = null;
  let systemStats: any = null;
  let recentRuns: any[] = [];

  try {
    profile = await getUserProfile();

    // If system admin, also get global stats
    if (profile?.user?.isSystemAdmin) {
      [systemStats, recentRuns] = await Promise.all([
        getSystemStats().catch(() => null),
        getScraperRuns(10).catch(() => []),
      ]);
    }
  } catch {
    // API may not be running
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {!profile ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            API is not reachable. Start the API server first.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Account Usage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tracked Apps</CardDescription>
                <CardTitle className="text-3xl">
                  {profile.account.usage.trackedApps}
                  <span className="text-lg text-muted-foreground font-normal">
                    /{profile.account.limits.maxTrackedApps}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tracked Keywords</CardDescription>
                <CardTitle className="text-3xl">
                  {profile.account.usage.trackedKeywords}
                  <span className="text-lg text-muted-foreground font-normal">
                    /{profile.account.limits.maxTrackedKeywords}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Competitor Apps</CardDescription>
                <CardTitle className="text-3xl">
                  {profile.account.usage.competitorApps}
                  <span className="text-lg text-muted-foreground font-normal">
                    /{profile.account.limits.maxCompetitorApps}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

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
                      <p className="text-2xl font-bold">
                        {systemStats.accounts}
                      </p>
                      <p className="text-sm text-muted-foreground">Accounts</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{systemStats.users}</p>
                      <p className="text-sm text-muted-foreground">Users</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {systemStats.totalApps}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Apps
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {systemStats.trackedApps}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tracked (global)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Freshness */}
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
                              <Badge
                                variant={freshnessColor(f.lastCompletedAt)}
                              >
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

              {/* Recent Runs */}
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
        </>
      )}
    </div>
  );
}
