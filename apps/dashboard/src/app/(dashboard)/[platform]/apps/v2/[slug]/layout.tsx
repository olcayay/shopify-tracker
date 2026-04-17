import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { getApp, getAppMembership, getAppScores } from "@/lib/api";
import { TrackAppButton } from "../../[slug]/track-button";
import { CompetitorButton } from "@/components/competitor-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import { PLATFORMS, isPlatformId, developerNameToSlug, type PlatformId } from "@appranks/shared";
import { ExternalLink, ClipboardCheck, Star } from "lucide-react";
import { EmailDigestToggle } from "../../[slug]/email-digest-toggle";
import { ScoreBar } from "@/components/v2/score-bar";
import { V2Nav } from "@/components/v2/v2-nav";
import { ClassicViewLink } from "@/components/v2/classic-view-link";
import { hasServerFeature } from "@/lib/score-features-server";

export default async function V2AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ platform: string; slug: string }>;
  children: React.ReactNode;
}) {
  const { platform, slug } = await params;
  const caps = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [hasAppVisibility, hasAppPower] = await Promise.all([
    hasServerFeature("app-visibility"),
    hasServerFeature("app-power"),
  ]);

  let app: any;
  let membership: any = {};
  let scores: any = { visibility: [], power: [], weightedPowerScore: 0 };
  try {
    [app, membership, scores] = await Promise.all([
      getApp(slug, platform as PlatformId),
      getAppMembership(slug, platform as PlatformId).catch(() => ({})),
      hasAppVisibility || hasAppPower
        ? getAppScores(slug, platform as PlatformId).catch(() => ({ visibility: [], power: [], weightedPowerScore: 0 }))
        : Promise.resolve({ visibility: [], power: [], weightedPowerScore: 0 }),
    ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  const snapshot = app.latestSnapshot;

  // Compute best visibility score across tracked apps
  const bestVisibility = hasAppVisibility && scores.visibility?.length > 0
    ? Math.max(...scores.visibility.map((v: any) => v.visibilityScore ?? 0))
    : null;

  // Weighted power score
  const powerScore = hasAppPower ? (scores.weightedPowerScore || null) : null;

  return (
    <div className="space-y-4">
      {/* Row 1: Icon + Name + Inline Stats */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <AppIcon src={app.iconUrl} className="h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{app.name}</h1>
              {app.isBuiltForShopify && <span title="Built for Shopify" className="text-sm">💎</span>}
            </div>
            {/* Inline stats */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {caps.hasReviews && snapshot?.averageRating != null && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  {Number(snapshot.averageRating).toFixed(1)}
                  {snapshot.ratingCount != null && (
                    <span className="text-muted-foreground/70">({snapshot.ratingCount})</span>
                  )}
                </span>
              )}
              {caps.hasPricing && snapshot?.pricingPlans?.length > 0 && (
                <span>
                  {snapshot.pricingPlans[0].price == null
                    ? "Free"
                    : `From $${snapshot.pricingPlans[0].price}/${snapshot.pricingPlans[0].period || "mo"}`}
                </span>
              )}
              {snapshot?.developer?.name && (
                <Link
                  href={`/${platform}/developers/${developerNameToSlug(snapshot.developer.name)}`}
                  className="hover:text-foreground transition-colors"
                >
                  {snapshot.developer.name}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <EmailDigestToggle appId={app.id} isTracked={app.isTrackedByAccount} iconClassName="h-4 w-4" />
          <Link
            href={`/audit/${platform}/${slug}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
            title="Audit Report"
          >
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </Link>
          <a
            href={buildExternalAppUrl(platform as PlatformId, app.slug, app.externalId)}
            target="_blank"
            rel="noopener noreferrer"
            title={`View on ${getPlatformName(platform as PlatformId)}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
          <AdminScraperTrigger scraperType="app_details" slug={app.slug} label="Scrape App" />
          <CompetitorButton
            appSlug={app.slug}
            appName={app.name}
            initialStarred={app.isCompetitor}
            competitorForApps={app.competitorForApps}
            isOwnTrackedApp={app.isTrackedByAccount}
            iconClassName="h-4 w-4"
          />
          <TrackAppButton
            appSlug={app.slug}
            appName={app.name}
            initialTracked={app.isTrackedByAccount}
          />
        </div>
      </div>

      {/* Row 2: Score Bars */}
      <div className="flex items-center gap-6 flex-wrap">
        {hasAppVisibility && <ScoreBar label="Visibility" score={bestVisibility} maxScore={100} testId="score-bar-visibility" />}
        {hasAppPower && <ScoreBar label="Power" score={powerScore} maxScore={100} testId="score-bar-power" />}
        <ClassicViewLink platform={platform} slug={slug} />
      </div>

      <V2Nav slug={slug} isTracked={app.isTrackedByAccount} />

      {children}
    </div>
  );
}
