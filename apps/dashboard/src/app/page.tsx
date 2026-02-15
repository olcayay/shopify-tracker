import { getAdminStats } from "@/lib/api";
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

function freshnessColor(dateStr: string): "default" | "secondary" | "destructive" {
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return "default";
  if (hours < 72) return "secondary";
  return "destructive";
}

export default async function OverviewPage() {
  let stats: any = null;
  try {
    stats = await getAdminStats();
  } catch {
    // API may not be running
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {!stats ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            API is not reachable. Start the API server first.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tracked Apps</CardDescription>
                <CardTitle className="text-3xl">{stats.trackedApps}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  out of {stats.totalApps} total apps
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tracked Keywords</CardDescription>
                <CardTitle className="text-3xl">
                  {stats.trackedKeywords}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Apps in DB</CardDescription>
                <CardTitle className="text-3xl">{stats.totalApps}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Data Freshness */}
          <Card>
            <CardHeader>
              <CardTitle>Data Freshness</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.freshness?.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.freshness.map((f: any) => (
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
              ) : (
                <p className="text-muted-foreground text-sm">
                  No scraper runs completed yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Scraper Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.latestRuns?.length > 0 ? (
                <div className="space-y-2">
                  {stats.latestRuns.map((run: any) => (
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
                        {run.startedAt
                          ? timeAgo(run.startedAt)
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No runs yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
