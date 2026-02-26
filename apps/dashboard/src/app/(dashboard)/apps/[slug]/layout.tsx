import Link from "next/link";
import { formatDateOnly } from "@/lib/format-date";
import { getApp } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { TrackAppButton } from "./track-button";
import { StarAppButton } from "@/components/star-app-button";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppNav } from "./app-nav";

export default async function AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;

  let app: any;
  try {
    app = await getApp(slug);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  const snapshot = app.latestSnapshot;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          {app.iconUrl && (
            <img src={app.iconUrl} alt="" className="h-16 w-16 rounded-lg shrink-0" />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {app.name}
              {app.isBuiltForShopify && <span title="Built for Shopify" className="ml-1.5">💎</span>}
            </h1>
            {app.appCardSubtitle && (
              <p className="text-sm text-muted-foreground italic mt-1">{app.appCardSubtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://apps.shopify.com/${app.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Shopify App Store"
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

      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {snapshot.averageRating ?? "—"}
              </span>
              {snapshot.averageRating != null && (
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => {
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
          <Card className="py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {snapshot.ratingCount ?? "—"}
              </span>
            </CardContent>
          </Card>
          <Card className="py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.pricingPlans && snapshot.pricingPlans.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.pricingPlans.map((plan: any) => (
                    <span
                      key={plan.name}
                      className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      <span className="font-medium">{plan.name}</span>
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
          <Card className="py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Developer</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.developer?.name ? (
                <Link
                  href={`/developers?name=${encodeURIComponent(snapshot.developer.name)}`}
                  className="text-sm text-primary hover:underline"
                >
                  {snapshot.developer.name}
                </Link>
              ) : (
                <span className="text-sm">—</span>
              )}
            </CardContent>
          </Card>
          <Card className="py-3 gap-1">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Launched</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">
                {app.launchedDate ? formatDateOnly(app.launchedDate) : "—"}
              </span>
            </CardContent>
          </Card>
          <Card className="py-3 gap-1">
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
      )}

      <AppNav slug={slug} isTracked={app.isTrackedByAccount} />

      {children}
    </div>
  );
}
