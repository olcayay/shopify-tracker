import Link from "next/link";
import { getApp } from "@/lib/api";
import { hasAnySeoField, hasSeoTitle, hasSeoMetaDescription, type PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Clock, Code, Globe, FileCode } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import { formatFullDate } from "@/lib/format-utils";
import { DataFreshness } from "@/components/data-freshness";
import { getPlatformSections } from "@/components/platform-sections";
import { isSystemAdminServer } from "@/lib/auth-server";
import { hasServerFeature } from "@/lib/score-features-server";

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
  const isWordPress = platform === "wordpress";
  const [isAdmin, showDataFreshness] = await Promise.all([
    isSystemAdminServer(),
    hasServerFeature("scrape-timestamps"),
  ]);

  const formatInstalls = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M+`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K+`;
    return `${n}+`;
  };

  const hasPluginInfo = app.currentVersion || app.activeInstalls != null || app.lastUpdatedAt;

  // Platform sections from registry
  const platformSections = getPlatformSections(platform as PlatformId);
  const sectionProps = { platform: platform as PlatformId, platformData: pd ?? {}, snapshot, app };

  return (
    <div className="space-y-4">
      {showDataFreshness && <DataFreshness dateStr={snapshot.scrapedAt} />}

      {/* Plugin Info — full-width stats grid */}
      {hasPluginInfo && (() => {
        const stats: { icon: React.ReactNode; label: string; value: React.ReactNode; bg: string }[] = [];
        if (app.currentVersion) stats.push({
          icon: <Code className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
          bg: "bg-blue-50 dark:bg-blue-950/40",
          label: "Version",
          value: app.currentVersion,
        });
        if (app.activeInstalls != null) stats.push({
          icon: <Download className="h-5 w-5 text-green-600 dark:text-green-400" />,
          bg: "bg-green-50 dark:bg-green-950/40",
          label: "Active Installs",
          value: formatInstalls(app.activeInstalls),
        });
        if (app.lastUpdatedAt) stats.push({
          icon: <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          bg: "bg-amber-50 dark:bg-amber-950/40",
          label: "Last Updated",
          value: formatFullDate(app.lastUpdatedAt),
        });
        if (isWordPress && pd?.requiresWP) stats.push({
          icon: <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
          bg: "bg-indigo-50 dark:bg-indigo-950/40",
          label: "WordPress",
          value: <>{pd.requiresWP}+{pd?.testedUpTo && <span className="text-xs font-normal text-muted-foreground ml-1">(tested {pd.testedUpTo})</span>}</>,
        });
        if (isWordPress && pd?.requiresPHP) stats.push({
          icon: <FileCode className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
          bg: "bg-purple-50 dark:bg-purple-950/40",
          label: "PHP",
          value: `${pd.requiresPHP}+`,
        });
        return (
          <Card>
            <CardContent className="py-5">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                {stats.map((s, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-1.5">
                    <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${s.bg}`}>
                      {s.icon}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                    <p className="text-sm font-semibold leading-tight">{s.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Platform-specific sections from registry */}
      {platformSections
        .filter((section) => !section.shouldRender || section.shouldRender(sectionProps))
        .map((section) => (
          <section.component key={section.id} {...sectionProps} />
        ))}

      {/* App Introduction / Short Description (shared, non-WordPress) */}
      {!isWordPress && snapshot.appIntroduction && (
        <Card>
          <CardHeader>
            <CardTitle>
              {platform === "canva" || platform === "wix" || platform === "google_workspace" || platform === "hubspot"
                ? "Short Description"
                : platform === "atlassian" ? "Summary" : "App Introduction"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{snapshot.appIntroduction}</p>
          </CardContent>
        </Card>
      )}

      {/* App Details / Description (shared, non-WordPress) */}
      {!isWordPress && snapshot.appDetails && (
        <Card>
          <CardHeader>
            <CardTitle>
              {platform === "canva" || platform === "wix" || platform === "google_workspace" || platform === "atlassian" || platform === "hubspot"
                ? "Description"
                : "App Details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{snapshot.appDetails}</p>
          </CardContent>
        </Card>
      )}

      {snapshot.features?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {platform === "salesforce" || platform === "atlassian" ? "Highlights" : platform === "wix" ? "Benefits" : "Features"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {snapshot.features.map((f: string, i: number) => {
                if (platform === "salesforce" || platform === "atlassian") {
                  const [title, ...rest] = f.split("\n");
                  const description = rest.join("\n").trim();
                  return (
                    <li key={i} className="text-sm">
                      <span className="font-semibold">{title}</span>
                      {description && (
                        <p className="text-muted-foreground mt-0.5">{description}</p>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                    {f}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Languages (shared, non-Salesforce — Salesforce handles in its section) */}
      {platform !== "salesforce" && snapshot.languages?.length > 0 && (
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

      {/* Integrations (shared, non-Salesforce — Salesforce handles in its section) */}
      {platform !== "salesforce" && snapshot.integrations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
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

      {snapshot.pricingPlans?.length > 0 && (
        <Card id="pricing-plans">
          <CardHeader>
            <CardTitle>Pricing Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {snapshot.pricingPlans.map((plan: any, i: number) => {
                const planName = plan.name || plan.plan_name;
                let priceLabel = "Free";
                if (plan.price) {
                  const suffix = [plan.currency_code, plan.units, plan.period].filter(Boolean).join("/");
                  priceLabel = suffix ? `$${plan.price} ${suffix}` : `$${plan.price}`;
                }
                return (
                  <div key={i} className="border rounded-lg p-4">
                    <h4 className="font-semibold">{planName}</h4>
                    <p className="text-lg font-bold mt-1">{priceLabel}</p>
                    {plan.trial_text && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.trial_text}</p>
                    )}
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && snapshot.support && (
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
                  <ExternalLink href={snapshot.support.portal_url} showIcon={false} className="text-primary">
                    {snapshot.support.portal_url}
                  </ExternalLink>
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

      {isAdmin && hasAnySeoField(platform) && (snapshot.seoTitle || snapshot.seoMetaDescription) && (
        <Card>
          <CardHeader>
            <CardTitle>Web Search Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hasSeoTitle(platform) && snapshot.seoTitle && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Title Tag</p>
                  <p className="text-sm">{snapshot.seoTitle}</p>
                </div>
              )}
              {hasSeoMetaDescription(platform) && snapshot.seoMetaDescription && (
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
