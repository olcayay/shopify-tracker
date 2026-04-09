"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useApiQuery, useQueryClient } from "@/lib/use-api-query";
import { useFormatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppSearchBar } from "@/components/app-search-bar";
import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { formatCategoryTitle } from "@/lib/platform-urls";

type SortKey = "name" | "rating" | "reviews" | "minPaidPrice" | "lastChangeAt" | "launchedDate" | "competitorCount" | "keywordCount";
type SortDir = "asc" | "desc";

export default function AppsPage() {
  const { platform } = useParams();
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  // Fetch tracked apps via TanStack Query
  const { data: apps = [], isLoading: appsLoading } = useApiQuery<any[]>(
    ["apps", platform],
    "/api/apps",
  );

  // Derive slugs for the categories query
  const appSlugs = useMemo(() => apps.map((a: any) => a.slug).filter(Boolean), [apps]);

  // Fetch categories for apps — only when we have slugs
  // Categories need a POST body, so we use useQuery directly instead of useApiQuery
  const categoriesQuery = useQuery<Record<string, { title: string; slug: string; position: number | null }[]>>({
    queryKey: ["apps-categories", platform, ...appSlugs],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/apps/categories", {
        method: "POST",
        body: JSON.stringify({ slugs: appSlugs }),
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: appSlugs.length > 0,
  });

  const resolvedCategories = categoriesQuery.data ?? {};

  const loading = appsLoading;

  const trackedSlugs = useMemo(() => new Set(apps.map((a) => a.slug)), [apps]);

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || a.slug).localeCompare(b.name || b.slug);
          break;
        case "rating":
          cmp = (a.latestSnapshot?.averageRating ?? 0) - (b.latestSnapshot?.averageRating ?? 0);
          break;
        case "reviews":
          cmp = (a.latestSnapshot?.ratingCount ?? 0) - (b.latestSnapshot?.ratingCount ?? 0);
          break;
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "lastChangeAt":
          cmp = (a.lastChangeAt || "").localeCompare(b.lastChangeAt || "");
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
        case "competitorCount":
          cmp = (a.competitorCount ?? 0) - (b.competitorCount ?? 0);
          break;
        case "keywordCount":
          cmp = (a.keywordCount ?? 0) - (b.keywordCount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [apps, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  const invalidateApps = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["apps", platform] });
    queryClient.invalidateQueries({ queryKey: ["apps-categories", platform] });
  }, [queryClient, platform]);

  async function trackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-apps?platform=${platform}`, {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Scraping started — details will appear shortly."
        : "";
      setMessage(`"${name}" added to My Apps.${scrapeMsg}`);
      invalidateApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track app");
    }
  }

  async function untrackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-apps/${slug}?platform=${platform}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`"${name}" removed from My Apps`);
      // Optimistic: remove from cache immediately for instant UI feedback
      queryClient.setQueryData(["apps", platform], (old: any[] | undefined) =>
        old ? old.filter((a: any) => a.slug !== slug) : [],
      );
      invalidateApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to untrack app");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">
          My Apps {loading ? (
            <Skeleton className="inline-block h-6 w-16 align-middle" />
          ) : (
            <>({apps.length}{account ? `/${account.limits.maxTrackedApps}` : ""})</>
          )}
        </h1>
        <AdminScraperTrigger
          scraperType="app_details"
          label="Scrape All Apps"
        />
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <AppSearchBar
        mode="follow"
        trackedSlugs={trackedSlugs}
        onFollow={trackApp}
        placeholder="Search apps..."
        className="max-w-md"
      />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none max-w-[260px]" onClick={() => toggleSort("name")}>
                    App <SortIcon col="name" />
                  </TableHead>
                  {caps.hasReviews && (
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                      Rating <SortIcon col="rating" />
                    </TableHead>
                  )}
                  {caps.hasReviews && (
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
                      Reviews <SortIcon col="reviews" />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("competitorCount")}>
                    Competitors <SortIcon col="competitorCount" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keywordCount")}>
                    Keywords <SortIcon col="keywordCount" />
                  </TableHead>
                  <TableHead>Categories</TableHead>
                  {caps.hasPricing && <TableHead>Pricing</TableHead>}
                  {caps.hasPricing && (
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                      Min. Paid <SortIcon col="minPaidPrice" />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChangeAt")}>
                    Last Change <SortIcon col="lastChangeAt" />
                  </TableHead>
                  {caps.hasLaunchedDate && (
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                      Launched <SortIcon col="launchedDate" />
                    </TableHead>
                  )}
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((app) => (
                  <TableRow key={app.slug}>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <AppIcon src={app.iconUrl} className="h-6 w-6 rounded" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/${platform}/apps/${app.slug}`}
                              className="text-primary hover:underline font-medium truncate"
                            >
                              {app.name}
                            </Link>
                            {app.isBuiltForShopify && <span title="Built for Shopify" className="shrink-0">💎</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {caps.hasReviews && (
                      <TableCell>
                        {app.latestSnapshot?.averageRating ?? "\u2014"}
                      </TableCell>
                    )}
                    {caps.hasReviews && (
                      <TableCell>
                        {app.latestSnapshot?.ratingCount != null ? (
                          <Link href={`/${platform}/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                            {app.latestSnapshot.ratingCount}
                          </Link>
                        ) : "\u2014"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {app.competitorCount ? (
                        <Link href={`/${platform}/apps/${app.slug}/competitors`} className="text-primary hover:underline">
                          {app.competitorCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.keywordCount ? (
                        <Link href={`/${platform}/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                          {app.keywordCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {resolvedCategories[app.slug]?.length ? (
                        <div className="flex flex-col gap-0.5">
                          {resolvedCategories[app.slug].map((cat) => (
                            <div key={cat.slug} className="flex items-center gap-1">
                              {cat.position != null && (
                                <span className="font-medium text-muted-foreground">#{cat.position}</span>
                              )}
                              <Link href={`/${platform}/categories/${cat.slug}`} className="text-primary hover:underline">
                                {formatCategoryTitle(platform as PlatformId, cat.slug, cat.title)}
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    {caps.hasPricing && (
                      <TableCell className="text-sm">
                        {app.latestSnapshot?.pricing ?? "\u2014"}
                      </TableCell>
                    )}
                    {caps.hasPricing && (
                      <TableCell className="text-sm">
                        {app.minPaidPrice != null ? (
                          <Link href={`/${platform}/apps/${app.slug}/details#pricing-plans`} className="text-primary hover:underline">
                            ${app.minPaidPrice}/mo
                          </Link>
                        ) : "\u2014"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {app.lastChangeAt ? (
                        <Link href={`/${platform}/apps/${app.slug}/changes`} className="text-primary hover:underline">
                          {formatDateOnly(app.lastChangeAt)}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    {caps.hasLaunchedDate && (
                      <TableCell className="text-sm text-muted-foreground">
                        {app.launchedDate
                          ? formatDateOnly(app.launchedDate)
                          : "\u2014"}
                      </TableCell>
                    )}
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              slug: app.slug,
                              name: app.name,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 10 : 9}
                      className="text-center text-muted-foreground"
                    >
                      No apps yet. Search and add an app to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove from My Apps"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from your apps? Its competitors and keywords will also be removed.`}
        onConfirm={() => {
          if (confirmRemove) {
            untrackApp(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
