import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingScorecard } from "@/components/v2/listing-scorecard";
import { Lock } from "lucide-react";

export default async function V2StudioPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let app: any;
  try {
    app = await getApp(slug, platform as PlatformId);
  } catch {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  if (!app.isTrackedByAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-medium">Track this app to unlock Listing Studio</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Listing Studio helps you optimize your marketplace listing with a scorecard, draft editor, and live preview.
        </p>
      </div>
    );
  }

  const snapshot = app.latestSnapshot;

  return (
    <div className="space-y-4">
      {/* Scorecard */}
      <ListingScorecard snapshot={snapshot} platform={platform} app={app} />

      {/* Metadata cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
              {snapshot?.appDetails || "No description available."}
            </p>
          </CardContent>
        </Card>

        {/* Pricing */}
        {snapshot?.pricingPlans?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pricing Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {snapshot.pricingPlans.map((plan: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-muted-foreground">
                      {plan.price == null ? "Free" : `$${plan.price}/${plan.period || "mo"}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Features</CardTitle>
          </CardHeader>
          <CardContent>
            {(snapshot?.features || snapshot?.platformData?.features || []).length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {(snapshot?.features || snapshot?.platformData?.features || []).slice(0, 8).map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span className="line-clamp-1">{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No features listed.</p>
            )}
          </CardContent>
        </Card>

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SEO & Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">SEO Title</p>
              <p className="text-sm">{snapshot?.seoTitle || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SEO Description</p>
              <p className="text-sm">{snapshot?.seoMetaDescription || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
