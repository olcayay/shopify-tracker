import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  BarChart3,
  TrendingUp,
  Star,
  Lock,
  ArrowRight,
} from "lucide-react";
import { getPublicPlatformStats, getPublicCategoryTree } from "@/lib/api";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatNumber } from "@/lib/format-utils";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";

const BASE_URL = "https://appranks.io";

interface PageProps {
  params: Promise<{ platform: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform } = await params;
  if (!isPlatformId(platform)) return {};
  const platformName = PLATFORMS[platform as PlatformId].name;
  const year = new Date().getFullYear();
  const title = `${platformName} App Marketplace Trends & Statistics (${year}) | AppRanks`;
  const description = `Explore ${platformName} marketplace trends, top categories, app counts, and average ratings. Data-driven insights updated daily.`;
  const canonical = `${BASE_URL}/trends/${platform}`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, siteName: "AppRanks" } };
}

export default async function TrendsPage({ params }: PageProps) {
  const { platform } = await params;
  if (!isPlatformId(platform)) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];

  let stats: any;
  let categories: any[] = [];
  try {
    [stats, categories] = await Promise.all([
      getPublicPlatformStats(platform),
      getPublicCategoryTree(platform),
    ]);
  } catch {
    notFound();
  }

  const year = new Date().getFullYear();
  const topCategories = categories.filter((c: any) => c.isListingPage).slice(0, 20);

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Trends", url: `${BASE_URL}/trends` },
    { name: platformConfig.name, url: `${BASE_URL}/trends/${platform}` },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
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
          <h1 className="text-3xl font-bold tracking-tight">
            {platformConfig.name} Marketplace Trends ({year})
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Overview of the {platformConfig.name} app marketplace — total apps, categories, ratings, and top categories by app count.
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{stats?.totalApps != null ? formatNumber(stats.totalApps) : 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Apps</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{stats?.totalCategories || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Categories</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            {stats?.averageRating && (
              <div className="flex justify-center mb-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
            )}
            <p className="text-3xl font-bold">{stats?.averageRating || "N/A"}</p>
            <p className="text-sm text-muted-foreground mt-1">Avg Rating</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">11</p>
            <p className="text-sm text-muted-foreground mt-1">Platforms Tracked</p>
          </div>
        </div>

        {/* Top Categories */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Top Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topCategories.map((cat: any) => (
              <Link
                key={cat.slug}
                href={`/categories/${platform}/${cat.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <BarChart3 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{cat.title}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* Other Platforms */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Explore Other Platforms</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLATFORMS)
              .filter(([id]) => id !== platform)
              .map(([id, config]) => (
                <Link
                  key={id}
                  href={`/trends/${id}`}
                  className="text-sm px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
                >
                  {config.name}
                </Link>
              ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Track Market Trends in Real-Time</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Get daily ranking updates, competitor monitoring, and keyword tracking across all 11 platforms.
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
