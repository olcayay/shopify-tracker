import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/link";
import Image from "next/image";
import {
  Star,
  Calendar,
  Download,
  ChevronRight,
  Lock,
  TrendingUp,
  Bell,
  BarChart3,
  Users,
  Tag,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { getPublicApp } from "@/lib/api";
import { AppJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatNumber } from "@/lib/format-utils";
import { PLATFORMS, isPlatformId, buildExternalAppUrl } from "@appranks/shared";
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
    const app = await getPublicApp(platform, slug);
    const platformName = PLATFORMS[platform as PlatformId].name;
    const title = `${app.name} for ${platformName} - Reviews, Pricing & Alternatives | AppRanks`;
    const ratingText = app.averageRating ? `${Number(app.averageRating).toFixed(1)}★` : "";
    const reviewText = app.ratingCount ? `from ${app.ratingCount} reviews` : "";
    const ratingInfo = [ratingText, reviewText].filter(Boolean).join(" ");
    const pricingInfo = app.pricingHint || "";
    const descParts = [
      app.name,
      ratingInfo ? `has ${ratingInfo}.` : "",
      pricingInfo ? `${pricingInfo}.` : "",
      "Compare alternatives and see detailed analysis.",
    ];
    const description = descParts.filter(Boolean).join(" ");
    const canonical = `${BASE_URL}/apps/${platform}/${slug}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "AppRanks",
        type: "website",
        ...(app.iconUrl ? { images: [{ url: app.iconUrl, width: 128, height: 128, alt: app.name }] } : {}),
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return {};
  }
}

function StarRating({ rating, maxStars = 5 }: { rating: number; maxStars?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const partial = !filled && i < rating;
        return (
          <Star
            key={i}
            className={`h-4 w-4 ${
              filled
                ? "fill-yellow-400 text-yellow-400 dark:fill-yellow-500 dark:text-yellow-500"
                : partial
                  ? "fill-yellow-400/50 text-yellow-400"
                  : "text-gray-300 dark:text-gray-600"
            }`}
          />
        );
      })}
    </div>
  );
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicAppPage({ params }: PageProps) {
  const { platform, slug } = await params;
  if (!isPlatformId(platform)) notFound();

  let app: any;
  try {
    app = await getPublicApp(platform, slug);
  } catch {
    notFound();
  }
  if (!app) notFound();

  const platformConfig = PLATFORMS[platform as PlatformId];
  const maxStars = platformConfig.maxRatingStars;
  const externalUrl = buildExternalAppUrl(platform as PlatformId, slug);
  const rating = app.averageRating ? Number(app.averageRating) : null;
  const developer = app.developer as { name?: string; website?: string } | null;
  const appCategories = (app.categories || []) as { title?: string; slug?: string }[];
  const screenshots = (app.screenshots || []) as string[];
  const features = (app.features || []) as string[];
  const pricingPlans = (app.pricingPlans || []) as { name?: string; price?: string; features?: string[] }[];
  const similarApps = (app.similarApps || []) as {
    slug: string;
    name: string;
    iconUrl?: string;
    averageRating?: number;
    ratingCount?: number;
    pricingHint?: string;
  }[];

  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: platformConfig.name, url: `${BASE_URL}/apps/${platform}` },
    ...(appCategories.length > 0 && appCategories[0].slug
      ? [{ name: appCategories[0].title || appCategories[0].slug, url: `${BASE_URL}/categories/${platform}/${appCategories[0].slug}` }]
      : []),
    { name: app.name, url: `${BASE_URL}/apps/${platform}/${slug}` },
  ];

  return (
    <>
      <AppJsonLd
        name={app.name}
        description={app.intro || undefined}
        url={`${BASE_URL}/apps/${platform}/${slug}`}
        iconUrl={app.iconUrl}
        developer={developer?.name}
        rating={rating}
        ratingCount={app.ratingCount}
        pricingHint={app.pricingHint}
        datePublished={app.launchedDate}
        platform={platformConfig.name}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, i) => (
            <span key={item.url} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i < breadcrumbItems.length - 1 ? (
                <Link href={item.url.replace(BASE_URL, "")} className="hover:text-foreground transition-colors">
                  {item.name}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.name}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Hero Section */}
        <section className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-shrink-0">
            {app.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={`${app.name} icon`}
                width={96}
                height={96}
                className="rounded-2xl shadow-md"
                unoptimized
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {rating != null && (
                <div className="flex items-center gap-1.5">
                  <StarRating rating={rating} maxStars={maxStars} />
                  <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
                  {app.ratingCount != null && <span>({app.ratingCount} reviews)</span>}
                </div>
              )}
              {app.pricingHint && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {app.pricingHint}
                </span>
              )}
              {app.activeInstalls != null && (
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {formatNumber(app.activeInstalls)} installs
                </span>
              )}
              {app.launchedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(app.launchedDate)}
                </span>
              )}
            </div>
            {developer?.name && (
              <p className="text-sm text-muted-foreground">
                By{" "}
                {developer.website ? (
                  <ExternalLink
                    href={developer.website}
                    showIcon={false}
                    className="text-primary"
                  >
                    {developer.name}
                  </ExternalLink>
                ) : (
                  <span className="font-medium">{developer.name}</span>
                )}
              </p>
            )}
            {app.isBuiltForShopify && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Built for Shopify
              </span>
            )}
            <div className="flex gap-3 pt-1">
              <ExternalLink
                href={externalUrl}
                className="text-sm text-primary"
              >
                View on {platformConfig.name}
              </ExternalLink>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {app.intro && (
              <section>
                <h2 className="text-xl font-semibold mb-3">About {app.name}</h2>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {app.intro}
                </div>
              </section>
            )}

            {/* Screenshots */}
            {screenshots.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Screenshots</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {screenshots.slice(0, 6).map((src, i) => (
                    <Image
                      key={i}
                      src={src}
                      alt={`${app.name} screenshot ${i + 1}`}
                      width={400}
                      height={240}
                      className="rounded-lg border shadow-sm flex-shrink-0 object-cover"
                      unoptimized
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Features */}
            {features.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Features</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {features.slice(0, 20).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{typeof feature === "string" ? feature : (feature as any)?.title || (feature as any)?.name || JSON.stringify(feature)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Pricing Plans */}
            {pricingPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Pricing</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pricingPlans.map((plan, i) => (
                    <div key={i} className="rounded-lg border p-4 space-y-2">
                      <h3 className="font-semibold">{plan.name || `Plan ${i + 1}`}</h3>
                      {plan.price && <p className="text-lg font-bold text-primary">{plan.price}</p>}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {plan.features.slice(0, 5).map((f, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Similar Apps */}
            {similarApps.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Similar Apps & Alternatives</h2>
                <div className="space-y-3">
                  {similarApps.map((sa) => (
                    <Link
                      key={sa.slug}
                      href={`/apps/${platform}/${sa.slug}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {sa.iconUrl ? (
                        <Image
                          src={sa.iconUrl}
                          alt={sa.name}
                          width={40}
                          height={40}
                          className="rounded-lg"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sa.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {sa.averageRating != null && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {Number(sa.averageRating).toFixed(1)}
                              {sa.ratingCount != null && <span>({sa.ratingCount})</span>}
                            </span>
                          )}
                          {sa.pricingHint && <span>{sa.pricingHint}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar (1/3) */}
          <div className="space-y-6">
            {/* Categories */}
            {appCategories.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold text-sm">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {appCategories.map((cat, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center text-xs bg-muted px-2.5 py-1 rounded-full"
                    >
                      {cat.title || cat.slug}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Quick Stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="font-medium">{platformConfig.name}</dd>
                </div>
                {rating != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rating</dt>
                    <dd className="font-medium">{rating.toFixed(1)} / {maxStars}</dd>
                  </div>
                )}
                {app.ratingCount != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Reviews</dt>
                    <dd className="font-medium">{formatNumber(app.ratingCount)}</dd>
                  </div>
                )}
                {app.activeInstalls != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Installs</dt>
                    <dd className="font-medium">{formatNumber(app.activeInstalls)}</dd>
                  </div>
                )}
                {app.launchedDate && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Launched</dt>
                    <dd className="font-medium">{formatDate(app.launchedDate)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Audit CTA */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">How does this listing score?</h3>
              <p className="text-sm text-muted-foreground">
                Get a free audit with actionable recommendations to improve this app&apos;s listing.
              </p>
              <Link
                href={`/audit/${platform}/${slug}`}
                className="block w-full text-center bg-secondary text-secondary-foreground text-sm font-medium py-2 rounded-md hover:bg-secondary/80 transition-colors"
              >
                View Audit Report
              </Link>
            </div>

            {/* CTA Cards */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Unlock Full Analytics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>Full keyword rankings</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Competitor analysis</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Review & ranking alerts</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
                <li className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>Historical trend data</span>
                  <Lock className="h-3 w-3 ml-auto" />
                </li>
              </ul>
              <Link
                href="/register"
                className="block w-full text-center bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Get Started Free
              </Link>
              <p className="text-xs text-center text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
