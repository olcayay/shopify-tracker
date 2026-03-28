import Link from "next/link";
import { AlertTriangle, TrendingDown, TrendingUp, Star, Megaphone, Award, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Alert {
  type: "keyword-drop" | "keyword-rise" | "competitor-change" | "new-featured" | "new-reviews" | "ad-activity";
  severity: "warning" | "success" | "info";
  message: string;
  href: string;
}

const ALERT_ICONS: Record<Alert["type"], React.ReactNode> = {
  "keyword-drop": <TrendingDown className="h-4 w-4 text-red-500" />,
  "keyword-rise": <TrendingUp className="h-4 w-4 text-emerald-500" />,
  "competitor-change": <AlertTriangle className="h-4 w-4 text-amber-500" />,
  "new-featured": <Award className="h-4 w-4 text-blue-500" />,
  "new-reviews": <Star className="h-4 w-4 text-yellow-500" />,
  "ad-activity": <Megaphone className="h-4 w-4 text-purple-500" />,
};

const SEVERITY_BG: Record<Alert["severity"], string> = {
  warning: "hover:bg-red-50/50 dark:hover:bg-red-950/20",
  success: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
  info: "hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
};

export function generateAlerts({
  rankings,
  changes,
  featuredData,
  reviewData,
  adData,
  platform,
  slug,
}: {
  rankings: any;
  changes: any[];
  featuredData: any;
  reviewData: any;
  adData: any;
  platform: string;
  slug: string;
}): Alert[] {
  const alerts: Alert[] = [];
  const base = `/${platform}/apps/v2/${slug}`;

  // Keyword drops/rises (5+ positions)
  const kwRankings = rankings?.keywordRankings || [];
  const kwGrouped = new Map<string, any[]>();
  for (const r of kwRankings) {
    if (r.position == null) continue;
    const key = r.keyword || r.keywordSlug;
    if (!kwGrouped.has(key)) kwGrouped.set(key, []);
    kwGrouped.get(key)!.push(r);
  }
  let drops = 0;
  let rises = 0;
  for (const [, entries] of kwGrouped) {
    entries.sort((a: any, b: any) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    if (entries.length < 2) continue;
    const delta = entries[1].position - entries[0].position;
    if (delta <= -5) drops++;
    if (delta >= 5) rises++;
  }
  if (drops > 0) {
    alerts.push({
      type: "keyword-drop",
      severity: "warning",
      message: `${drops} keyword${drops > 1 ? "s" : ""} dropped 5+ positions`,
      href: `${base}/visibility/keywords`,
    });
  }
  if (rises > 0) {
    alerts.push({
      type: "keyword-rise",
      severity: "success",
      message: `${rises} keyword${rises > 1 ? "s" : ""} improved 5+ positions`,
      href: `${base}/visibility/keywords`,
    });
  }

  // Recent competitor changes (last 48h)
  const recentChanges = (changes || []).filter((c: any) => {
    const age = Date.now() - new Date(c.detectedAt).getTime();
    return age < 48 * 60 * 60 * 1000;
  });
  if (recentChanges.length > 0) {
    const fields = [...new Set(recentChanges.map((c: any) => c.field))];
    alerts.push({
      type: "competitor-change",
      severity: "info",
      message: `${recentChanges.length} change${recentChanges.length > 1 ? "s" : ""} detected (${fields.slice(0, 2).join(", ")})`,
      href: `${base}/intel/changes`,
    });
  }

  // New featured placements (last 7d)
  const featuredSightings = featuredData?.sightings || [];
  const recentFeatured = featuredSightings.filter((s: any) => {
    const age = Date.now() - new Date(s.seenDate || s.scrapedAt).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  });
  const uniqueSections = new Set(recentFeatured.map((s: any) => s.sectionHandle || s.surface));
  if (uniqueSections.size > 0) {
    alerts.push({
      type: "new-featured",
      severity: "success",
      message: `Featured in ${uniqueSections.size} section${uniqueSections.size > 1 ? "s" : ""}`,
      href: `${base}/visibility/featured`,
    });
  }

  // New reviews (last 48h)
  const recentReviews = (reviewData?.reviews || []).filter((r: any) => {
    const age = Date.now() - new Date(r.reviewDate || r.createdAt).getTime();
    return age < 48 * 60 * 60 * 1000;
  });
  if (recentReviews.length > 0) {
    const avgRating = recentReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / recentReviews.length;
    alerts.push({
      type: "new-reviews",
      severity: avgRating >= 4 ? "success" : "warning",
      message: `${recentReviews.length} new review${recentReviews.length > 1 ? "s" : ""} (avg ${avgRating.toFixed(1)}★)`,
      href: `${base}/intel/reviews`,
    });
  }

  // Ad activity
  const adSightings = adData?.sightings || [];
  if (adSightings.length > 0) {
    const uniqueKws = new Set(adSightings.map((s: any) => s.keyword || s.slug));
    alerts.push({
      type: "ad-activity",
      severity: "info",
      message: `Ads detected on ${uniqueKws.size} keyword${uniqueKws.size > 1 ? "s" : ""}`,
      href: `${base}/visibility/ads`,
    });
  }

  // Sort: warnings first, then success, then info
  const order: Record<Alert["severity"], number> = { warning: 0, success: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}

export function AlertsCard({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          All clear! No alerts right now.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card divide-y">
      {alerts.map((alert, i) => (
        <Link
          key={i}
          href={alert.href}
          className={cn(
            "flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
            SEVERITY_BG[alert.severity],
          )}
        >
          <div className="flex items-center gap-2">
            {ALERT_ICONS[alert.type]}
            <span>{alert.message}</span>
          </div>
          <span className="text-xs text-muted-foreground">View →</span>
        </Link>
      ))}
    </div>
  );
}
