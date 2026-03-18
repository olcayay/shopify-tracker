import Link from "next/link";
import { getApp } from "@/lib/api";
import type { PlatformId } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Download, Clock, Code, Globe, FileCode, Shield, Award, Bug } from "lucide-react";

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
  const isCanva = platform === "canva";
  const isWix = platform === "wix";
  const isWordPress = platform === "wordpress";
  const isGoogleWorkspace = platform === "google_workspace";
  const isAtlassian = platform === "atlassian";

  // WordPress: use raw HTML description from platformData for formatted rendering
  const wpDescriptionHtml = isWordPress && pd?.description
    ? (pd.description as string)
    : null;

  // Salesforce-specific arrays from platformData
  const industries: string[] = isSalesforce ? pd?.supportedIndustries || [] : [];
  const businessNeeds: string[] = isSalesforce ? (Array.isArray(pd?.businessNeeds) ? pd.businessNeeds : []) : [];
  const productsRequired: string[] = isSalesforce ? pd?.productsRequired || [] : [];
  const canvaPermissions: { scope: string; type: string }[] = isCanva ? pd?.permissions || [] : [];

  // Wix-specific fields from platformData
  const wixCollections: { slug: string; name: string }[] = isWix ? pd?.collections || [] : [];
  const wixLanguages: string[] = isWix ? pd?.languages || [] : [];
  const wixAvailability: boolean | null = isWix ? pd?.isAvailableWorldwide ?? null : null;

  // Google Workspace-specific fields from platformData
  const gworkspaceWorksWithApps: string[] = isGoogleWorkspace ? pd?.worksWithApps || [] : [];

  // Atlassian-specific fields from platformData
  const atlassianCompatibilities: Array<{ application: string; cloud: boolean; server: boolean; dataCenter: boolean }> = isAtlassian ? pd?.compatibilities || [] : [];
  const atlassianVendorLinks = isAtlassian ? pd?.vendorLinks as Record<string, string> | null : null;

  const formatInstalls = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M+`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K+`;
    return `${n}+`;
  };

  const hasPluginInfo = app.currentVersion || app.activeInstalls != null || app.lastUpdatedAt;
  const wpRequires = isWordPress && (pd?.requiresWP || pd?.requiresPHP || pd?.testedUpTo);

  return (
    <div className="space-y-4">
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
          value: new Date(app.lastUpdatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
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

      {/* Atlassian: App Info card */}
      {isAtlassian && (pd?.paymentModel || pd?.licenseType || pd?.releaseDate || atlassianCompatibilities.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>App Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {pd?.paymentModel && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Payment Model</p>
                  <p className="font-medium">
                    {pd.paymentModel === "free" ? "Free" : pd.paymentModel === "atlassian" ? "Paid via Atlassian" : "Paid via Vendor"}
                  </p>
                </div>
              )}
              {pd?.licenseType && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">License Type</p>
                  <p className="font-medium">{pd.licenseType}</p>
                </div>
              )}
              {pd?.releaseDate && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Release Date</p>
                  <p className="font-medium">{new Date(pd.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                </div>
              )}
              {atlassianCompatibilities.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Compatible With</p>
                  <div className="flex flex-wrap gap-1">
                    {atlassianCompatibilities.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {c.application} {c.cloud ? "Cloud" : c.server ? "Server" : c.dataCenter ? "Data Center" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atlassian: Trust Signals */}
      {isAtlassian && (pd?.cloudFortified || pd?.bugBountyParticipant || pd?.topVendor) && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pd?.cloudFortified && (
                <Badge variant="default" className="text-xs gap-1">
                  <Shield className="h-3 w-3" /> Cloud Fortified
                </Badge>
              )}
              {pd?.topVendor && (
                <Badge variant="default" className="text-xs gap-1">
                  <Award className="h-3 w-3" /> Top Vendor
                </Badge>
              )}
              {pd?.bugBountyParticipant && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Bug className="h-3 w-3" /> Bug Bounty Participant
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WordPress: single Description card with formatted HTML */}
      {isWordPress && (wpDescriptionHtml || snapshot.appDetails) && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            {wpDescriptionHtml ? (
              <div
                className="wp-description text-sm"
                dangerouslySetInnerHTML={{ __html: wpDescriptionHtml }}
              />
            ) : (
              <p className="text-sm whitespace-pre-line">{snapshot.appDetails}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-WordPress: App Introduction / Short Description */}
      {!isWordPress && snapshot.appIntroduction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isCanva || isWix || isGoogleWorkspace ? "Short Description" : isAtlassian ? "Summary" : "App Introduction"}
              {isCanva && (
                <Badge variant={snapshot.appIntroduction.length > 50 ? "destructive" : "outline"} className="text-xs font-normal">
                  {snapshot.appIntroduction.length}/50
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{snapshot.appIntroduction}</p>
          </CardContent>
        </Card>
      )}

      {/* Non-WordPress: App Details / Description */}
      {!isWordPress && snapshot.appDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isCanva || isWix || isGoogleWorkspace || isAtlassian ? "Description" : "App Details"}
              {isCanva && (
                <Badge variant={snapshot.appDetails.length > 200 ? "destructive" : "outline"} className="text-xs font-normal">
                  {snapshot.appDetails.length}/200
                </Badge>
              )}
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
            <CardTitle>{isSalesforce || isAtlassian ? "Highlights" : isWix ? "Benefits" : "Features"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {snapshot.features.map((f: string, i: number) => {
                if (isSalesforce || isAtlassian) {
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

      {/* Salesforce: all badge cards in a single unified grid */}
      {isSalesforce && (industries.length > 0 || businessNeeds.length > 0 || productsRequired.length > 0 || snapshot.languages?.length > 0 || snapshot.integrations?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <CardTitle>Compatible With</CardTitle>
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

      {/* Non-Salesforce: Languages + Integrations + Canva Permissions + Wix Collections + GWorkspace Works With */}
      {!isSalesforce && (snapshot.languages?.length > 0 || snapshot.integrations?.length > 0 || canvaPermissions.length > 0 || wixCollections.length > 0 || gworkspaceWorksWithApps.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gworkspaceWorksWithApps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Works With</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {gworkspaceWorksWithApps.map((app: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {app}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {canvaPermissions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {canvaPermissions.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="text-green-600 mr-1.5">✓</span>
                        {p.scope.replace(/^canva:/, "").replace(/:/g, " › ")}
                      </span>
                      <Badge variant={p.type === "MANDATORY" ? "default" : "outline"} className="text-xs ml-2 shrink-0">
                        {p.type === "MANDATORY" ? "Mandatory" : "Optional"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {wixCollections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Featured In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {wixCollections.map((c, i) => (
                    <a
                      key={i}
                      href={`https://www.wix.com/app-market/collection/${c.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Badge variant="secondary" className="text-xs hover:bg-primary/10 cursor-pointer">
                        {c.name}
                      </Badge>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
        </div>
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

      {/* Google Workspace: Support & Legal Links */}
      {isGoogleWorkspace && (pd?.supportUrl || pd?.privacyPolicyUrl || pd?.termsOfServiceUrl || pd?.developerWebsite) && (
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {pd?.supportUrl && (
                <p>
                  <span className="text-muted-foreground">Support:</span>{" "}
                  <a href={pd.supportUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.supportUrl}
                  </a>
                </p>
              )}
              {pd?.developerWebsite && (
                <p>
                  <span className="text-muted-foreground">Developer Website:</span>{" "}
                  <a href={pd.developerWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.developerWebsite}
                  </a>
                </p>
              )}
              {pd?.privacyPolicyUrl && (
                <p>
                  <span className="text-muted-foreground">Privacy Policy:</span>{" "}
                  <a href={pd.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.privacyPolicyUrl}
                  </a>
                </p>
              )}
              {pd?.termsOfServiceUrl && (
                <p>
                  <span className="text-muted-foreground">Terms of Service:</span>{" "}
                  <a href={pd.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.termsOfServiceUrl}
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atlassian: Links card */}
      {isAtlassian && (pd?.documentationUrl || pd?.eulaUrl || atlassianVendorLinks?.privacy || atlassianVendorLinks?.appStatusPage || pd?.slaUrl || pd?.trustCenterUrl || pd?.vendorHomePage || pd?.contactEmail) && (
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {pd?.vendorHomePage && (
                <p>
                  <span className="text-muted-foreground">Developer Website:</span>{" "}
                  <a href={pd.vendorHomePage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.vendorHomePage}
                  </a>
                </p>
              )}
              {pd?.documentationUrl && (
                <p>
                  <span className="text-muted-foreground">Documentation:</span>{" "}
                  <a href={pd.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.documentationUrl}
                  </a>
                </p>
              )}
              {pd?.eulaUrl && (
                <p>
                  <span className="text-muted-foreground">EULA:</span>{" "}
                  <a href={pd.eulaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.eulaUrl}
                  </a>
                </p>
              )}
              {atlassianVendorLinks?.privacy && (
                <p>
                  <span className="text-muted-foreground">Privacy Policy:</span>{" "}
                  <a href={atlassianVendorLinks.privacy} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {atlassianVendorLinks.privacy}
                  </a>
                </p>
              )}
              {atlassianVendorLinks?.appStatusPage && (
                <p>
                  <span className="text-muted-foreground">Status Page:</span>{" "}
                  <a href={atlassianVendorLinks.appStatusPage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {atlassianVendorLinks.appStatusPage}
                  </a>
                </p>
              )}
              {pd?.slaUrl && (
                <p>
                  <span className="text-muted-foreground">SLA:</span>{" "}
                  <a href={pd.slaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.slaUrl}
                  </a>
                </p>
              )}
              {pd?.trustCenterUrl && (
                <p>
                  <span className="text-muted-foreground">Trust Center:</span>{" "}
                  <a href={pd.trustCenterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {pd.trustCenterUrl}
                  </a>
                </p>
              )}
              {pd?.contactEmail && (
                <p>
                  <span className="text-muted-foreground">Contact Email:</span>{" "}
                  <a href={`mailto:${pd.contactEmail}`} className="text-primary hover:underline">
                    {pd.contactEmail}
                  </a>
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

      {!isCanva && !isWordPress && (snapshot.seoTitle || snapshot.seoMetaDescription) && (
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
