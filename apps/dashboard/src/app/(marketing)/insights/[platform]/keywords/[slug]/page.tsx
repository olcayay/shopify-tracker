import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/link";
import Image from "next/image";
import {
  ChevronRight,
  BarChart3,
  Star,
  Tag,
  ArrowRight,
  Search,
  Lock,
  TrendingUp,
} from "lucide-react";
import { getPublicKeyword } from "@/lib/api";
import { BreadcrumbJsonLd, CategoryJsonLd } from "@/components/seo/json-ld";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";

const BASE_URL = "https://appranks.io";

interface PageProps {
  params: Promise<{ platform: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) return {};
  try {
    const kw = await getPublicKeyword(platform, slug);
    const platformName = PLATFORMS[platform as PlatformId].name;
    const year = new Date().getFullYear();
    const title = `"${kw.keyword}" — Top ${platformName} Apps (${year}) | AppRanks`;
    const description = `See which ${platformName} apps rank highest for "${kw.keyword}". ${kw.totalRanked} apps ranked. Compare ratings, pricing, and positions.`;
    const canonical = `${BASE_URL}/insights/${platform}/keywords/${slug}`;
    return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, siteName: "AppRanks" } };
  } catch { return {}; }
}

export default async function KeywordInsightPage({ params }: PageProps) {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) notFound();

  let kw: any;
  try { kw = await getPublicKeyword(platform, slug); } catch { notFound(); }
  if (!kw) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];
  const topApps = (kw.topApps || []) as {
    position: number; appSlug: string; name: string; iconUrl?: string;
    averageRating?: number; ratingCount?: number; pricingHint?: string;
  }[];

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/insights/${platform}` },
    { name: `"${kw.keyword}"`, url: `${BASE_URL}/insights/${platform}/keywords/${slug}` },
  ];

  return (
    <>
      <CategoryJsonLd
        name={`Top apps for "${kw.keyword}" on ${platformConfig.name}`}
        url={`${BASE_URL}/insights/${platform}/keywords/${slug}`}
        apps={topApps.map((a, i) => ({ name: a.name, url: `${BASE_URL}/apps/${platform}/${a.appSlug}`, position: i + 1 }))}
        totalApps={kw.totalRanked}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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

        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              &ldquo;{kw.keyword}&rdquo; on {platformConfig.name}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {kw.totalRanked} apps ranked for this keyword. See which apps appear at the top.
          </p>
        </header>

        {/* Ranked Apps */}
        {topApps.length > 0 ? (
          <ol className="space-y-3">
            {topApps.map((app) => (
              <li key={app.appSlug}>
                <Link
                  href={`/apps/${platform}/${app.appSlug}`}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg font-bold text-muted-foreground w-8 text-center">
                    #{app.position}
                  </span>
                  {app.iconUrl ? (
                    <Image src={app.iconUrl} alt={app.name} width={44} height={44} className="rounded-lg" unoptimized />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{app.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {app.averageRating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {Number(app.averageRating).toFixed(1)}
                          {app.ratingCount != null && <span>({app.ratingCount})</span>}
                        </span>
                      )}
                      {app.pricingHint && <span className="flex items-center gap-0.5"><Tag className="h-3 w-3" />{app.pricingHint}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground py-8 text-center">No ranking data available yet.</p>
        )}

        {/* CTA */}
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Track This Keyword</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Monitor ranking changes over time, see historical trends, and get alerts when positions shift.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Start Tracking <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
