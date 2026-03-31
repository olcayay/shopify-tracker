import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  ChevronRight,
  BarChart3,
  Calendar,
  Download,
  CheckCircle2,
  XCircle,
  Tag,
  Lock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { getPublicComparison } from "@/lib/api";
import { ComparisonJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatNumber, formatMonthYear } from "@/lib/format-utils";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";

const BASE_URL = "https://appranks.io";

interface PageProps {
  params: Promise<{ platform: string; slugs: string }>;
}

function parseSlugs(slugs: string): [string, string] | null {
  const parts = slugs.split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform, slugs } = await params;
  if (!isPlatformId(platform)) return {};
  const parsed = parseSlugs(slugs);
  if (!parsed) return {};

  try {
    const data = await getPublicComparison(platform, parsed[0], parsed[1]);
    const platformName = PLATFORMS[platform as PlatformId].name;
    const year = new Date().getFullYear();
    const title = `${data.app1.name} vs ${data.app2.name} for ${platformName}: Comparison (${year}) | AppRanks`;
    const r1 = data.app1.averageRating ? `${data.app1.averageRating.toFixed(1)}★` : "";
    const r2 = data.app2.averageRating ? `${data.app2.averageRating.toFixed(1)}★` : "";
    const description = `Compare ${data.app1.name} ${r1} vs ${data.app2.name} ${r2} on ${platformName}. Side-by-side pricing, features, and ratings.`;
    const canonical = `${BASE_URL}/compare/${platform}/${slugs}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, siteName: "AppRanks", type: "article" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {};
  }
}

function formatDate(date: string | null) {
  if (!date) return "N/A";
  return formatMonthYear(date);
}

function featureSet(features: any[]): Set<string> {
  return new Set(features.map((f) => (typeof f === "string" ? f : f?.title || f?.name || "").toLowerCase()).filter(Boolean));
}

export default async function ComparisonPage({ params }: PageProps) {
  const { platform, slugs } = await params;
  if (!isPlatformId(platform)) notFound();
  const parsed = parseSlugs(slugs);
  if (!parsed) notFound();

  let data: any;
  try {
    data = await getPublicComparison(platform, parsed[0], parsed[1]);
  } catch {
    notFound();
  }
  if (!data) notFound();

  const { app1, app2, similarityScore } = data;
  const platformConfig = PLATFORMS[platform as PlatformId];

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/apps/${platform}` },
    { name: `${app1.name} vs ${app2.name}`, url: `${BASE_URL}/compare/${platform}/${slugs}` },
  ];

  // Feature comparison
  const f1 = featureSet(app1.features || []);
  const f2 = featureSet(app2.features || []);
  const allFeatures = [...new Set([...f1, ...f2])].sort();
  const sharedFeatures = allFeatures.filter((f) => f1.has(f) && f2.has(f));
  const uniqueToApp1 = allFeatures.filter((f) => f1.has(f) && !f2.has(f));
  const uniqueToApp2 = allFeatures.filter((f) => !f1.has(f) && f2.has(f));

  // Category comparison
  const cats1 = new Set((app1.categories || []).map((c: any) => c.title || c.slug));
  const cats2 = new Set((app2.categories || []).map((c: any) => c.title || c.slug));
  const sharedCats = [...cats1].filter((c) => cats2.has(c));

  const rows: { label: string; v1: string; v2: string }[] = [
    { label: "Rating", v1: app1.averageRating ? `${app1.averageRating.toFixed(1)} ★` : "N/A", v2: app2.averageRating ? `${app2.averageRating.toFixed(1)} ★` : "N/A" },
    { label: "Reviews", v1: app1.ratingCount != null ? formatNumber(app1.ratingCount) : "N/A", v2: app2.ratingCount != null ? formatNumber(app2.ratingCount) : "N/A" },
    { label: "Pricing", v1: app1.pricingHint || "N/A", v2: app2.pricingHint || "N/A" },
    { label: "Launched", v1: formatDate(app1.launchedDate), v2: formatDate(app2.launchedDate) },
    { label: "Developer", v1: app1.developer?.name || "N/A", v2: app2.developer?.name || "N/A" },
    { label: "Languages", v1: (app1.languages || []).length ? `${app1.languages.length} languages` : "N/A", v2: (app2.languages || []).length ? `${app2.languages.length} languages` : "N/A" },
    { label: "Categories", v1: (app1.categories || []).length ? `${app1.categories.length} categories` : "N/A", v2: (app2.categories || []).length ? `${app2.categories.length} categories` : "N/A" },
  ];

  if (app1.activeInstalls != null || app2.activeInstalls != null) {
    rows.splice(3, 0, {
      label: "Installs",
      v1: app1.activeInstalls != null ? formatNumber(app1.activeInstalls) : "N/A",
      v2: app2.activeInstalls != null ? formatNumber(app2.activeInstalls) : "N/A",
    });
  }

  return (
    <>
      <ComparisonJsonLd
        headline={`${app1.name} vs ${app2.name} Comparison`}
        url={`${BASE_URL}/compare/${platform}/${slugs}`}
        apps={[
          { name: app1.name, url: `${BASE_URL}/apps/${platform}/${app1.slug}` },
          { name: app2.name, url: `${BASE_URL}/apps/${platform}/${app2.slug}` },
        ]}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumbItems.map((item, i) => (
            <span key={item.url} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i < breadcrumbItems.length - 1 ? (
                <Link href={item.url.replace(BASE_URL, "") || "/"} className="hover:text-foreground transition-colors">{item.name}</Link>
              ) : (
                <span className="text-foreground font-medium">{item.name}</span>
              )}
            </span>
          ))}
        </nav>

        <h1 className="text-3xl font-bold tracking-tight">
          {app1.name} vs {app2.name}
        </h1>

        {similarityScore != null && (
          <p className="text-sm text-muted-foreground">
            Similarity score: <span className="font-medium">{(similarityScore * 100).toFixed(0)}%</span>
            {sharedCats.length > 0 && <> &middot; {sharedCats.length} shared categor{sharedCats.length === 1 ? "y" : "ies"}</>}
          </p>
        )}

        {/* Side-by-side headers */}
        <div className="grid grid-cols-2 gap-4">
          {[app1, app2].map((app) => (
            <Link key={app.slug} href={`/apps/${platform}/${app.slug}`} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              {app.iconUrl ? (
                <Image src={app.iconUrl} alt={app.name} width={56} height={56} className="rounded-xl" unoptimized />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                  <BarChart3 className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold">{app.name}</p>
                {app.averageRating != null && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {app.averageRating.toFixed(1)} ({app.ratingCount})
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Comparison Table */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Comparison</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium w-1/4"></th>
                  <th className="text-left p-3 font-medium w-[37.5%]">{app1.name}</th>
                  <th className="text-left p-3 font-medium w-[37.5%]">{app2.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t">
                    <td className="p-3 text-muted-foreground font-medium">{row.label}</td>
                    <td className="p-3">{row.v1}</td>
                    <td className="p-3">{row.v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Feature Comparison */}
        {allFeatures.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Feature Comparison</h2>

            {sharedFeatures.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Shared Features ({sharedFeatures.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {sharedFeatures.slice(0, 12).map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="capitalize">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {uniqueToApp1.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Only in {app1.name} ({uniqueToApp1.length})</h3>
                  {uniqueToApp1.slice(0, 8).map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm py-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="capitalize">{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {uniqueToApp2.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Only in {app2.name} ({uniqueToApp2.length})</h3>
                  {uniqueToApp2.slice(0, 8).map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm py-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="capitalize">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Get Deeper Insights</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Track ranking changes, keyword positions, and review trends for both apps over time.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
