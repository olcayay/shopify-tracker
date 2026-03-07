import Link from "next/link";
import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DetailsPage({
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

  const snapshot = app.latestSnapshot;
  if (!snapshot) {
    return <p className="text-muted-foreground">No details available.</p>;
  }

  const pd = snapshot.platformData as Record<string, any> | undefined;
  const isSalesforce = platform === "salesforce";

  // Salesforce-specific arrays from platformData
  const industries: string[] = isSalesforce ? pd?.supportedIndustries || [] : [];
  const businessNeeds: string[] = isSalesforce ? (Array.isArray(pd?.businessNeeds) ? pd.businessNeeds : []) : [];
  const productsRequired: string[] = isSalesforce ? pd?.productsRequired || [] : [];

  return (
    <div className="space-y-4">
      {snapshot.appIntroduction && (
        <Card>
          <CardHeader>
            <CardTitle>App Introduction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{snapshot.appIntroduction}</p>
          </CardContent>
        </Card>
      )}

      {snapshot.appDetails && (
        <Card>
          <CardHeader>
            <CardTitle>App Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{snapshot.appDetails}</p>
          </CardContent>
        </Card>
      )}

      {snapshot.features?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {snapshot.features.map((f: string, i: number) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Salesforce: Industries, Business Need, Requires */}
      {isSalesforce && (industries.length > 0 || businessNeeds.length > 0 || productsRequired.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {industries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Industries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {industries.map((item: string, i: number) => (
                    <Link key={i} href={`/${platform}/discover/industry/${encodeURIComponent(item)}`}>
                      <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                        {item}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {businessNeeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Business Need</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {businessNeeds.map((item: string, i: number) => (
                    <Link key={i} href={`/${platform}/discover/business-need/${encodeURIComponent(item)}`}>
                      <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                        {item}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {productsRequired.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Requires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {productsRequired.map((item: string, i: number) => (
                    <Link key={i} href={`/${platform}/discover/product-required/${encodeURIComponent(item)}`}>
                      <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                        {item}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(snapshot.languages?.length > 0 || snapshot.integrations?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshot.languages?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Languages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.languages.map((lang: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {snapshot.integrations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{isSalesforce ? "Compatible With" : "Integrations"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.integrations.map((item: string, i: number) => (
                    <Link key={i} href={`/${platform}/integrations/${encodeURIComponent(item)}`}>
                      <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                        {item}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {snapshot.pricingPlans?.length > 0 && (
        <Card id="pricing-plans">
          <CardHeader>
            <CardTitle>Pricing Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {snapshot.pricingPlans.map((plan: any, i: number) => (
                <div key={i} className="border rounded-lg p-4">
                  <h4 className="font-semibold">{plan.name}</h4>
                  <p className="text-lg font-bold mt-1">
                    {plan.price
                      ? `$${plan.price}/${plan.period}`
                      : "Free"}
                  </p>
                  {plan.features?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {plan.features.map((f: string, j: number) => (
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

      {snapshot.support && (
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {snapshot.support.email && (
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <a href={`mailto:${snapshot.support.email}`} className="text-primary hover:underline">
                    {snapshot.support.email}
                  </a>
                </p>
              )}
              {snapshot.support.portal_url && (
                <p>
                  <span className="text-muted-foreground">Support Portal:</span>{" "}
                  <a href={snapshot.support.portal_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {snapshot.support.portal_url}
                  </a>
                </p>
              )}
              {snapshot.support.phone && (
                <p>
                  <span className="text-muted-foreground">Phone:</span> {snapshot.support.phone}
                </p>
              )}
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
            {snapshot.categories.map((cat: any, i: number) => {
              const catSlug = cat.url?.match(/\/categories\/([^/?]+)/)?.[1]
                || (cat.title ? cat.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : null);
              return (
                <div key={i} className="mb-4">
                  <div className="flex items-center gap-2">
                    {catSlug ? (
                      <Link href={`/${platform}/categories/${catSlug}`} className="font-medium text-primary hover:underline">
                        {cat.title}
                      </Link>
                    ) : (
                      <h4 className="font-medium">{cat.title}</h4>
                    )}
                    {cat.type && (
                      <Badge variant="outline" className="text-xs">
                        {cat.type}
                      </Badge>
                    )}
                  </div>
                  {cat.subcategories?.map((sub: any, j: number) => (
                    <div key={j} className="ml-4 mt-2">
                      <h5 className="text-sm font-medium text-muted-foreground">
                        {sub.title}
                      </h5>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sub.features?.map((f: any, k: number) => (
                          <Link
                            key={k}
                            href={`/${platform}/features/${encodeURIComponent(f.feature_handle)}`}
                          >
                            <Badge
                              variant="secondary"
                              className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                            >
                              {f.title}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {(snapshot.seoTitle || snapshot.seoMetaDescription) && (
        <Card>
          <CardHeader>
            <CardTitle>Web Search Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {snapshot.seoTitle && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Title Tag</p>
                  <p className="text-sm">{snapshot.seoTitle}</p>
                </div>
              )}
              {snapshot.seoMetaDescription && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Meta Description</p>
                  <p className="text-sm">{snapshot.seoMetaDescription}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
