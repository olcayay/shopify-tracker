import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Lock,
  Users,
  Bell,
  ArrowRight,
  Tag,
} from "lucide-react";
import { getPublicCategory, getPublicCategoryTree } from "@/lib/api";
import { CategoryJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";
import { formatFullDate } from "@/lib/format-utils";

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
    const title = `Best ${category.title} Apps for ${platformName} (${year}) | AppRanks`;
    const count = category.appCount || category.topApps?.length || 0;
    const description = `Compare top ${count} ${category.title.toLowerCase()} apps for ${platformName}. Find the best solution for your needs.`;
    const canonical = `${BASE_URL}/categories/${platform}/${slug}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, siteName: "AppRanks", type: "website" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {};
  }
}

export default async function PublicCategoryPage({ params }: PageProps) {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) notFound();

  let category: any;
  let categoryTree: any[] = [];
  try {
    [category, categoryTree] = await Promise.all([
      getPublicCategory(platform, slug),
      getPublicCategoryTree(platform),
    ]);
  } catch {
    notFound();
  }
  if (!category) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];
  const topApps = (category.topApps || []) as {
    position: number;
    appSlug: string;
    name: string;
    iconUrl?: string;
    averageRating?: number;
    ratingCount?: number;
    pricingHint?: string;
  }[];

  // Find parent category for breadcrumbs
  const parentCat = categoryTree.find((c: any) => c.slug === category.parentSlug);
  const subcategories = categoryTree.filter((c: any) => c.parentSlug === slug);

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/categories/${platform}` },
    ...(parentCat ? [{ name: parentCat.title, url: `${BASE_URL}/categories/${platform}/${parentCat.slug}` }] : []),
    { name: category.title, url: `${BASE_URL}/categories/${platform}/${slug}` },
  ];

  const jsonLdApps = topApps.map((app, i) => ({
    name: app.name,
    url: `${BASE_URL}/apps/${platform}/${app.appSlug}`,
    position: i + 1,
  }));

  return (
    <>
      <CategoryJsonLd
        name={category.title}
        url={`${BASE_URL}/categories/${platform}/${slug}`}
        apps={jsonLdApps}
        totalApps={category.appCount}
      />
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
          <h1 className="text-3xl font-bold tracking-tight">
            Best {category.title} Apps for {platformConfig.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {category.appCount != null && (
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                {category.appCount} apps
              </span>
            )}
            {category.lastUpdated && (
              <span>
                Updated {formatFullDate(category.lastUpdated)}
              </span>
            )}
          </div>
          {category.description && (
            <p className="text-muted-foreground max-w-3xl">{category.description}</p>
          )}
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column — Top Apps */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">Top {category.title} Apps</h2>
            {topApps.length > 0 ? (
              <div className="space-y-3">
                {topApps.map((app, i) => (
                  <Link
                    key={app.appSlug}
                    href={`/apps/${platform}/${app.appSlug}`}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-lg font-bold text-muted-foreground w-8 text-center">
                      {i + 1}
                    </span>
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
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
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
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No apps ranked in this category yet.</p>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Subcategories */}
            {subcategories.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold text-sm">Subcategories</h3>
                <div className="space-y-1">
                  {subcategories.map((sub: any) => (
                    <Link
                      key={sub.slug}
                      href={`/categories/${platform}/${sub.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      {sub.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Category Stats */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Category Stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="font-medium">{platformConfig.name}</dd>
                </div>
                {category.appCount != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Apps</dt>
                    <dd className="font-medium">{category.appCount}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* CTA */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Track This Category</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>Ranking history & trends</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Competitor tracking</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Ranking change alerts</span>
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
