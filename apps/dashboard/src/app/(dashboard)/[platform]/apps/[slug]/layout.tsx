import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { formatDateOnly } from "@/lib/format-date";
import { getApp, getAppMembership } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { TrackAppButton } from "./track-button";
import { StarAppButton } from "@/components/star-app-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppNav } from "./app-nav";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS, isPlatformId, developerNameToSlug, type PlatformId } from "@appranks/shared";

export default async function AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ platform: string; slug: string }>;
  children: React.ReactNode;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;

  let app: any;
  let membership: any = {};
  try {
    [app, membership] = await Promise.all([
      getApp(slug, platform as PlatformId),
      getAppMembership(slug, platform as PlatformId).catch(() => ({})),
    ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  const snapshot = app.latestSnapshot;
  const memberApps = membership.competitorForAppNames || [];
  const memberProjects = membership.researchProjects || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <AppIcon src={app.iconUrl} className="h-16 w-16 rounded-lg" />
          <div>
            <h1 className="text-2xl font-bold">
              {app.name}
              {app.isBuiltForShopify && <span title="Built for Shopify" className="ml-1.5">💎</span>}
            </h1>
            {app.appCardSubtitle && (
              <p className="text-sm text-muted-foreground italic mt-1">{app.appCardSubtitle}</p>
            )}
            {(memberApps.length > 0 || memberProjects.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {memberApps.map((a: any) => (
                  <Link key={a.slug} href={`/${platform}/apps/${a.slug}`}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                      Competitor for {a.name}
                    </Badge>
                  </Link>
                ))}
                {memberProjects.map((p: any) => (
                  <Link key={p.id} href={`/${platform}/research/${p.id}`}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20">
                      {p.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={buildExternalAppUrl(platform as PlatformId, app.slug, app.externalId)}
            target="_blank"
            rel="noopener noreferrer"
            title={`View on ${getPlatformName(platform as PlatformId)}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
          <AdminScraperTrigger
            scraperType="app_details"
            slug={app.slug}
            label="Scrape App"
          />
          <StarAppButton
            appSlug={app.slug}
            appName={app.name}
            initialStarred={app.isCompetitor}
            competitorForApps={app.competitorForApps}
          />
          <TrackAppButton
            appSlug={app.slug}
            appName={app.name}
            initialTracked={app.isTrackedByAccount}
          />
        </div>
      </div>

      {snapshot && (() => {
        const cardCount = 2 + (caps.hasReviews ? 2 : 0) + (caps.hasPricing ? 1 : 0) + (caps.hasLaunchedDate ? 1 : 0);
        const lgCols = cardCount <= 3 ? "lg:grid-cols-3" : cardCount <= 4 ? "lg:grid-cols-4" : cardCount <= 5 ? "lg:grid-cols-5" : "lg:grid-cols-6";
        return (
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${lgCols} gap-4`}>
          {caps.hasReviews && (
            <Link href={`/${platform}/apps/${slug}/reviews`} className="block h-full">
            <Card className="min-w-0 py-3 gap-1 h-full hover:ring-1 hover:ring-muted-foreground/20 transition-all">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {snapshot.averageRating ?? "—"}
                </span>
                {snapshot.averageRating != null && (
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: caps.maxRatingStars }, (_, i) => i + 1).map((star) => {
                      const rating = Number(snapshot.averageRating);
                      const fill = Math.min(1, Math.max(0, rating - (star - 1)));
                      return (
                        <div key={star} className="relative h-4 w-4">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground/30" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-yellow-500" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </Link>
          )}
          {caps.hasReviews && (
            <Link href={`/${platform}/apps/${slug}/reviews`} className="block h-full">
            <Card className="min-w-0 py-3 gap-1 h-full hover:ring-1 hover:ring-muted-foreground/20 transition-all">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {snapshot.ratingCount ?? "—"}
                </span>
              </CardContent>
            </Card>
            </Link>
          )}
          {caps.hasPricing && (
            <Link href={`/${platform}/apps/${slug}/details#pricing-plans`} className="block h-full">
            <Card className="min-w-0 py-3 gap-1 h-full hover:ring-1 hover:ring-muted-foreground/20 transition-all">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.pricingPlans && snapshot.pricingPlans.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {snapshot.pricingPlans.map((plan: any) => (
                      <span
                        key={plan.name}
                        className="text-xs"
                      >
                        <span className="font-medium">{plan.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {plan.price == null
                            ? "Free"
                            : `$${plan.price}/${plan.period || "mo"}`}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm">{snapshot.pricing || "—"}</span>
                )}
              </CardContent>
            </Card>
            </Link>
          )}
          <Card className="min-w-0 py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Developer</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.developer?.name ? (
                <Link
                  href={`/${platform}/developers/${developerNameToSlug(snapshot.developer.name)}`}
                  className="text-sm text-primary hover:underline truncate block"
                >
                  {snapshot.developer.name}
                </Link>
              ) : (
                <span className="text-sm">—</span>
              )}
            </CardContent>
          </Card>
          {caps.hasLaunchedDate && (
            <Card className="min-w-0 py-3 gap-1">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Launched</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-sm">
                  {app.launchedDate ? formatDateOnly(app.launchedDate) : "—"}
                </span>
              </CardContent>
            </Card>
          )}
          <Card className="min-w-0 py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Last Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">
                {formatDateOnly(snapshot.scrapedAt)}
              </span>
            </CardContent>
          </Card>
        </div>
        );
      })()}

      <AppNav slug={slug} isTracked={app.isTrackedByAccount} />

      {children}
    </div>
  );
}
