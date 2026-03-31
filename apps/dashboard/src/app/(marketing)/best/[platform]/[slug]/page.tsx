import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  ChevronRight,
  BarChart3,
  Tag,
  ArrowRight,
  Trophy,
  Lock,
  TrendingUp,
  Bell,
} from "lucide-react";
import { getPublicCategory } from "@/lib/api";
import { CategoryJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
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
    const category = await getPublicCategory(platform, slug);
    const platformName = PLATFORMS[platform as PlatformId].name;
    const year = new Date().getFullYear();
    const count = category.appCount || category.topApps?.length || 0;
    const title = `${count} Best ${category.title} Apps for ${platformName} (${year}) | AppRanks`;
    const description = `Discover the top ${category.title.toLowerCase()} apps for ${platformName} in ${year}. Ranked by ratings, reviews, and market presence. Updated daily.`;
    const canonical = `${BASE_URL}/best/${platform}/${slug}`;

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

export default async function BestOfPage({ params }: PageProps) {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) notFound();

  let category: any;
  try {
    category = await getPublicCategory(platform, slug);
  } catch {
    notFound();
  }
  if (!category) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];
  const year = new Date().getFullYear();
  const topApps = (category.topApps || []) as {
    position: number;
    appSlug: string;
    name: string;
    iconUrl?: string;
    averageRating?: number;
    ratingCount?: number;
    pricingHint?: string;
  }[];

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/best/${platform}` },
    { name: `Best ${category.title}`, url: `${BASE_URL}/best/${platform}/${slug}` },
  ];

  const jsonLdApps = topApps.map((app, i) => ({
    name: app.name,
    url: `${BASE_URL}/apps/${platform}/${app.appSlug}`,
    position: i + 1,
  }));

  return (
    <>
      <CategoryJsonLd
        name={`Best ${category.title} Apps for ${platformConfig.name}`}
        url={`${BASE_URL}/best/${platform}/${slug}`}
        apps={jsonLdApps}
        totalApps={category.appCount}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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

        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h1 className="text-3xl font-bold tracking-tight">
              Best {category.title} Apps for {platformConfig.name} ({year})
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            {category.description || `Discover the top-rated ${category.title.toLowerCase()} apps available on ${platformConfig.name}. Rankings based on user ratings, review count, and market performance.`}
          </p>
          {category.lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(category.lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </header>

        {/* Ranked List */}
        {topApps.length > 0 ? (
          <ol className="space-y-4">
            {topApps.map((app, i) => (
              <li key={app.appSlug}>
                <Link
                  href={`/apps/${platform}/${app.appSlug}`}
                  className="flex items-start gap-4 p-5 rounded-xl border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 text-center">
                    <span className={`text-2xl font-bold ${i < 3 ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    {i < 3 && <Trophy className="h-4 w-4 mx-auto mt-1 text-yellow-500 dark:text-yellow-400" />}
                  </div>
                  {app.iconUrl ? (
                    <Image src={app.iconUrl} alt={app.name} width={56} height={56} className="rounded-xl flex-shrink-0" unoptimized />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-lg">{app.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                      {app.averageRating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {Number(app.averageRating).toFixed(1)}
                          {app.ratingCount != null && <span className="text-xs">({app.ratingCount})</span>}
                        </span>
                      )}
                      {app.pricingHint && (
                        <span className="flex items-center gap-0.5">
                          <Tag className="h-3 w-3" />
                          {app.pricingHint}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground py-8 text-center">No apps ranked in this category yet.</p>
        )}

        {/* CTA */}
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Track These Rankings</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Get alerts when rankings change, monitor competitor activity, and see historical trends.
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
