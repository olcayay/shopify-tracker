import { getApp, getAppReviews, getAppRankings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RankingChart } from "@/components/ranking-chart";
import { TrackAppButton } from "./track-button";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let app: any;
  let reviewData: any;
  let rankings: any;
  try {
    [app, reviewData, rankings] = await Promise.all([
      getApp(slug),
      getAppReviews(slug, 10),
      getAppRankings(slug),
    ]);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  const snapshot = app.latestSnapshot;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{app.name}</h1>
          <p className="text-muted-foreground">{app.slug}</p>
        </div>
        <TrackAppButton
          appSlug={app.slug}
          appName={app.name}
          initialTracked={app.isTrackedByAccount}
        />
      </div>

      {/* Summary cards */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {snapshot.averageRating ?? "—"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {snapshot.ratingCount ?? "—"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">{snapshot.pricing || "—"}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Developer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">
                {snapshot.developer?.name || "—"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Last Scraped
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm">
                {new Date(snapshot.scrapedAt).toLocaleDateString()}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="rankings">
        <TabsList>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews ({reviewData?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="space-y-4">
          {rankings?.categoryRankings?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Category Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <RankingChart
                  data={rankings.categoryRankings.map((r: any) => ({
                    date: new Date(r.scrapedAt).toLocaleDateString(),
                    position: r.position,
                    label: r.categoryTitle || r.categorySlug,
                    slug: r.categorySlug,
                    linkPrefix: "/categories/",
                  }))}
                />
              </CardContent>
            </Card>
          )}
          {rankings?.keywordRankings?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Keyword Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <RankingChart
                  data={rankings.keywordRankings.map((r: any) => ({
                    date: new Date(r.scrapedAt).toLocaleDateString(),
                    position: r.position,
                    label: r.keyword,
                  }))}
                />
              </CardContent>
            </Card>
          )}
          {!rankings?.categoryRankings?.length &&
            !rankings?.keywordRankings?.length && (
              <p className="text-muted-foreground">
                No ranking data yet. Run scrapers to collect data.
              </p>
            )}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {reviewData?.distribution?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const item = reviewData.distribution.find(
                      (d: any) => d.rating === star
                    );
                    const count = item?.count || 0;
                    const pct =
                      reviewData.total > 0
                        ? (count / reviewData.total) * 100
                        : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="w-8 text-sm text-right">{star}★</span>
                        <div className="flex-1 bg-muted rounded-full h-3">
                          <div
                            className="bg-primary rounded-full h-3"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-sm text-muted-foreground text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviewData?.reviews?.map((review: any) => (
                  <div
                    key={review.id}
                    className="border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {review.reviewerName}
                        </span>
                        {review.reviewerCountry && (
                          <span className="text-sm text-muted-foreground">
                            {review.reviewerCountry}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{review.rating}★</Badge>
                        <span className="text-sm text-muted-foreground">
                          {review.reviewDate}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm">{review.content}</p>
                    {review.durationUsingApp && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {review.durationUsingApp}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          {snapshot && (
            <>
              {snapshot.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{snapshot.description}</p>
                  </CardContent>
                </Card>
              )}

              {snapshot.pricingTiers?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing Plans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {snapshot.pricingTiers.map((tier: any, i: number) => (
                        <div key={i} className="border rounded-lg p-4">
                          <h4 className="font-semibold">{tier.name}</h4>
                          <p className="text-lg font-bold mt-1">
                            {tier.price
                              ? `$${tier.price}/${tier.period}`
                              : "Free"}
                          </p>
                          {tier.features?.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {tier.features.map((f: string, j: number) => (
                                <li
                                  key={j}
                                  className="text-sm text-muted-foreground"
                                >
                                  • {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {snapshot.categories?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Categories & Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {snapshot.categories.map((cat: any, i: number) => (
                      <div key={i} className="mb-4">
                        <h4 className="font-medium">{cat.title}</h4>
                        {cat.subcategories?.map((sub: any, j: number) => (
                          <div key={j} className="ml-4 mt-2">
                            <h5 className="text-sm font-medium text-muted-foreground">
                              {sub.title}
                            </h5>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sub.features?.map((f: any, k: number) => (
                                <Badge
                                  key={k}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {f.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
