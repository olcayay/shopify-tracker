import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  ChevronRight,
  BarChart3,
  Globe,
  Tag,
  ArrowRight,
  Lock,
  TrendingUp,
  Bell,
} from "lucide-react";
import { getPublicDeveloper } from "@/lib/api";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatNumber, formatMonthYear } from "@/lib/format-utils";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import { ExternalLink } from "@/components/ui/external-link";
import type { PlatformId } from "@appranks/shared";

const BASE_URL = "https://appranks.io";

interface PageProps {
  params: Promise<{ platform: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) return {};

  try {
    const dev = await getPublicDeveloper(platform, slug);
    const platformName = PLATFORMS[platform as PlatformId].name;
    const appCount = dev.apps?.length || 0;
    const title = `${dev.name} — ${platformName} Developer Profile | AppRanks`;
    const description = `${dev.name} has ${appCount} app${appCount !== 1 ? "s" : ""} on ${platformName}. View their app portfolio, ratings, and market presence.`;
    const canonical = `${BASE_URL}/developers/${platform}/${slug}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, siteName: "AppRanks", type: "profile" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {};
  }
}

export default async function PublicDeveloperPage({ params }: PageProps) {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) notFound();

  let dev: any;
  try {
    dev = await getPublicDeveloper(platform, slug);
  } catch {
    notFound();
  }
  if (!dev) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];
  const apps = (dev.apps || []) as {
    slug: string;
    name: string;
    iconUrl?: string;
    platform: string;
    averageRating?: number;
    ratingCount?: number;
    pricingHint?: string;
    launchedDate?: string | null;
    categoryRankings?: { categorySlug: string; categoryName: string; position: number; totalApps: number; percentile: number }[];
  }[];

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/apps/${platform}` },
    { name: dev.name, url: `${BASE_URL}/developers/${platform}/${slug}` },
  ];

  // Calculate aggregate stats
  const appsWithRating = apps.filter((a) => a.averageRating != null);
  const avgRating = appsWithRating.length > 0
    ? appsWithRating.reduce((sum, a) => sum + Number(a.averageRating), 0) / appsWithRating.length
    : null;
  const totalReviews = apps.reduce((sum, a) => sum + (a.ratingCount || 0), 0);

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumbItems.map((item, i) => (
            <span key={item.url} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i < breadcrumbItems.length - 1 ? (
                <Link href={item.url.replace(BASE_URL, "") || "/"} className="hover:text-foreground transition-colors">
                  {item.name}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.name}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Header */}
        <section className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">{dev.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              {apps.length} app{apps.length !== 1 ? "s" : ""}
            </span>
            {avgRating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {avgRating.toFixed(1)} avg rating
              </span>
            )}
            {totalReviews > 0 && (
              <span>{formatNumber(totalReviews)} total reviews</span>
            )}
          </div>
          {dev.website && (
            <ExternalLink
              href={dev.website}
              iconSize="sm"
              className="text-sm text-primary"
            >
              <Globe className="h-3.5 w-3.5" />
              {dev.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </ExternalLink>
          )}
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column — Apps */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">Apps by {dev.name}</h2>
            {apps.length > 0 ? (
              <div className="space-y-3">
                {apps.map((app) => (
                  <Link
                    key={`${app.platform}-${app.slug}`}
                    href={`/apps/${app.platform}/${app.slug}`}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    {app.iconUrl ? (
                      <Image
                        src={app.iconUrl}
                        alt={app.name}
                        width={48}
                        height={48}
                        className="rounded-lg"
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{app.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {app.averageRating != null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {Number(app.averageRating).toFixed(1)}
                            {app.ratingCount != null && <span>({app.ratingCount})</span>}
                          </span>
                        )}
                        {app.pricingHint && (
                          <span className="flex items-center gap-0.5">
                            <Tag className="h-3 w-3" />
                            {app.pricingHint}
                          </span>
                        )}
                        {app.launchedDate && (
                          <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                            {formatMonthYear(app.launchedDate)}
                          </span>
                        )}
                        {Array.isArray(app.categoryRankings) && app.categoryRankings.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">
                            {app.categoryRankings.slice(0, 2).map((r: { categorySlug: string; categoryName: string; position: number; totalApps: number; percentile: number }) => (
                              <span
                                key={r.categorySlug}
                                className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                              >
                                #{r.position} {r.categoryName}
                                {r.totalApps >= 10 ? ` · Top ${r.percentile}%` : ""}
                              </span>
                            ))}
                            {app.categoryRankings.length > 2 && (
                              <span className="text-[11px] text-muted-foreground">
                                +{app.categoryRankings.length - 2}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {PLATFORMS[app.platform as PlatformId]?.name || app.platform}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No apps found for this developer.</p>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Developer Stats */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Developer Stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Apps</dt>
                  <dd className="font-medium">{apps.length}</dd>
                </div>
                {avgRating != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Avg Rating</dt>
                    <dd className="font-medium">{avgRating.toFixed(1)}</dd>
                  </div>
                )}
                {totalReviews > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Reviews</dt>
                    <dd className="font-medium">{formatNumber(totalReviews)}</dd>
                  </div>
                )}
                {dev.platforms && dev.platforms.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Platforms</dt>
                    <dd className="font-medium">{dev.platforms.length}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* CTA */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Track This Developer</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>App performance trends</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>New app & pricing alerts</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
              </ul>
              <Link
                href="/register"
                className="block w-full text-center bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
